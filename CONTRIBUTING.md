# Contributing

Thanks for helping improve Spell Wise. This doc covers local setup, style, and PRs.

## Local Setup
- Node.js 18+ and npm
- (Optional) MongoDB for persistence; otherwise the server starts in a limited demo mode
- (Optional) OpenAI API key for story generation and TTS

Quick start:
- `./scripts/first-run.ps1` (Windows PowerShell) to install deps and create `server/.env` placeholders
- `./scripts/dev.ps1` to start both server and client

## Dev Commands
- Server: `cd server && npm run dev` (Express + TS, hot-reload)
- Client: `cd client && npm run dev` (Vite + React + Tailwind)

## Style
- TypeScript (strict), React with functional components
- Tailwind utility classes for layout; shared classes in `client/src/styles.css` (`.btn`, `.input`, `.focus-card`)
- Keep components small and composable; avoid inline styling unless very simple

## Commits / PRs
- Conventional-ish messages are appreciated: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- Include a brief description of user-facing changes and how to test
- Never commit real secrets; use `server/.env.example` if you want to illustrate variables

## Testing changes
- Prefer minimal, focused changes that you can validate manually in the UI
- For API changes, add a short note in the PR with curl examples or steps to reproduce

## Audio & Assets
- TTS output is generated into `server/static/audio/{experimentId}/{label}.mp3` and is ignored in git
- If you need to share audio samples in a PR, consider a temporary link rather than committing binaries

## Questions
- Open a GitHub issue with a concise description and reproduction steps

