# VAANI AI: Architecture Documentation

## System Overview
VAANI AI is a Malayalam intelligent voice assistant designed around a layered, provider-agnostic backend. The system operates on a Voice-First paradigm where the frontend captures audio, visualizes states, and delegates all transcription, reasoning, memory, and synthesis to the server.

## Request Flow
1. **Frontend (Browser)**
   - Captures microphone audio as a `webm;codecs=opus` blob.
   - Generates a unique `requestId` and `sessionId`.
   - Sends audio blob to the `POST /api/stt` endpoint.
2. **Backend STT (`server/sttPlugin.ts`)**
   - Transcribes the audio into a raw Malayalam/English string using `ISTTProvider`.
   - Returns the string to the frontend.
3. **Frontend Orchestrator (`src/services/aiService.ts`)**
   - Combines the new transcript with conversational history.
   - Sends the request to `POST /api/ai` along with the `requestId`.
4. **Backend AI (`server/aiPlugin.ts`)**
   - Parses the request and authenticates the user (currently mocked to `user_dev_123`).
   - Delegates reasoning to `IAIProvider` (Gemini 1.5 Flash).
   - Gemini decides if it should directly answer or execute a tool (e.g. `save_memory`, `create_reminder`).
   - Executes tools securely against the SQLite database using the authenticated user identity.
   - Returns the final synthesized Malayalam response text to the frontend.
5. **Frontend TTS Orchestrator**
   - Sends the final text and `requestId` to `POST /api/tts`.
6. **Backend TTS (`server/ttsPlugin.ts`)**
   - Converts the text to an MP3 audio buffer using `ITTSProvider`.
   - Returns the buffer for the frontend to play automatically.

## Core Boundaries

### 1. Centralized Configuration
All API keys, model choices, and environment constraints are strictly managed in `server/config.ts`. The plugins import this config object rather than accessing `process.env` dynamically.

### 2. Provider Abstractions (`server/providers/interfaces.ts`)
The intelligence backend relies on contracts rather than concrete implementations:
- `ISTTProvider`: Allows swapping Google Cloud STT V1 with V2, Chirp 3, or Gemini Live in future phases.
- `IAIProvider`: Exposes a multi-turn `generateContent` method that handles tool execution.
- `ITTSProvider`: Wraps Google Cloud Text-to-Speech APIs.

### 3. Database Layer (`server/db.ts`)
SQLite is used for persistent storage (`vaani.db`). 
- **User Data Isolation**: Every operation explicitly requires an `authenticatedUserId`.
- Current entities: `reminders`, `memories`.

### 4. Security & Authentication
- Frontend code does not hold API keys or cloud credentials.
- The `userId` used for database queries is determined by the backend (`RequestContext`), ensuring that malicious clients cannot read or modify another user's reminders by spoofing a payload property.

## Technology Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4.
- **Backend**: Node.js + Express (run via Vite server middlewares).
- **Database**: SQLite (`node:sqlite`).
- **AI / Speech**: Google Cloud STT/TTS, Google Gemini.
