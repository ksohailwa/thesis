import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { Experiment } from '../models/Experiment';
import { Story } from '../models/Story';
import { getOpenAI } from '../utils/openai';
import { wordPoolSystem, wordPoolUser, storySystem, storyUser } from '../prompts';

const router = Router();

function makeCode(n = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: n }, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

function splitParagraphSentences(paragraph: string): string[] {
  const parts: string[] = [];
  const re = /([^.!?]*[.!?])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraph))) parts.push(m[1].trim());
  if (parts.length === 0 && paragraph.trim()) parts.push(paragraph.trim());
  return parts;
}

function validateStory(words: string[], paragraphs: string[], occ: any[]) {
  const violations: string[] = [];
  if (!Array.isArray(paragraphs) || paragraphs.length !== 5) violations.push('Must have exactly 5 paragraphs.');
  const sentencesPerP = paragraphs.map(p => splitParagraphSentences(p).length);
  // counts
  for (const w of words) {
    const c = occ.filter((o:any)=>o.word===w).length;
    if (c !== 4) violations.push(`Word "${w}" must appear exactly 4 times (got ${c}).`);
  }
  // per-sentence constraints
  const byKey: Record<string, string[]> = {};
  for (const o of occ) {
    if (o.paragraphIndex < 0 || o.paragraphIndex >= paragraphs.length) violations.push('paragraphIndex out of range');
    const sCount = sentencesPerP[o.paragraphIndex] ?? 0;
    if (o.sentenceIndex < 0 || o.sentenceIndex >= sCount) violations.push('sentenceIndex out of range');
    const key = `${o.paragraphIndex}:${o.sentenceIndex}`;
    (byKey[key] ||= []).push(o.word);
  }
  for (const [key, arr] of Object.entries(byKey)) {
    const unique = Array.from(new Set(arr));
    if (arr.length !== unique.length) violations.push(`Duplicate same word in sentence ${key}`);
    if (unique.length > 1) violations.push(`Multiple target words share sentence ${key}`);
  }
  return { ok: violations.length === 0, violations };
}

router.post('/', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const schema = z.object({ title: z.string().min(2), description: z.string().optional(), level: z.enum(['A1','A2','B1','B2','C1','C2']).optional(), cefr: z.enum(['A2','B1','B2','C1','C2']).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { title, description, level, cefr } = parsed.data as any;
  const code = makeCode();
  const doc = await Experiment.create({ owner: req.user?.sub, title, description, level: level || cefr, cefr: cefr || level, targetWords: [], classCode: code, code, status: 'draft' });
  res.json({ id: doc._id, code: doc.classCode, ...doc.toObject() });
});

router.get('/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  const doc = await Experiment.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ id: doc._id, ...doc.toObject() });
});

