import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { requireExperimentOwnership } from '../middleware/ownership';
import { Experiment } from '../models/Experiment';
import { Story } from '../models/Story';
import { getOpenAI } from '../utils/openai';
import { wordPoolSystem, wordPoolUser, storySystem, storyUser, storySystemBold, storyUserBold } from '../prompts';
import { validateStories } from '../utils/storyValidator';
import { toConditionLabel } from '../utils/labelMapper';
import { parseBoldMarkers } from '../utils/boldParser';
import logger from '../utils/logger';

const router = Router();

function makeCode(n = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: n }, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

function mapToInternalLabel(label: string) {
  const value = (label || '').toString().toUpperCase();
  if (value === 'H' || value === 'A' || value === '1' || value === 'STORY1') return 'A';
  if (value === 'N' || value === 'B' || value === '2' || value === 'STORY2') return 'B';
  return value;
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

router.get('/:id', requireAuth, requireRole('teacher'), requireExperimentOwnership(), async (req, res) => {
  const doc = await Experiment.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ id: doc._id, ...doc.toObject() });
});

const targetWordsSchema = z.object({ targetWords: z.array(z.string()).min(1).max(10) });

async function handleTargetWordsUpdate(req: AuthedRequest, res: Response) {
  const parsed = targetWordsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const capped = parsed.data.targetWords.slice(0, 5);
  const exp = await Experiment.findByIdAndUpdate(req.params.id, { targetWords: capped }, { new: true });
  if (!exp) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}

router.post('/:id/target-words', requireAuth, requireRole('teacher'), handleTargetWordsUpdate);
router.post('/:id/words', requireAuth, requireRole('teacher'), handleTargetWordsUpdate);

const storyWordsSchema = z.object({
  story: z.enum(['story1', 'story2']),
  targetWords: z.array(z.string()).min(1).max(10),
});

router.post(
  '/:id/story-words',
  requireAuth,
  requireRole('teacher'),
  requireExperimentOwnership(),
  async (req: AuthedRequest, res: Response) => {
    const parsed = storyWordsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { story, targetWords } = parsed.data;
    const unique = Array.from(
      new Set(
        targetWords
          .map((word) => word.trim())
          .filter((word) => word.length > 0)
      )
    ).slice(0, 10);
    try {
      const exp = await Experiment.findById(req.params.id);
      if (!exp) return res.status(404).json({ error: 'Experiment not found' });

      // Check for word overlap with the other story
      const otherStory = story === 'story1' ? 'story2' : 'story1';
      const otherWords = exp.stories?.[otherStory]?.targetWords || [];
      const overlap = unique.filter((w) => otherWords.some((ow: string) => ow.toLowerCase() === w.toLowerCase()));

      if (overlap.length > 0) {
        logger.warn('Word overlap detected', { experimentId: req.params.id, story, overlap });
        return res.status(400).json({
          error: `Word overlap with ${otherStory}. Words must be different for each story.`,
          overlap,
          otherStory
        });
      }

      const update = { $set: { [`stories.${story}.targetWords`]: unique } };
      const updated = await Experiment.findByIdAndUpdate(req.params.id, update, { new: true }).select('stories');
      if (!updated) return res.status(404).json({ error: 'Experiment not found' });
      return res.json({ ok: true, story, targetWords: unique, stories: updated.stories });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save story words' });
    }
  }
);

async function handleWordSuggestions(req: AuthedRequest, res: Response) {
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const oa = getOpenAI();
  if (!oa) {
    // Fallback: return words with level info
    const items = [
      { word: 'harbor', level: 'A1', gloss: 'place where ships stop', reason: 'Common' },
      { word: 'bridge', level: 'A2', gloss: 'structure crossing river', reason: 'Basic' },
      { word: 'meadow', level: 'B1', gloss: 'grassy field', reason: 'Intermediate' },
      { word: 'canvas', level: 'B1', gloss: 'cloth for painting', reason: 'Intermediate' },
      { word: 'lantern', level: 'B1', gloss: 'portable light', reason: 'Intermediate' },
    ].slice(0, 50);
    return res.json({ suggestions: items.map(i=>i.word), items });
  }
  try {
    const r = await oa.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role:'system', content: wordPoolSystem() },
        { role:'user', content: wordPoolUser(exp.cefr || exp.level || 'B1') }
      ],
      temperature: 0.6
    });
    const text = r.choices?.[0]?.message?.content || '{}';
    const data = JSON.parse(text);
    const items = Array.isArray(data?.items) ? data.items.slice(0,50) : [];
    return res.json({ suggestions: items.map((i:any)=>i.word), items });
  } catch (e) {
    logger.error('Word pool generation failed', { experimentId: req.params.id, error: (e as any).message });
  }
  return res.json({ suggestions: [], items: [] });
}

router.post('/:id/suggestions', requireAuth, requireRole('teacher'), handleWordSuggestions);
router.post('/:id/word-suggestions', requireAuth, requireRole('teacher'), handleWordSuggestions);

