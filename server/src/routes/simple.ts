import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { getOpenAI } from '../utils/openai';
import { config } from '../config';

const router = Router();

// POST /api/simple/generate-story
// body: { level: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2', targetWords: string[] }
router.post('/generate-story', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const level = String(req.body?.level || 'B1');
  const targetWords: string[] = Array.isArray(req.body?.targetWords) ? req.body.targetWords.slice(0, 10) : [];
  if (!targetWords.length) return res.status(400).json({ error: 'Provide 1-10 target words.' });

  const oa = getOpenAI();
  let used: 'openai'|'mock' = 'mock';
  try {
    if (oa) {
      const system = `You are a helpful assistant. Return JSON only as { \"paragraphs\": string[] }.
Write a short educational story using each given target word at least once.
3 paragraphs, 4 sentences per paragraph, CEFR ${level}.`;
      const user = JSON.stringify({ level, targetWords });
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const r = await oa.chat.completions.create({ model, response_format: { type: 'json_object' }, messages: [ { role: 'system', content: system }, { role: 'user', content: user } ] });
      const text = r.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(text);
      const paragraphs = Array.isArray(parsed?.paragraphs) ? parsed.paragraphs.slice(0, 10) : [];
      if (paragraphs.length > 0) { used = 'openai'; return res.json({ ok: true, used, paragraphs }); }
    }
  } catch {}

  // Mock fallback
  const paragraphs: string[] = [];
  for (let p = 0; p < 3; p++) {
    const sent = (i: number) => `Paragraph ${p+1}, sentence ${i+1}.`;
    paragraphs.push(`${sent(0)} ${sent(1)} ${sent(2)} ${sent(3)}`);
  }
  return res.json({ ok: true, used, paragraphs });
});

export default router;

// POST /api/simple/tts
// body: { paragraphs: string[] }
router.post('/tts', requireAuth, requireRole('teacher'), async (req: AuthedRequest, res) => {
  const paragraphs: string[] = Array.isArray(req.body?.paragraphs) ? req.body.paragraphs : [];
  if (!paragraphs.length) return res.status(400).json({ error: 'Provide paragraphs to synthesize.' });

  const urls: string[] = [];
  // Try OpenAI TTS when available
  if (config.openaiApiKey) {
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: config.openaiApiKey });
      for (const p of paragraphs) {
        const seg: any = await openai.audio.speech.create({ model: config.openaiTtsModel || 'gpt-4o-mini-tts', voice: config.openaiTtsVoice || 'alloy', input: p, format: 'mp3' } as any);
        const buf = Buffer.from(await seg.arrayBuffer());
        const dataUrl = `data:audio/mpeg;base64,${buf.toString('base64')}`;
        urls.push(dataUrl);
      }
      return res.json({ ok: true, used: 'openai', urls });
    } catch (e) {
      // fall through to mock
    }
  }
  // Mock: tiny WAV tone for each paragraph
  function toneWavBase64() {
    const duration = 0.25, sampleRate = 22050, numSamples = Math.floor(duration * sampleRate), freq = 880;
    const header = Buffer.alloc(44 + numSamples * 2);
    header.write('RIFF', 0); header.writeUInt32LE(36 + numSamples * 2, 4); header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
    header.write('data', 36); header.writeUInt32LE(numSamples * 2, 40);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate; const sample = Math.round(Math.sin(2 * Math.PI * freq * t) * 32767);
      header.writeInt16LE(sample, 44 + i * 2);
    }
    return `data:audio/wav;base64,${header.toString('base64')}`;
  }
  for (let i = 0; i < paragraphs.length; i++) urls.push(toneWavBase64());
  return res.json({ ok: true, used: 'mock', urls });
});