router.post('/:id/target-words', requireAuth, requireRole('teacher'), async (req, res) => {
  const schema = z.object({ targetWords: z.array(z.string()).min(1).max(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const capped = parsed.data.targetWords.slice(0, 10);
  const exp = await Experiment.findByIdAndUpdate(req.params.id, { targetWords: capped }, { new: true });
  if (!exp) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.post('/:id/suggestions', requireAuth, requireRole('teacher'), async (req, res) => {
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const oa = getOpenAI();
  if (!oa) {
    const items = ['harbor','lantern','bridge','canvas','meadow','quilt','ripple','echo','parcel','orchard','timber','breeze','murmur','copper','trail','village','glimmer','whisper','puzzle','cabin']
                  .slice(0,20).map(w => ({ word: w, gloss: '' }));
    return res.json({ suggestions: items.map(i=>i.word), items });
  }
  try {
    const r = await oa.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [ { role:'system', content: wordPoolSystem() }, { role:'user', content: wordPoolUser(exp.cefr || exp.level || 'B1') } ],
      temperature: 0.6
    });
    const text = r.choices?.[0]?.message?.content || '{}';
    const data = JSON.parse(text);
    const items = Array.isArray(data?.items) ? data.items.slice(0,20) : [];
    return res.json({ suggestions: items.map((i:any)=>i.word), items });
  } catch {}
  return res.json({ suggestions: [], items: [] });
});

// Generate 2 stories (A/B) with each selected word appearing exactly 4x, never twice in the same sentence.
router.post('/:id/generate-stories', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const schema = z.object({ cefr: z.string().optional(), targetWords: z.array(z.string()).max(10).optional(), topic: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const all = (parsed.data.targetWords && parsed.data.targetWords.length ? parsed.data.targetWords : (exp.targetWords || [])).slice(0, 10);
  const wordsH = all.slice(0, 5);
  const wordsN = all.slice(5, 10).length ? all.slice(5, 10) : all.slice(0, 5);
  const oa = getOpenAI();

  async function genOne(label: 'H'|'N') {
    let paragraphs: string[] = [];
    let occ: any[] = [];
    const words = label === 'H' ? wordsH : wordsN;
      if (oa) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const r = await oa.chat.completions.create({
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              response_format: { type: 'json_object' },
              temperature: 0.8,
              messages: [
                { role: 'system', content: storySystem() },
                { role: 'user', content: storyUser((parsed.data?.cefr as any) || (exp.cefr as any) || (exp.level as any) || 'B1', words, (parsed.data as any)?.topic || '')}
              ]
            });
            const text = r.choices?.[0]?.message?.content || '{}';
            const data = JSON.parse(text);
            paragraphs = Array.isArray(data?.story?.paragraphs) ? data.story.paragraphs.slice(0,5) : [];
            occ = Array.isArray(data?.story?.occurrences) ? data.story.occurrences : [];
            const val = validateStory(words, paragraphs, occ);
            if (val.ok) break;
            paragraphs = [] as any;
            occ = [] as any;
          } catch {}
        }
      }
      // strict fallback that enforces: 4x per word, never twice in a sentence, and no two words in the same sentence
      if (!paragraphs.length) {
        const baseSentences: string[] = [];
        for (let p = 0; p < 5; p++) {
          for (let s = 0; s < 4; s++) baseSentences.push(`A short sentence ${p+1}-${s+1}.`);
        }
        const assigned: { word: string; paragraphIndex: number; sentenceIndex: number }[] = [];
        const N = words.length;
        for (let i = 0; i < N; i++) {
          for (let k = 0; k < 4; k++) {
            const idx = i + k * N; // guarantees unique sentence
            const paragraphIndex = Math.floor(idx / 4);
            const sentenceIndex = idx % 4;
            assigned.push({ word: words[i], paragraphIndex, sentenceIndex });
          }
        }
        const byP: string[][] = [];
        for (let p = 0; p < 5; p++) byP.push(baseSentences.slice(p*4, p*4+4));
        const occLocal: any[] = [];
        for (const a of assigned) {
          const before = byP[a.paragraphIndex][a.sentenceIndex];
          const insertion = ` ${a.word}`;
          const charStart = before.length;
          const charEnd = charStart + insertion.length;
          byP[a.paragraphIndex][a.sentenceIndex] = before.replace(/[.!?]+$/, '') + insertion + '.';
          occLocal.push({ word: a.word, paragraphIndex: a.paragraphIndex, sentenceIndex: a.sentenceIndex, charStart, charEnd });
        }
        paragraphs = byP.map(row => row.join(' '));
        occ = occLocal;
      }
    const map = label === 'H' ? 'A' : 'B';
    const s = await Story.findOneAndUpdate({ experiment: exp._id, label: map }, { experiment: exp._id, label: map, paragraphs, targetOccurrences: occ }, { upsert: true, new: true });
    return s;
  }

  // Generate sequentially to reduce token/response size pressure
  const sH = await genOne('H');
  // tiny gap to be gentle on provider rate limits
  await new Promise((r) => setTimeout(r, 150));
  const sN = await genOne('N');
  await Experiment.findByIdAndUpdate(exp._id, { stories: { H: sH._id, N: sN._id } });
  return res.json({ ok: true, used: 'openai', wordsCount: { H: wordsH.length, N: wordsN.length }, stories: { H: sH._id, N: sN._id } });
});

// Generate both stories and synthesize TTS for both in one call
router.post('/:id/generate-all', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const gen = await (async () => {
    try {
      const r = await fetch(`http://localhost:${process.env.PORT || '4000'}/api/experiments/${req.params.id}/generate-stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || {})
      } as any);
      return await (r as any).json();
    } catch { return { ok: false }; }
  })();
  const tts = await (async () => {
    try {
      const r = await fetch(`http://localhost:${process.env.PORT || '4000'}/api/experiments/${req.params.id}/tts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
      } as any);
      return await (r as any).json();
    } catch { return {}; }
  })();
  return res.json({ generated: gen, tts });
});