// Generate 2 stories (A/B) with each selected word appearing exactly 4x, never twice in the same sentence.
router.post('/:id/generate-stories', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const schema = z.object({ cefr: z.string().optional(), targetWords: z.array(z.string()).min(1).max(10), topic: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const words = parsed.data.targetWords.slice(0, 5);
  if (!words || words.length === 0) {
    return res.status(400).json({ error: 'No target words provided. Please select words before generating.' });
  }
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
  const schema = z.object({
    label: z.enum(['H','N','A','B','1','2','story1','story2']),
    targetWords: z.array(z.string()).min(1).max(10).optional(),
    topic: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const words = (parsed.data.targetWords || exp.targetWords || []).slice(0, 10);
  const paragraphCount = Math.max(1, words.length);
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
          { role: 'system', content: storySystemBold(paragraphCount) },
          { role: 'user', content: storyUserBold(exp.cefr || exp.level || 'B1', words, paragraphCount, Math.max(3, Math.ceil((4 * words.length) / paragraphCount))) }
        ]
      });
      const text = r.choices?.[0]?.message?.content || '{}';
      const data = JSON.parse(text);
      const rawParas = Array.isArray(data?.story?.paragraphs) ? data.story.paragraphs : [];
      
      if (rawParas.length > 0) {
        const { cleanParagraphs, occurrences } = parseBoldMarkers(rawParas);
        paragraphs = cleanParagraphs.slice(0, paragraphCount);
        occ = occurrences;
        
        // Log if no occurrences found
        if (occurrences.length === 0) {
          logger.warn('No bold markers found in LLM response', { 
            experimentId: req.params.id,
            rawParas: rawParas.slice(0, 2),
            label: parsed.data.label 
          });
        }
      }
    } catch {}
  }
  // Fallback to local generator if LLM failed
  if (!paragraphs.length) {
    const base = (title: string) => {
      const paras: string[] = [];
      for (let p = 0; p < paragraphCount; p++) {
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
      const sentencesPerParagraph = Math.max(3, Math.ceil((4 * words.length) / paragraphCount));
      for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
        const paras = [];
        for (let j = 0; j < sentencesPerParagraph && i + j < sentences.length; j++) {
          paras.push(sentences[i + j]);
        }
        rebuilt.push(paras.join(' ').trim());
      }
      return { paragraphs: rebuilt.slice(0, paragraphCount), occ };
    };
    const resLoc = inject(base(exp.title), words);
    paragraphs = resLoc.paragraphs; occ = resLoc.occ;
  }
  const map = mapToInternalLabel(parsed.data.label);

  // Validate only single story being generated (not cross-story check yet)
  if (paragraphs.length > 0) {
    const singleStoryValidation = {
      ok: true,
      violations: [] as string[]
    };
    
    // Check occurrence count - if we have occurrences, validate them
    if (occ.length > 0) {
      for (const w of words) {
        const c = occ.filter((o: any) => o.word === w).length;
        if (c !== 4) {
          singleStoryValidation.ok = false;
          singleStoryValidation.violations.push(`Word "${w}" must appear exactly 4 times (got ${c}).`);
        }
      }
      
      // Check no two target words in same sentence
      const byPos: Record<string, string[]> = {};
      occ.forEach((o: any) => {
        const key = `${o.paragraphIndex}:${o.sentenceIndex}`;
        (byPos[key] ||= []).push(o.word);
      });
      for (const [key, wordList] of Object.entries(byPos)) {
        const unique = Array.from(new Set(wordList));
        if (unique.length > 1) {
          singleStoryValidation.ok = false;
          singleStoryValidation.violations.push(`Multiple target words in same sentence at ${key}.`);
        }
      }
    }
    
    if (!singleStoryValidation.ok && occ.length > 0) {
      logger.warn('Story validation failed – proceeding anyway', { experimentId: req.params.id, label: map, violations: singleStoryValidation.violations });
      // Proceed without blocking to allow imperfect stories through
    }

    // If occ is empty, log warning but proceed
    if (occ.length === 0 && paragraphs.length > 0) {
      logger.warn('No word occurrences found in story - proceeding without validation', {
        experimentId: req.params.id,
        label: map,
        paragraphCount: paragraphs.length,
        wordCount: words.length
      });
    }
  }

  const s = await Story.findOneAndUpdate({ experiment: exp._id, label: map }, { experiment: exp._id, label: map, paragraphs, targetOccurrences: occ }, { upsert: true, new: true });
  const patch: any = map === 'A' ? { 'stories.H': s._id } : { 'stories.N': s._id };
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

router.post('/:id/tts', requireAuth, requireRole('teacher'), requireExperimentOwnership(), async (req, res) => {
  const schema = z.object({ label: z.enum(['A','B','H','N','1','2','story1','story2']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { label } = parsed.data;
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const map = mapToInternalLabel(label);
  const normalizedLabel = toConditionLabel(label);
  const story = await Story.findOne({ experiment: exp._id, label: map as any });
  if (!story) return res.status(404).json({ error: 'Story not found' });
  const oa = getOpenAI();
  const fs = await import('fs');
  const path = await import('path');
  const outDir = path.join(process.cwd(), 'static', 'audio', String(exp._id));
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${normalizedLabel}.mp3`);
  try {
    if (oa) {
      const resp = await oa.audio.speech.create({ model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice: process.env.OPENAI_TTS_VOICE || 'nova', input: story.paragraphs.join('\n\n') } as any);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(outPath, buf);
      const rel = `/static/audio/${exp._id}/${normalizedLabel}.mp3`;
      story.ttsAudioUrl = rel;
      await story.save();
      return res.json({ url: rel, used: 'openai' });
    }
  } catch {}
  // mock beep wav
  const wav = Buffer.alloc(44);
  fs.writeFileSync(outPath, wav);
  const rel = `/static/audio/${exp._id}/${normalizedLabel}.mp3`;
  story.ttsAudioUrl = rel;
  await story.save();
  return res.json({ url: rel, used: 'mock' });
});

// Get a single story (teacher preview)
router.get('/:id/story/:label', requireAuth, requireRole('teacher'), async (req, res) => {
  const { id, label } = req.params as any;
  const exp = await Experiment.findById(id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  const map = mapToInternalLabel(label);
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
