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
  const capped = parsed.data.targetWords.slice(0, 5);
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
  const schema = z.object({ cefr: z.string().optional(), targetWords: z.array(z.string()).min(1).max(10), topic: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const words = parsed.data.targetWords.slice(0, 5);
  const oa = getOpenAI();

  async function genOne(label: 'H'|'N') {
    let paragraphs: string[] = [];
    let occ: any[] = [];
    if (oa) {
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
      } catch {}
    }
    // minimal fallback if LLM fails
    if (!paragraphs.length) {
      const paras = Array.from({ length: 5 }, (_, p) => `Paragraph ${p+1}.`);
      paragraphs = paras;
      occ = words.flatMap(w => [0,1,2,3].map(k => ({ word: w, paragraphIndex: k%5, sentenceIndex: 0, charStart: paras[k%5].length, charEnd: paras[k%5].length + w.length })));
    }
    const map = label === 'H' ? 'A' : 'B';
    const s = await Story.findOneAndUpdate({ experiment: exp._id, label: map }, { experiment: exp._id, label: map, paragraphs, targetOccurrences: occ }, { upsert: true, new: true });
    return s;
  }

  const [sH, sN] = await Promise.all([genOne('H'), genOne('N')]);
  await Experiment.findByIdAndUpdate(exp._id, { stories: { H: sH._id, N: sN._id } });
  return res.json({ ok: true, used: 'openai', wordsCount: words.length, stories: { H: sH._id, N: sN._id } });
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
        const s = (i: number) => `${title} — paragraph ${p+1}, sentence ${i+1}.`;
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
  const schema = z.object({ label: z.enum(['A','B','H','N']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { label } = parsed.data;
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const map = label === 'H' ? 'A' : label === 'N' ? 'B' : label;
  const story = await Story.findOne({ experiment: exp._id, label: map as any });
  if (!story) return res.status(404).json({ error: 'Story not found' });
  const oa = getOpenAI();
  const fs = await import('fs');
  const path = await import('path');
  const outDir = path.join(process.cwd(), 'static', 'audio', String(exp._id));
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${label}.mp3`);
  try {
    if (oa) {
      const resp = await oa.audio.speech.create({ model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice: process.env.OPENAI_TTS_VOICE || 'nova', input: story.paragraphs.join('\n\n') } as any);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(outPath, buf);
      const rel = `/static/audio/${exp._id}/${label}.mp3`;
      return res.json({ url: rel, used: 'openai' });
    }
  } catch {}
  // mock beep wav
  const wav = Buffer.alloc(44);
  fs.writeFileSync(outPath, wav);
  const rel = `/static/audio/${exp._id}/${label}.mp3`;
  return res.json({ url: rel, used: 'mock' });
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
  res.json(list.map(x => ({ id: x._id, title: x.title, cefr: x.cefr || x.level, status: x.status, code: x.classCode })));
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
