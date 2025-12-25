import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/spellwise',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
  allowRefreshTokenInResponse:
    (process.env.ALLOW_REFRESH_IN_RESPONSE || '').toLowerCase() === 'true' ||
    process.env.NODE_ENV !== 'production',

  // Auth
  devNoAuth: process.env.DEV_NO_AUTH === 'true',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  internalJobSecret: process.env.INTERNAL_JOB_SECRET || 'dev-internal-job',

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openaiTtsModel: process.env.OPENAI_TTS_MODEL || 'tts-1',
  openaiTtsVoice: process.env.OPENAI_TTS_VOICE || 'alloy',

  // TTS provider selection
  ttsProvider: (process.env.TTS_PROVIDER || 'openai') as 'openai' | 'elevenlabs' | 'mock',
  elevenApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenVoiceId: process.env.ELEVENLABS_VOICE_ID || '',
  elevenModelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
};

export function validateConfig() {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!config.openaiApiKey)
    warnings.push('OPENAI_API_KEY not set - using fallback story generation');
  if (!config.mongoUri) warnings.push('MONGO_URI not set - persistence disabled');

  if (process.env.NODE_ENV === 'production') {
    if (config.jwtAccessSecret === 'dev_access_secret')
      errors.push('JWT_ACCESS_SECRET must be set in production');
    if (config.jwtRefreshSecret === 'dev_refresh_secret')
      errors.push('JWT_REFRESH_SECRET must be set in production');
  }

  return { warnings, errors, ok: errors.length === 0 };
}
