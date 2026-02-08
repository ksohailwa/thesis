# Claude Integration Flow Diagram

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Teacher UI                                   │
│                  (StoryManager.tsx)                                  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Select Target Words                                      │      │
│  │  Story 1: [word1, word2, word3, word4, word5]           │      │
│  │  Story 2: [word6, word7, word8, word9, word10]          │      │
│  └──────────────────────────────────────────────────────────┘      │
│                           ↓                                          │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Choose AI Model:                                         │      │
│  │  ○ OpenAI (GPT)      [DEFAULT]                           │      │
│  │  ○ Anthropic (Claude)                                     │      │
│  └──────────────────────────────────────────────────────────┘      │
│                           ↓                                          │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  [Generate Both Stories]  ← Sends model + words          │      │
│  └──────────────────────────────────────────────────────────┘      │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ POST /api/experiments/:id/generate-stories
                                 │ { model: 'openai' | 'claude', targetWords: [...] }
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     Backend Route Handler                            │
│               (server/src/routes/experiments.ts)                     │
│                                                                       │
│  1. Validate request & extract model preference                     │
│  2. Get saved words or use provided words                           │
│  3. Split into Story 1 (H) and Story 2 (N) words                   │
│                           ↓                                          │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  genOne('H', words1)  │  genOne('N', words2)            │      │
│  │         ↓             │         ↓                         │      │
│  │   [Model Selection Logic]                                │      │
│  └──────────────────────────────────────────────────────────┘      │
└────────────────┬────────────────────────────────┬────────────────────┘
                 │                                │
                 ↓                                ↓
     ┌───────────────────────┐      ┌───────────────────────┐
     │  model === 'claude'?  │      │  model === 'openai'?  │
     └───────────┬───────────┘      └───────────┬───────────┘
                 │ YES                           │ YES
                 ↓                               ↓
     ┌───────────────────────┐      ┌───────────────────────┐
     │   getAnthropic()      │      │   getOpenAI()         │
     │   API Key exists?     │      │   API Key exists?     │
     └───────────┬───────────┘      └───────────┬───────────┘
                 │                               │
         ┌───────┴───────┐               ┌───────┴───────┐
         │ YES           │ NO            │ YES           │ NO
         ↓               ↓               ↓               ↓
┌──────────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐
│ Claude API   │  │ Try      │  │ OpenAI API   │  │ Fallback │
│              │  │ OpenAI   │  │              │  │ Story    │
│ Generate     │  │ Fallback │  │ Generate     │  │ Generator│
│ Story        │  │          │  │ Story        │  │          │
└──────┬───────┘  └────┬─────┘  └──────┬───────┘  └────┬─────┘
       │               │               │               │
       │  Success?     │               │  Success?     │
       └───────┬───────┘               └───────┬───────┘
               │                               │
        ┌──────┴───────┐               ┌───────┴──────┐
        │ YES          │ NO            │ YES          │ NO
        ↓              ↓               ↓              ↓
   ┌─────────┐  ┌──────────┐   ┌─────────┐  ┌──────────────┐
   │ Return  │  │ Try      │   │ Return  │  │ Fallback     │
   │ Story   │  │ OpenAI   │   │ Story   │  │ Story        │
   │         │  │ or       │   │         │  │ Generator    │
   │         │  │ Fallback │   │         │  │              │
   └────┬────┘  └────┬─────┘   └────┬────┘  └──────┬───────┘
        │            │              │              │
        └────────────┴──────────────┴──────────────┘
                           │
                           ↓
              ┌────────────────────────┐
              │ Validate Story:        │
              │ - 4 paragraphs?        │
              │ - Each word 4x?        │
              │ - Proper structure?    │
              └────────────┬───────────┘
                           │
                    ┌──────┴──────┐
                    │ Valid?      │
                    └──────┬──────┘
                    ┌──────┴──────┐
                    │ YES         │ NO
                    ↓             ↓
            ┌───────────┐  ┌─────────────────┐
            │ Save to   │  │ Use Fallback    │
            │ Database  │  │ Story Generator │
            └─────┬─────┘  └────────┬────────┘
                  │                 │
                  └────────┬────────┘
                           │
                           ↓
              ┌────────────────────────┐
              │ Return JSON Response:  │
              │ {                      │
              │   ok: true,            │
              │   used: 'openai|claude'│
              │   stories: {...}       │
              │ }                      │
              └────────────┬───────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         Teacher UI                                   │
│                                                                       │
│  ✅ Stories generated successfully!                                  │
│                                                                       │
│  ┌────────────────────────────┬────────────────────────────┐       │
│  │  Story 1 (with hints)      │  Story 2 (without hints)   │       │
│  │  [Preview paragraphs...]   │  [Preview paragraphs...]   │       │
│  │  Word counts: word1: 4...  │  Word counts: word6: 4...  │       │
│  └────────────────────────────┴────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

