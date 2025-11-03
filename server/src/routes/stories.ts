import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { StoryTemplate } from '../models/StoryTemplate';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import OpenAI from 'openai';

const router = Router();

const GapPolicySchema = z.object({
  occurrencesPerWord: z.number().int().min(1).max(8).optional(),
  randomize: z.boolean().optional(),
  distractors: z.object({ count: z.number().int().min(0), strategy: z.enum(['frequency','pos','random']) }).optional()
}).partial();

const StorySchema = z.object({
  title: z.string().min(1),
  language: z.string().min(2),
  difficulty: z.enum(['A1','A2','B1','B2','C1','C2']),
  targetWords: z.array(z.string()).max(10),
  prompt: z.string().min(5),
  condition: z.enum(['self-generate','system-provided']),
  storyText: z.string().optional(),
  ttsAudioUrl: z.string().optional(),
  gapPolicy: GapPolicySchema.optional()
});

function mockStory(targetWords: string[], language: string) {
  const paras = [] as string[];
  const wordsOnce = targetWords.join(', ');
  const wordsTwice = targetWords.map(w => `${w}... ${w}`).join(' | ');
  paras.push(`This is a mock ${language} story including: ${wordsOnce}.`);
  paras.push(`Each target appears twice somewhere: ${wordsTwice}.`);
  paras.push('Add more details and context to feel realistic.');
  return paras.join('\n\n');
}

