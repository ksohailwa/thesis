# Spell Wise (Local)

A minimal Teacher/Student web app for spelling experiments.

- Stack: Node + Express + TypeScript, MongoDB (optional), React + Vite + Tailwind, OpenAI
- Stories and TTS can run with OpenAI; mock fallbacks are provided when keys are missing.

## Prerequisites
- Node.js 18+
- (Optional) MongoDB running locally or Atlas URI
- (Optional, recommended) OpenAI API key for story generation + TTS

## Setup
1) Install dependencies
```
cd server && npm i
cd ../client && npm i
```

2) Configure server env
Create `server/.env` (or copy from `.env.example`) and set these values:
```
PORT=4000
MONGO_URI=mongodb://localhost:27017/spellwise
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me_2
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
# TTS
TTS_PROVIDER=openai
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=nova
# CORS
APP_BASE_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```
Notes:
- If `OPENAI_API_KEY` is not set, story/tts endpoints use safe, minimal fallbacks.
- If `MONGO_URI` is not set or fails, the server starts without DB persistence (demo only).

3) Run dev
Open two terminals:
```
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```
App: http://localhost:5173  API: http://localhost:4000

## Teacher Flow (UI)
- Login (/login) → “Teacher Login” (same login page)
- Create experiment → title + CEFR
- Word suggestions (LLM) → pick up to 5 (UI caps at 5)
- Generate stories (OpenAI, H/N) → preview paragraphs
- Generate TTS per story → MP3 saved under `/server/static/audio/{experimentId}/{label}.mp3`
- Launch → receive join code for students

## Student Flow (UI)
- Login or Demo → /student/join → enter code
- Runs assigned story (H or N)
  - Hints: allowed for H; not allowed for N
  - Occurrence rules: 1=prior (hints on), 2–3=practice (hints in H), 4=recall (no hints)
- Minimal audio player: play/pause, ±3s

## Client Routes (minimal)
- Public: `/`, `/login`, `/signup`, `/demo`
- Teacher: `/teacher/experiments`, `/teacher/experiments/:id/words`
- Student: `/student/join`, `/student/run`

## API Overview
Auth
- POST `/api/auth/signup`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
- Demo token: POST `/api/auth/demo` (or `/api/demo/login`)

Experiments (Teacher)
- POST `/api/experiments` { title, cefr } → create (returns join code)
- POST `/api/experiments/:id/suggestions` → CEFR word pool (JSON-only prompt)
- POST `/api/experiments/:id/target-words` { targetWords[] <= 5 }
- POST `/api/experiments/:id/generate-stories` { cefr?, targetWords[] <=5, topic? } → OpenAI stories H & N
- POST `/api/experiments/:id/generate-story` { label:'H'|'N', targetWords?, topic? } → one story
- GET  `/api/experiments/:id/story/:label` → story preview (paragraphs)
- POST `/api/experiments/:id/tts` { label:'H'|'N' } → save MP3 to `/static/audio/{expId}/{label}.mp3`
- POST `/api/experiments/:id/status` { status:'live'|'closed' }
- GET  `/api/experiments` (mine), GET `/api/experiments/:id`

Student
- POST `/api/student/join` { code } → assign H or N (respects teacher launch choice)
- POST `/api/student/attempt` → record attempt; returns positional feedback when H
- POST `/api/student/hint` (H only; 1–3) → single-line hint JSON
- POST `/api/student/events` → telemetry batch

Demo
- GET `/api/demo` → recent experiments (for demo list)

## Static Audio
- Generated TTS files are served from:
  - URL: `/static/audio/{experimentId}/{label}.mp3`
  - Filesystem: `server/static/audio/{experimentId}/{label}.mp3`

## Development Notes
- Tailwind is configured via `client/tailwind.config.js` and `client/postcss.config.js`.
- Common UI utilities are in `client/src/styles.css` as `.btn`, `.input`, `.focus-card`, `.section`.
- The app supports keyboard shortcuts:
  - `H` toggle Help  ·  `T` toggle Theme  ·  `Ctrl/Cmd +` or `-` adjust text scale

## Troubleshooting
- If the UI looks unstyled, ensure Tailwind dev deps are installed and the client dev server restarted.
- If TTS fails, verify `OPENAI_API_KEY` and that the model/voice are set: `gpt-4o-mini-tts` + `nova`.
- If Mongo isn’t running, server logs a warning and continues; persistence will be limited.

## License
Internal prototype for research/education. Add a license before publishing.

