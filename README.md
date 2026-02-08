# SpellWise

SpellWise is a modern, AI-powered platform for spelling experiments and practice. It provides teachers with tools to generate context-aware stories and high-quality audio, while offering students an interactive, feedback-rich learning environment.

---

## 🚀 Key Features

### For Teachers
- **AI-Powered Authoring:** Generate spelling experiments based on CEFR levels and specific topics.
- **Story Generation:** Automatically create contextually relevant stories in "Help" (practice) and "No Help" (test) versions.
- **Text-to-Speech (TTS):** Generate high-quality audio for stories and target words using OpenAI's TTS.
- **Analytics & Telemetry:** Track student progress, effort, and performance with detailed analytics.

### For Students
- **Interactive Spelling Tasks:** Participate in spelling exercises with immediate positional feedback.
- **Adaptive Hints:** Receive AI-generated hints that guide without revealing the full answer.
- **Auditory Learning:** Seamless integration of audio cues and story narration.
- **Accessibility:** Built-in support for text scaling and keyboard shortcuts.

---

## 🛠 Tech Stack

### Frontend
- **Framework:** React 18 with Vite
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Styling:** Tailwind CSS
- **Internationalization:** i18next

### Backend
- **Runtime:** Node.js + Express
- **Language:** TypeScript
- **Database:** MongoDB + Mongoose
- **AI Integration:** OpenAI (GPT-4o, TTS-1)
- **Validation:** Zod
- **Documentation:** Swagger / OpenAPI

### Shared
- **Package:** `@spellwise/shared` for unified TypeScript types and interfaces across the monorepo.

---

## 📂 Project Structure

```text
SpellWise/
├── client/           # React frontend application
├── server/           # Express backend API
├── shared/           # Shared TypeScript types and utilities
├── scripts/          # PowerShell helper scripts for development
├── docs/             # Architecture and integration documentation
└── static/           # Static assets and generated audio files
```

---

## ⚡ Quick Start

### Prerequisites
- **Node.js:** v18 or higher
- **MongoDB:** A local instance or MongoDB Atlas URI (optional for demo, required for persistence)
- **OpenAI API Key:** Required for story generation and TTS features

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-repo/SpellWise.git
   cd SpellWise
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file in the `server/` directory (refer to `server/.env.example` for all required variables).
   ```env
   PORT=4000
   MONGO_URI=mongodb://localhost:27017/spellwise
   JWT_ACCESS_SECRET=your_secret_key
   OPENAI_API_KEY=sk-...
   ```

### Running the Application

Start the development servers for both client and server concurrently:
```bash
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **API Documentation:** [http://localhost:4000/api-docs](http://localhost:4000/api-docs)

---

## ⌨️ Keyboard Shortcuts

- **`H`**: Toggle Help Overlay
- **`Ctrl/Cmd +`**: Increase Text Scale
- **`Ctrl/Cmd -`**: Decrease Text Scale

---

## 📄 License

This project is an internal prototype for research and educational purposes.