// Per-spec: generate a single story by label 'H'|'N' (alias to our 'A'|'B')
router.post('/:id/generate-story', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const schema = z.object({ label: z.enum(['H','N']), targetWords: z.array(z.string()).min(1).max(10).optional(), topic: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const words = (parsed.data.targetWords || exp.targetWords || []).slice(0, 5);
  const oa = getOpenAI();
  let paragraphs: string[] = [];
  let occ: any[] = [];
  if (oa && words.length) {
    try {
      const r = await oa.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.8,
        messages: [
          { role: 'system', content: storySystem() },
          { role: 'user', content: storyUser(exp.cefr || exp.level || 'B1', words, parsed.data.topic || '') }
        ]
      });
      const text = r.choices?.[0]?.message?.content || '{}';
      const data = JSON.parse(text);
      paragraphs = Array.isArray(data?.story?.paragraphs) ? data.story.paragraphs.slice(0,5) : [];
      occ = Array.isArray(data?.story?.occurrences) ? data.story.occurrences : [];
    } catch {}
  }
  // Fallback to local generator if LLM failed
  if (!paragraphs.length) {
    const base = (title: string) => {
      const paras: string[] = [];
      for (let p = 0; p < 5; p++) {
        const s = (i: number) => `${title} â€” paragraph ${p+1}, sentence ${i+1}.`;
        paras.push(`${s(0)} ${s(1)} ${s(2)} ${s(3)}`);
      }
      return paras;
    };
    const inject = (paras: string[], words: string[]) => {
      const sentences = paras.flatMap(p => p.split(/(?<=\.)\s+/));
      const available = Array.from({ length: sentences.length }, (_, i) => i);
      const occ: any[] = [];
      for (const w of words) {
        for (let k = 0; k < 4; k++) {
          const idx = available.splice(Math.floor(Math.random()*available.length), 1)[0];
          const paragraphIndex = Math.floor(idx/4);
          const sentenceIndex = idx%4;
          const before = sentences[idx];
          const insertion = ` ${w}`;
          const charStart = before.length;
          const charEnd = charStart + insertion.length;
          sentences[idx] = before + insertion + '.';
          occ.push({ word: w, paragraphIndex, sentenceIndex, charStart, charEnd });
        }
      }
      const rebuilt: string[] = [];
      for (let i = 0; i < sentences.length; i += 4) rebuilt.push(`${sentences[i]} ${sentences[i+1]} ${sentences[i+2]} ${sentences[i+3]}`.trim());
      return { paragraphs: rebuilt, occ };
    };
    const resLoc = inject(base(exp.title), words);
    paragraphs = resLoc.paragraphs; occ = resLoc.occ;
  }
  const map = parsed.data.label === 'H' ? 'A' : 'B';
  const s = await Story.findOneAndUpdate({ experiment: exp._id, label: map }, { experiment: exp._id, label: map, paragraphs, targetOccurrences: occ }, { upsert: true, new: true });
  const patch: any = parsed.data.label === 'H' ? { 'stories.H': s._id } : { 'stories.N': s._id };
  await Experiment.findByIdAndUpdate(exp._id, patch);
  return res.json({ ok: true, storyId: s._id });
});

