# Claude Integration for Story Generation

## Overview

Added optional Claude (Anthropic) AI model support for story generation alongside the existing OpenAI implementation. Teachers can now choose between OpenAI GPT or Anthropic Claude when generating stories.

## Changes Made

### 1. Environment Configuration

**File**: `.env`
- Added `ANTHROPIC_API_KEY` for Claude API authentication (optional)
- Added `ANTHROPIC_MODEL` with default value `claude-sonnet-4-20250514`

### 2. Server Configuration

**File**: `server/src/config.ts`
- Added `anthropicApiKey` and `anthropicModel` to config object
- These settings are loaded from environment variables

### 3. Anthropic Client Utility

**File**: `server/src/utils/anthropic.ts` (NEW)
- Created singleton pattern for Anthropic client initialization
- Returns `null` if API key is not configured (graceful fallback)
- Exports `ANTHROPIC_MODEL` constant for use in routes

### 4. API Type Definitions

**File**: `server/src/types/requests.ts`
- Updated `GenerateStoriesRequest` interface to include optional `model` field
- Type: `'openai' | 'claude'`

### 5. Story Generation Route

**File**: `server/src/routes/experiments.ts`
- Imported Anthropic utility: `getAnthropic()` and `ANTHROPIC_MODEL`
- Updated request validation schema to accept `model` parameter
- Modified `genOne()` function to support both OpenAI and Claude:
  - **Claude logic**: Uses `claude.messages.create()` with proper prompt formatting
  - **Fallback chain**: Claude → OpenAI → Fallback story generator
  - **JSON extraction**: Handles Claude's response format (may include markdown wrapping)
- Updated response to return the selected model name

### 6. UI Model Selector

**File**: `client/src/routes/teacher/StoryManager.tsx`
- Added `selectedModel` state (default: `'openai'`)
- Created model selector dropdown before "Generate Both Stories" button
- Dropdown includes:
  - OpenAI (GPT) option
  - Anthropic (Claude) option
  - Contextual help text
  - Disabled state when generating or locked
- Updated `generateStories()` to pass `model` parameter to API

### 7. Dependencies

**File**: `server/package.json`
- Installed `@anthropic-ai/sdk` package

## Usage

### For Teachers

1. Navigate to the Story Manager page in the teacher interface
2. Select target words for both stories (5 words each)
3. **Choose AI Model**:
   - Select "OpenAI (GPT)" for OpenAI-powered story generation
   - Select "Anthropic (Claude)" for Claude-powered story generation
4. Click "Generate Both Stories"

### Configuration

To enable Claude support, add your Anthropic API key to `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

**Note**: If no Claude API key is configured, the system will:
1. Log a warning when Claude is selected
2. Automatically fall back to OpenAI
3. If OpenAI is also unavailable, use the built-in fallback story generator

## Behavior

### Model Selection Priority

1. **User selects OpenAI**: Uses OpenAI API → Fallback generator if fails
2. **User selects Claude**: 
   - Uses Claude API if key is configured
   - Falls back to OpenAI if Claude fails or no key
   - Falls back to built-in generator if both APIs fail

### API Response Format

Both APIs return the same story structure:
```json
{
  "story": {
    "paragraphs": ["paragraph 1", "paragraph 2", ...],
    "occurrences": [
      {
        "word": "target_word",
        "paragraphIndex": 0,
        "sentenceIndex": 0
      }
    ]
  }
}
```

### Error Handling

- Both OpenAI and Claude errors are logged with model information
- Automatic fallback ensures stories are always generated
- UI shows loading state during generation
- Toast notifications inform users of success/failure

## Technical Details

### Claude API Integration

The implementation uses Anthropic's Messages API:

```typescript
const r = await claude.messages.create({
  model: ANTHROPIC_MODEL,
  max_tokens: 4096,
  messages: [
    {
      role: 'user',
      content: `${systemPrompt}\n\nUser request:\n${userPrompt}\n\nRespond with valid JSON only, no other text.`,
    },
  ],
});
```

### JSON Extraction

Claude responses may include markdown code blocks, so we extract JSON:

```typescript
const jsonMatch = text.match(/\{[\s\S]*\}/);
const jsonText = jsonMatch ? jsonMatch[0] : '{}';
const data = JSON.parse(jsonText);
```

## Future Enhancements

Potential improvements for consideration:

1. **Model-specific prompt optimization**: Tailor prompts for each model's strengths
2. **Cost tracking**: Log token usage and costs per model
3. **A/B testing**: Compare story quality between models
4. **Additional models**: Support for other providers (e.g., Cohere, Google Gemini)
5. **Model persistence**: Remember teacher's preferred model choice
6. **Batch generation**: Generate multiple story variants with different models

## Benefits

- **Flexibility**: Teachers can choose their preferred AI model
- **Reliability**: Automatic fallback ensures continuous operation
- **Cost optimization**: Select between different pricing models
- **Quality comparison**: Test which model produces better stories for specific use cases
- **Vendor independence**: Not locked into a single AI provider