router.post('/generate', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const schema = z.object({ prompt: z.string(), difficulty: z.enum(['A1','A2','B1','B2','C1','C2']), language: z.string(), targetWords: z.array(z.string()).max(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { language, targetWords, prompt, difficulty } = parsed.data;
  if (!config.openaiApiKey) {
    const text = mockStory(targetWords, language);
    return res.json({ text, used: 'mock' });
  }
  try {
    const openai = new OpenAI({ apiKey: config.openaiApiKey });
    const sys = `You are a helpful language tutor.
Produce a ${language} short story at CEFR ${difficulty} level.
Requirements:
- Embed EACH target word exactly three times (3 occurrences total per word) in distinct sentences.
- Distribute occurrences evenly across the whole story; avoid clustering.
- Do NOT place multiple occurrences of the same target word in the same paragraph; spread them apart (e.g., early/middle/late).
- At most one target word occurrence per sentence. Avoid back-to-back sentences repeating the same target word.
- Keep the story to ~5 short paragraphs (2–3 sentences each), natural, coherent, and pedagogically useful.
- Separate paragraphs with a single blank line.
- Output ONLY the story text.`;
    const user = `Topic/prompt: ${prompt}
Target words: ${targetWords.join(', ')}
Language: ${language}
Difficulty: ${difficulty}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ],
      temperature: 0.8,
      max_tokens: 800
    });
    const text = completion.choices?.[0]?.message?.content?.trim() || mockStory(targetWords, language);
    return res.json({ text, used: 'openai' });
  } catch (err) {
    const text = mockStory(targetWords, language);
    return res.json({ text, used: 'mock', note: 'OpenAI failed; fell back to mock.' });
  }
});

// Generates a 1s 440Hz WAV as placeholder when no TTS
function writeBeepWav(filePath: string) {
  const duration = 1.0; // seconds
  const sampleRate = 44100;
  const numSamples = Math.floor(duration * sampleRate);
  const freq = 440;
  const data = Buffer.alloc(44 + numSamples * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + numSamples * 2, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.round(Math.sin(2 * Math.PI * freq * t) * 32767);
    data.writeInt16LE(sample, 44 + i * 2);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
}

router.post('/tts', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const schema = z.object({ storyTemplateId: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { storyTemplateId } = parsed.data;
  const tpl = await StoryTemplate.findById(storyTemplateId);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  const ensureDir = () => fs.mkdirSync(path.join(process.cwd(), 'static', 'audio', 'template'), { recursive: true });
  ensureDir();
  const relBase = `/static/audio/template/${tpl._id}`;
  if (!tpl.storyText) {
    const rel = `${relBase}.wav`;
    const outPath = path.join(process.cwd(), 'static', 'audio', 'template', `${tpl._id}.wav`);
    writeBeepWav(outPath);
    tpl.ttsAudioUrl = rel;
    await tpl.save();
    return res.json({ ttsAudioUrl: tpl.ttsAudioUrl, used: 'mock', note: 'No story text available' });
  }

  // Primary: OpenAI TTS (default)
    if (config.ttsProvider === 'openai' && config.openaiApiKey) {
      try {
        const openai = new OpenAI({ apiKey: config.openaiApiKey });
        const sentences = splitSentences(tpl.storyText);
        const segmentPaths: string[] = [];
        const segmentUrls: string[] = [];
        for (let i = 0; i < sentences.length; i++) {
          const seg = await openai.audio.speech.create({ model: config.openaiTtsModel, voice: config.openaiTtsVoice, input: sentences[i], format: 'mp3' } as any);
          const buf = Buffer.from(await seg.arrayBuffer());
          const relSeg = `${relBase}_s${i}.mp3`;
          const outSeg = path.join(process.cwd(), 'static', 'audio', 'template', `${tpl._id}_s${i}.mp3`);
          fs.writeFileSync(outSeg, buf);
          segmentPaths.push(outSeg);
          segmentUrls.push(relSeg);
        }
        // Concatenate segments into a single MP3 (simple byte concat; acceptable for most players)
        const fullBuf = Buffer.concat(segmentPaths.map(p => fs.readFileSync(p)));
        const rel = `${relBase}.mp3`;
        const outPath = path.join(process.cwd(), 'static', 'audio', 'template', `${tpl._id}.mp3`);
        fs.writeFileSync(outPath, fullBuf);
        tpl.ttsAudioUrl = rel;
        tpl.ttsSegments = segmentUrls;
        await tpl.save();
        return res.json({ ttsAudioUrl: tpl.ttsAudioUrl, segments: tpl.ttsSegments, used: 'openai' });
      } catch (err) {
        // Fall through to other providers if configured
      }
    }

  // Optional: ElevenLabs fallback if configured
  if (config.ttsProvider === 'elevenlabs' && config.elevenApiKey && config.elevenVoiceId) {
    try {
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.elevenVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': config.elevenApiKey,
          'Content-Type': 'application/json',
          'accept': 'audio/mpeg'
        },
        body: JSON.stringify({ text: tpl.storyText, model_id: config.elevenModelId, output_format: 'mp3_44100_128' })
      });
      if (!resp.ok) throw new Error(`ElevenLabs HTTP ${resp.status}`);
      const buf = Buffer.from(await (resp as any).arrayBuffer());
      const rel = `${relBase}.mp3`;
      const outPath = path.join(process.cwd(), 'static', 'audio', 'template', `${tpl._id}.mp3`);
      fs.writeFileSync(outPath, buf);
      tpl.ttsAudioUrl = rel;
      await tpl.save();
      return res.json({ ttsAudioUrl: tpl.ttsAudioUrl, used: 'elevenlabs' });
    } catch (_) {
      // ignore and fall to mock
    }
  }

  // Mock fallback
  const rel = `${relBase}.wav`;
  const outPath = path.join(process.cwd(), 'static', 'audio', 'template', `${tpl._id}.wav`);
  writeBeepWav(outPath);
  tpl.ttsAudioUrl = rel;
  tpl.ttsSegments = [];
  await tpl.save();
  return res.json({ ttsAudioUrl: tpl.ttsAudioUrl, used: 'mock' });
});

function splitSentences(text?: string): string[] {
  if (!text) return [];
  // Simple sentence splitter on ., !, ? keeping punctuation
  const parts: string[] = [];
  let cursor = 0;
  const re = /([^.!?]*[.!?])/g;
  const matchAll = text.matchAll(re);
  for (const m of matchAll) {
    parts.push(m[1].trim());
    cursor = (m.index || 0) + m[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor).trim());
  return parts.filter(Boolean);
}

// Quick endpoint to test ElevenLabs config with a short fixed text

router.post('/', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const parsed = StorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const doc = await StoryTemplate.create({ ...parsed.data, owner: req.user!.sub });
  return res.json(doc);
});

router.put('/:id', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const parsed = StorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await StoryTemplate.findOneAndUpdate({ _id: req.params.id, owner: req.user!.sub }, { ...parsed.data, updatedAt: new Date() }, { new: true });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  return res.json(updated);
});

router.get('/', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const list = await StoryTemplate.find({ owner: req.user!.sub }).sort({ updatedAt: -1 });
  res.json(list);
});

router.get('/:id', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const doc = await StoryTemplate.findOne({ _id: req.params.id, owner: req.user!.sub });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

// Delete a story template (teacher-owned) if unused
router.delete('/:id', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const id = req.params.id;
  const tpl = await StoryTemplate.findOne({ _id: id, owner: req.user!.sub });
  if (!tpl) return res.status(404).json({ error: 'Not found' });

  try {
    const { ClassSession } = await import('../models/ClassSession');
    const { Attempt } = await import('../models/Attempt');
    const { EffortResponse } = await import('../models/EffortResponse');
    const { Event } = await import('../models/Event');

    const sessions = await ClassSession.find({ template: tpl._id }).select('_id');
    const sessionIds = sessions.map(s => s._id);

    const audioDir = path.join(process.cwd(), 'static', 'audio', 'template');
    try {
      if (fs.existsSync(audioDir)) {
        const files = fs.readdirSync(audioDir);
        const prefix = String(tpl._id);
        for (const f of files) if (f.startsWith(prefix)) { try { fs.unlinkSync(path.join(audioDir, f)); } catch {} }
      }
    } catch {}

    const delAttemptsByTpl = await Attempt.deleteMany({ storyTemplate: tpl._id });
    const delAttemptsBySess = sessionIds.length ? await Attempt.deleteMany({ session: { $in: sessionIds } }) : { deletedCount: 0 } as any;
    const delEffort = sessionIds.length ? await EffortResponse.deleteMany({ session: { $in: sessionIds } }) : { deletedCount: 0 } as any;
    const delEvents = sessionIds.length ? await Event.deleteMany({ session: { $in: sessionIds } }) : { deletedCount: 0 } as any;
    const delSessions = await ClassSession.deleteMany({ template: tpl._id });
    const delTpl = await StoryTemplate.deleteOne({ _id: tpl._id });

    return res.json({
      ok: true,
      deleted: {
        template: delTpl.deletedCount || 0,
        sessions: delSessions.deletedCount || 0,
        attempts: (delAttemptsByTpl.deletedCount || 0) + (delAttemptsBySess.deletedCount || 0),
        effort: delEffort.deletedCount || 0,
        events: delEvents.deletedCount || 0,
      }
    });
  } catch (e) {
    console.error('Delete cascade failed', e);
    return res.status(500).json({ error: 'Delete failed' });
  }
});

router.post('/preview/demo', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const schema = z.object({ storyTemplateId: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tpl = await StoryTemplate.findById(parsed.data.storyTemplateId);
  if (!tpl) return res.status(404).json({ error: 'Not found' });
  const words = tpl.targetWords.slice(0, 2);
  const text = (tpl.storyText || '').split('\n').slice(0, 2).join('\n');
  return res.json({ text, targetWords: words, audioUrl: tpl.ttsAudioUrl });
});

router.post('/preview/try', requireAuth, requireRole('teacher'), async (req, res) => {
  const schema = z.object({ storyTemplateId: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tpl = await StoryTemplate.findById(parsed.data.storyTemplateId);
  if (!tpl) return res.status(404).json({ error: 'Not found' });
  return res.json({ sandbox: true, template: tpl });
});

export default router;