router.post('/:id/launch', requireAuth, requireRole('teacher'), async (req, res) => {
  const schema = z.object({ condition: z.enum(['with-hints','without-hints']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exp = await Experiment.findByIdAndUpdate(req.params.id, { assignedCondition: parsed.data.condition }, { new: true });
  if (!exp) return res.status(404).json({ error: 'Not found' });
  return res.json({ code: exp.classCode, condition: exp.assignedCondition });
});

router.post('/:id/tts', requireAuth, requireRole('teacher'), async (req, res) => {
  const schema = z.object({ label: z.enum(['A','B','H','N']).optional() });
  const parsed = schema.safeParse(req.body);
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const oa = getOpenAI();
  const fs = await import('fs');
  const path = await import('path');
  const outBase = path.join(process.cwd(), 'static', 'audio', String(exp._id));
  fs.mkdirSync(outBase, { recursive: true });

  function splitSentences(paragraphs: string[]): string[][] {
    const byP: string[][] = [];
    for (const p of paragraphs) {
      const parts: string[] = [];
      const re = /([^.!?]*[.!?])/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p))) parts.push(m[1].trim());
      if (parts.length === 0 && p.trim()) parts.push(p.trim());
      byP.push(parts);
    }
    return byP;
  }

    async function genFor(labelIn: 'H'|'N'|'A'|'B') {
      const map = (labelIn === 'H') ? 'A' : (labelIn === 'N') ? 'B' : labelIn;
      const story = await Story.findOne({ experiment: exp._id, label: map as any });
      if (!story) return null;
    const byP = splitSentences(story.paragraphs || []);
    const segmentsByParagraph: string[][] = [];
    if (oa) {
      for (let p = 0; p < byP.length; p++) {
        const segUrls: string[] = [];
        for (let s = 0; s < byP[p].length; s++) {
          const text = byP[p][s];
          try {
            const resp = await oa.audio.speech.create({ model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice: process.env.OPENAI_TTS_VOICE || 'nova', input: text } as any);
            const buf = Buffer.from(await resp.arrayBuffer());
            const file = path.join(outBase, `${labelIn}_p${p}_s${s}.mp3`);
            fs.writeFileSync(file, buf);
            const rel = `/static/audio/${exp._id}/${labelIn}_p${p}_s${s}.mp3`;
            segUrls.push(rel);
          } catch {}
        }
        segmentsByParagraph.push(segUrls);
      }
      // Also write a concatenated file for convenience
      const flatFiles: string[] = [];
      for (let p = 0; p < segmentsByParagraph.length; p++)
        for (let s = 0; s < segmentsByParagraph[p].length; s++)
          flatFiles.push(path.join(outBase, `${labelIn}_p${p}_s${s}.mp3`));
        try {
          const full = Buffer.concat(flatFiles.filter(f=>fs.existsSync(f)).map(f=>fs.readFileSync(f)));
          fs.writeFileSync(path.join(outBase, `${labelIn}.mp3`), full);
        } catch {}
        const fullUrl = `/static/audio/${exp._id}/${labelIn}.mp3`;
        try { await Story.updateOne({ _id: story._id }, { ttsAudioUrl: fullUrl }); } catch {}
        return { segmentsByParagraph, url: fullUrl };
      }
    // Mock: write empty files to make URLs resolvable
    for (let p = 0; p < byP.length; p++) {
      const segUrls: string[] = [];
      for (let s = 0; s < byP[p].length; s++) {
        const file = path.join(outBase, `${labelIn}_p${p}_s${s}.mp3`);
        fs.writeFileSync(file, Buffer.alloc(0));
        segUrls.push(`/static/audio/${exp._id}/${labelIn}_p${p}_s${s}.mp3`);
      }
      segmentsByParagraph.push(segUrls);
    }
      const fullUrl = `/static/audio/${exp._id}/${labelIn}.mp3`;
      try { await Story.updateOne({ _id: story._id }, { ttsAudioUrl: fullUrl }); } catch {}
      return { segmentsByParagraph, url: fullUrl };
    }

  if (parsed.success && parsed.data.label) {
    const data = await genFor(parsed.data.label as any);
    if (!data) return res.status(404).json({ error: 'Story not found' });
    return res.json({ label: parsed.data.label, ...data, used: oa ? 'openai' : 'mock' });
  } else {
    const [h, n] = await Promise.all([genFor('H'), genFor('N')]);
    return res.json({ H: h, N: n, used: oa ? 'openai' : 'mock' });
  }
});