## API Flow Details

### 1. Request Format

```typescript
POST /api/experiments/:id/generate-stories
Content-Type: application/json

{
  "targetWords": ["word1", "word2", ..., "word10"],
  "model": "openai" | "claude",  // NEW: Model selection
  "cefr": "B1",                   // Optional
  "topic": "adventure"            // Optional
}
```

### 2. Claude API Call

```typescript
const response = await claude.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  messages: [
    {
      role: 'user',
      content: `${systemPrompt}\n\nUser request:\n${userPrompt}\n\nRespond with valid JSON only.`
    }
  ]
});
```

### 3. OpenAI API Call

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-5.2-2025-12-11',
  response_format: { type: 'json_object' },
  temperature: 0.8,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
});
```

### 4. Response Processing

Both APIs return stories in the same format:

```typescript
{
  "story": {
    "paragraphs": [
      "Paragraph 1 text...",
      "Paragraph 2 text...",
      "Paragraph 3 text...",
      "Paragraph 4 text..."
    ],
    "occurrences": [
      {
        "word": "target_word",
        "paragraphIndex": 0,
        "sentenceIndex": 0
      },
      // ... 15 more occurrences (4 per word × 4 words)
    ]
  },
  "validation": {
    "perWord": [...],
    "totalOccurrences": 16
  }
}
```

## Decision Tree

```
Teacher clicks "Generate Both Stories"
│
├─ Model = 'openai'
│  ├─ OpenAI API available? → YES → Generate with OpenAI
│  │                         → NO  → Use fallback generator
│  └─ Result
│
└─ Model = 'claude'
   ├─ Claude API available? → YES → Generate with Claude
   │                                 ├─ Success? → YES → Return Claude story
   │                                 └─ Failed?  → NO  → Try OpenAI fallback
   │                                                     ├─ OpenAI works? → Return OpenAI story
   │                                                     └─ OpenAI fails? → Use fallback generator
   └─ Claude API not available? → NO → Try OpenAI fallback
                                       ├─ OpenAI works? → Return OpenAI story
                                       └─ OpenAI fails? → Use fallback generator
```

## Environment Configuration

```env
# OpenAI (Primary option)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.2-2025-12-11

# Anthropic Claude (Alternative option)
ANTHROPIC_API_KEY=sk-ant-...        # Optional
ANTHROPIC_MODEL=claude-sonnet-4-20250514  # Optional
```

## Code Files Modified

```
client/src/routes/teacher/StoryManager.tsx
├─ Added: selectedModel state
├─ Added: Model selector UI
└─ Modified: generateStories() to send model parameter

server/src/config.ts
├─ Added: anthropicApiKey
└─ Added: anthropicModel

server/src/utils/anthropic.ts (NEW)
├─ getAnthropic() function
└─ ANTHROPIC_MODEL constant

server/src/types/requests.ts
└─ Modified: GenerateStoriesRequest interface

server/src/routes/experiments.ts
├─ Imported: getAnthropic, ANTHROPIC_MODEL
├─ Modified: Request validation schema
├─ Modified: genOne() function with Claude support
└─ Modified: Response to include selected model

.env
├─ Added: ANTHROPIC_API_KEY
└─ Added: ANTHROPIC_MODEL
```

## Error Handling Flow

```
Story Generation Request
│
├─ Selected Model API Call
│  ├─ Network Error → Log + Try Fallback
│  ├─ Invalid Response → Log + Try Fallback
│  ├─ Invalid JSON → Log + Try Fallback
│  └─ Success → Validate Story
│
├─ Fallback API Call (if primary failed)
│  ├─ Network Error → Log + Use Hardcoded Fallback
│  ├─ Invalid Response → Log + Use Hardcoded Fallback
│  └─ Success → Validate Story
│
└─ Story Validation
   ├─ Wrong paragraph count → Use Hardcoded Fallback
   ├─ Wrong word occurrences → Use Hardcoded Fallback
   └─ Valid → Save to Database + Return Success
```

## UI States

1. **Idle**: Model selector enabled, generate button enabled
2. **Generating**: Model selector disabled, generate button shows spinner
3. **Success**: Green banner, previews shown, regenerate button available
4. **Error**: Red toast notification, model selector re-enabled
5. **Locked**: Both disabled when stories confirmed or experiment live

## Logging

All operations are logged with context:

```typescript
logger.info('Claude response structure', {
  model: 'claude',
  hasStory: !!data?.story,
  hasParagraphs: !!data?.story?.paragraphs,
  paragraphCount: data?.story?.paragraphs?.length,
  occurrenceCount: data?.story?.occurrences?.length
});
```