// Get a single story (teacher preview)
router.get('/:id/story/:label', requireAuth, requireRole('teacher'), async (req, res) => {
  const { id, label } = req.params as any;
  const exp = await Experiment.findById(id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const map = label === 'H' ? 'A' : label === 'N' ? 'B' : label;
  const story = await Story.findOne({ experiment: exp._id, label: map });
  if (!story) return res.status(404).json({ error: 'Story not found' });
  // Try to compute a default tts url path
  const ttsUrl = `/static/audio/${exp._id}/${label}.mp3`;
  return res.json({ id: story._id, label, paragraphs: story.paragraphs, ttsAudioUrl: story.ttsAudioUrl || ttsUrl });
});

// Delete an experiment and related data
router.delete('/:id', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  try {
    const exp = await Experiment.findOne({ _id: req.params.id, owner: req.user?.sub });
    if (!exp) return res.status(404).json({ error: 'Not found' });
    const { default: fs } = await import('fs');
    const { default: path } = await import('path');

    // Delete stories
    await Story.deleteMany({ experiment: exp._id });
    // Optionally delete related assignments/conditions if installed
    try {
      const { Condition } = await import('../models/Condition');
      const { Assignment } = await import('../models/Assignment');
      await Condition.deleteMany({ experiment: exp._id } as any);
      await Assignment.deleteMany({ experiment: exp._id } as any);
    } catch {}
    // Remove audio dir
    try { fs.rmSync(path.join(process.cwd(), 'static', 'audio', String(exp._id)), { recursive: true, force: true }); } catch {}
    // Delete experiment
    await exp.deleteOne();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Delete failed' });
  }
});

router.post('/:id/status', requireAuth, requireRole('teacher'), async (req, res) => {
  const schema = z.object({ status: z.enum(['live','closed']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exp = await Experiment.findByIdAndUpdate(req.params.id, { status: parsed.data.status }, { new: true });
  if (!exp) return res.status(404).json({ error: 'Not found' });
  res.json({ id: exp._id, status: exp.status });
});

router.get('/', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const list = await Experiment.find({ owner: req.user?.sub }).sort({ updatedAt: -1 }).limit(50);
  res.json(list.map(x => ({
    id: x._id,
    title: x.title,
    cefr: x.cefr || x.level,
    status: x.status,
    code: x.classCode,
    targetWords: (x.targetWords || []).slice(0, 10),
    hasH: !!(x as any).stories?.H,
    hasN: !!(x as any).stories?.N,
  })));
});

// Aliases for spec URLs
router.post('/:id/word-suggestions', requireAuth, requireRole('teacher'), (req, res) => (router as any).handle({ ...req, url: `/api/experiments/${req.params.id}/suggestions` } as any, res));
router.post('/:id/words', requireAuth, requireRole('teacher'), (req, res) => (router as any).handle({ ...req, url: `/api/experiments/${req.params.id}/target-words` } as any, res));

// Simple demo endpoints used by client Demo pages
router.get('/demo', async (_req, res) => {
  // Return a synthetic list for now
  const list = await Experiment.find({}).sort({ createdAt: -1 }).limit(5).select('_id title level targetWords');
  const items = list.map(e => ({ id: String(e._id), title: e.title, level: e.level, targetWordsCount: (e.targetWords || []).length, description: '' }));
  res.json(items);
});

router.post('/:id/demo-start', async (req, res) => {
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const stories = await Story.find({ experiment: exp._id }).sort({ label: 1 });
  const schedule: Record<string, any> = {};
  const allOcc = stories.flatMap(s => (s.targetOccurrences || []).map(o => ({ ...o, story: s.label })));
  const byWord = new Map<string, any[]>();
  for (const o of allOcc) { const arr = byWord.get(o.word) || []; arr.push(o); byWord.set(o.word, arr); }
  for (const w of exp.targetWords) {
    const arr = (byWord.get(w) || []).slice(0,4).sort((a,b)=> (a.paragraphIndex - b.paragraphIndex) || (a.sentenceIndex - b.sentenceIndex));
    schedule[w] = arr.map((o, i) => ({ story: o.story, occurrence: i+1, paragraphIndex: o.paragraphIndex, sentenceIndex: o.sentenceIndex }));
  }
  // Default to with-hints for demo
  return res.json({ experiment: { id: String(exp._id), title: exp.title, level: exp.level, targetWords: exp.targetWords }, condition: 'with-hints', stories, schedule });
});

export default router;

