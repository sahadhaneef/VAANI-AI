**VAANI AI**

**Malayalam Intelligent Voice Assistant**

*Phase 1 to Production Blueprint*

**A fresh build plan for a real AI assistant - not a demo**

Primary language: Malayalam, with Manglish, English, and
Malayalam-English code switching

# 1. Project Vision

VAANI AI will be built as a real voice-first intelligent assistant. The
user speaks naturally in Malayalam, Manglish, English, or mixed
language. VAANI should accurately hear the request, understand the
meaning and context, reason about the task, search the internet when
required, use tools, remember explicitly saved information and
reminders, generate images when requested, and answer naturally through
speech.

The project must not be designed as a fixed demo with keyword matching,
canned answers, fake memory, or a hardcoded list of questions. The
architecture must support open-ended questions and multi-step tasks from
the start.

# 2. What VAANI Should Be Able To Do

- Speak naturally with the user in Malayalam and Malayalam-English mixed
  conversation.

- Capture speech clearly, including longer sentences and normal
  conversational pauses.

- Understand intent semantically rather than relying on keyword-only
  rules.

- Answer known questions accurately and reason through complex requests.

- Automatically use Google Search grounding when current, uncertain, or
  externally verifiable information is needed.

- Search for specific products, extract useful product details, prices,
  seller/source information, and the time the price was observed.

- Remember information only when the user explicitly asks VAANI to
  remember it, and retrieve it later.

- Create, list, update, cancel, and verify reminders using persistent
  storage.

- Generate and edit images through Gemini image-generation models when
  the user asks for an image.

- Use tools such as calculator, weather, search, reminders, notes, and
  image generation through function/tool calling.

- Ask a precise clarification question when information is missing
  instead of guessing.

- Say that it does not know when reliable information cannot be
  established.

- Never claim a tool action succeeded unless the backend confirms
  success.

# 3. Current Google Technology Direction

The current Google AI documentation supports the technology choices
below. Google Search grounding can automatically decide when web search
would improve an answer and can return grounded responses with
citations. Gemini Live provides real-time, bidirectional audio, native
audio output, tool use, interruption handling, and multilingual
conversation. Malayalam is listed as a supported language for Live API
and for Gemini live transcription. Google also documents current Gemini
image-generation models for image creation/editing.

| **Capability**           | **Recommended starting point**                                            | **Role in VAANI**                                          |
|--------------------------|---------------------------------------------------------------------------|------------------------------------------------------------|
| Core reasoning           | Gemini Flash-class reasoning model selected from current supported models | Answering, planning, task routing                          |
| Voice conversation       | Gemini Live API evaluation track                                          | Low-latency, bidirectional voice and interruption handling |
| Controlled STT benchmark | Google Cloud Speech-to-Text V2 + Chirp 3                                  | High-control Malayalam transcription benchmark             |
| Web knowledge            | Gemini Google Search grounding                                            | Current facts, verification, research                      |
| TTS fallback/cascade     | Google Cloud Malayalam TTS, Chirp 3 HD                                    | Natural Malayalam speech output                            |
| Image generation         | Gemini 3.1 Flash Image / Nano Banana 2; Pro Image for harder jobs         | Image generation and editing                               |
| Persistent memory        | Backend database                                                          | Explicit user memories and reminders                       |

Important: model names and availability change. Keep model IDs and
provider configuration in environment/config files, not hardcoded
throughout the application.

# 4. Target System Architecture

Use a layered architecture so that a problem in one layer can be
diagnosed without hiding it inside another layer.

> VOICE INPUT LAYER
>
> Microphone -\> audio capture -\> streaming/recorded audio
>
> SPEECH UNDERSTANDING LAYER
>
> Live audio path and/or STT -\> raw transcript + speech metadata
>
> INTELLIGENCE LAYER
>
> Semantic understanding -\> context -\> memory retrieval -\> task
> classification -\> reasoning
>
> TOOL ORCHESTRATION LAYER
>
> Google Search -\> calculator -\> weather -\> reminders -\> notes -\>
> product research -\> image generation -\> custom tools
>
> VERIFICATION LAYER
>
> Validate sources, calculations, tool success, and required parameters
>
> RESPONSE LAYER
>
> Generate natural spoken Malayalam response
>
> VOICE OUTPUT LAYER
>
> Native audio / Malayalam TTS -\> speaker
>
> PERSISTENCE LAYER
>
> Users -\> conversations -\> explicit memories -\> reminders -\>
> audit/status data

# 5. Core Design Rules

- Voice-first: no text-chat UI as the primary interaction.

- Real intelligence: the model must generate answers from the current
  request and context, not from hardcoded templates.

- Tool-first for actions: reminders, notes, calculator, weather, search,
  product lookup, and image generation use real tools.

- Truth-first: search or verify when needed; never manufacture facts or
  tool results.

- Memory is persistent data, not just conversation context.

- Every layer exposes enough diagnostics to identify whether a failure
  is audio, STT, understanding, reasoning, tool execution, or TTS.

- All secrets stay server-side; frontend code receives only safe, scoped
  data.

- Build one phase at a time and do not declare a phase complete until
  its exit tests pass.

# Phase 1 - Product Definition, Architecture and Clean Foundation

**Goal:** Start from a clean, production-minded foundation instead of
reusing a fragile prototype.

## Build

- Create repository structure with clear frontend, backend, services,
  tools, memory, database, and configuration boundaries.

- Define environment variables for all provider keys, project IDs,
  locations, model IDs, and database connection strings.

- Define a request/session ID for every voice interaction.

- Define core interfaces: VoiceSession, SpeechResult, AssistantRequest,
  ToolCall, ToolResult, MemoryRecord, ReminderRecord, SourceRecord.

- Create a provider abstraction so STT, TTS, reasoning model, search,
  database, and image generation can be replaced without rewriting the
  UI.

- Create a central assistant orchestrator instead of putting logic
  inside React components.

## Exit gate

- Application boots cleanly.

- No API secrets in frontend code.

- Provider configuration is centralized.

- Architecture diagram matches the code structure.

# Phase 2 - Professional Voice-First UI

**Goal:** Create the permanent VAANI interaction model before adding
intelligence.

## Build

- Home screen with VAANI identity, microphone control,
  listening/processing/speaking states, and a small read-only transcript
  area.

- Visible Start/Stop/Retry controls.

- No keyboard chat box, send button, or chat bubbles.

- History and Profile areas can exist, but must support the voice-first
  experience.

- Design states for idle, listening, processing, searching, thinking,
  tool-running, speaking, error, and retry.

## Exit gate

- A user can understand exactly when VAANI is listening, processing,
  searching, and speaking.

- UI does not imply that VAANI is a normal text chatbot.

# Phase 3 - High-Quality Microphone and Audio Capture

**Goal:** Make the assistant hear complete, clean audio before
attempting to improve AI reasoning.

## Build

- Request microphone constraints such as echo cancellation, noise
  suppression, and auto gain control where supported.

- Prefer a controlled audio path and preserve actual codec/MIME/sample
  rate metadata.

- Prevent premature stopping from short pauses.

- Wait for the final recording chunk before creating the Blob.

- Detect empty, silent, corrupted, or implausibly short audio.

- Prevent overlapping recordings and stale requests.

- Add developer diagnostics for duration, bytes, chunks, MIME, sample
  rate, and errors.

## Exit gate

- A 10-30 second natural Malayalam sentence is captured completely.

- Short pauses do not cut the recording.

- Repeated tests do not mix old and new recordings.

# Phase 4 - Speech Recognition Accuracy - Malayalam Benchmark

**Goal:** Establish a measurable speech-recognition baseline before
tuning the AI.

## Build

- Benchmark two viable paths: (A) Gemini Live audio/transcription path
  and (B) Google Cloud Speech-to-Text V2 with Chirp 3.

- Use Malayalam ml-IN and test Malayalam, Manglish, English, and
  mixed-language speech.

- Preserve raw transcript exactly as returned by the speech layer.

- Separate rawTranscript from interpretedRequest.

- Create a developer STT-only mode that stops after transcription.

- Measure word accuracy, intent preservation, numbers, dates, names, and
  English technical words.

- Do not solve STT errors by asking the reasoning model to hallucinate a
  cleaner transcript.

## Exit gate

- Select the better voice-input path from real Malayalam tests, not
  assumptions.

- Raw transcript preserves the user's meaning reliably enough for the
  intelligence layer.

- STT failures are distinguishable from AI-understanding failures.

# Phase 5 - Core Intelligence and Semantic Understanding

**Goal:** Replace keyword-based behavior with a real reasoning-capable
assistant.

## Build

- Pass the actual user transcript to the reasoning model.

- Use semantic intent detection only where structured routing is
  required.

- Extract entities such as date, time, people, product, location,
  amount, constraints, and references.

- Classify requests as simple, moderate, complex, or multi-step.

- Support natural Malayalam, Manglish, English, and code switching.

- Use context to resolve phrases such as 'അത്', 'അതിന്റെ', 'the same one',
  and 'earlier'.

- Do not expose chain-of-thought; produce only the final answer and
  concise explanation.

## Exit gate

- Clear questions receive question-specific answers.

- No generic response is returned for unrelated questions.

- Complex requests receive a plan/answer appropriate to their
  complexity.

# Phase 6 - Conversation Context and Persistent Memory

**Goal:** Separate short-term conversational context from durable,
user-controlled memory.

## Build

- Maintain short-term conversation context for follow-up questions.

- Create explicit memory tools: saveMemory, getRelevantMemories,
  updateMemory, deleteMemory.

- Only save long-term information when explicitly requested or clearly
  appropriate under the product's memory policy.

- Store memories with user ID and timestamps.

- Allow the user to ask what VAANI remembers and to ask VAANI to forget
  stored information.

- Never expose one user's memories to another user.

## Exit gate

- User says: 'Remember that my project is VAANI AI.' Later: 'What is my
  project name?' -\> VAANI retrieves the stored fact.

- User can delete the memory and confirm deletion.

- Conversation context works across follow-up questions.

# Phase 7 - Google Search Grounding and Web Research

**Goal:** Give VAANI a reliable path to current and previously unknown
information.

## Build

- Enable Gemini Google Search grounding for requests where current or
  externally verifiable information is needed.

- Let the model decide when search is useful rather than searching every
  query.

- Prefer official/primary/reliable sources for important facts.

- Return source metadata for the UI; do not read long URLs through TTS.

- For current answers, preserve retrieval timestamp and source titles
  where practical.

- Handle conflicting or insufficient sources explicitly.

- Do not allow the assistant to invent a web answer when search fails.

## Exit gate

- Ask a current-information question and verify that VAANI actually
  searches when needed.

- Answer contains information supported by retrieved sources.

- A source section can be shown in the UI without turning the experience
  into a browsing interface.

# Phase 8 - Tool Orchestration and Multi-Step Tasks

**Goal:** Turn VAANI into an agent-like assistant that can plan and
execute supported actions.

## Build

- Create a single tool registry and function-calling interface.

- Implement tools for calculator, weather, notes, reminders, web search,
  product research, and image generation.

- Use a tool loop: understand -\> choose tools -\> execute -\> verify
  -\> continue or answer.

- Allow multiple tools in one user request.

- Require explicit tool success before saying an action is complete.

- Prevent duplicate tool calls with request IDs and idempotency.

## Exit gate

- A request containing multiple tasks completes all supported tasks.

- A failed tool call is reported as a failure, not a fake success.

- Tool use is semantic, not keyword-triggered.

# Phase 9 - Real Reminder System

**Goal:** Make reminders real, persistent, queryable, editable, and
verifiable.

## Build

- Use a persistent database table/collection for reminders.

- Store title, description, scheduled date/time, timezone, status, user
  ID, createdAt, and completedAt.

- Implement createReminder, getReminders, getUpcomingReminders,
  getTodayReminders, getTomorrowReminders, updateReminder,
  deleteReminder, and completeReminder.

- Understand natural date/time language in Malayalam and Manglish.

- Ask for the missing time/date when necessary instead of guessing.

- Allow the user to ask: 'What did I tell you to remind me about?',
  'What are my reminders?', 'When is my project reminder?', and similar
  questions.

- Persist reminders across refreshes and new sessions.

## Exit gate

- Create a reminder by voice.

- Close/reopen the app and retrieve it.

- Ask for reminders later and receive the actual stored reminder.

- Update/cancel the reminder successfully.

# Phase 10 - Product Search, Comparison and Current Prices

**Goal:** Allow VAANI to search for specific products and provide
useful, source-backed purchase information.

## Build

- Create a Product Research tool that can search the web for a named
  product or product category.

- Extract product name, model/variant, key specifications,
  seller/retailer, observed price, currency, availability, rating/review
  information when available, and source URL/title.

- Always label price as current/observed at retrieval time; prices can
  change and should never be presented as permanent.

- Compare multiple products when the user asks 'which is better' or
  gives a budget.

- Ask for missing constraints such as budget, use case, location,
  preferred brand, or size when needed.

- Use reliable/official retailer or manufacturer pages where practical
  and cross-check important prices.

- Do not invent product availability or price.

## Exit gate

- User: 'Search for a 16GB RAM laptop under Rs 60,000 for coding and
  AI.' -\> VAANI searches, compares relevant products, gives
  price/source details, and explains tradeoffs.

- User can ask follow-ups about the same products without repeating all
  details.

- The voice response is concise while richer product details remain
  available in the UI.

# Phase 11 - Image Generation and Creative AI

**Goal:** Let the assistant create images as an integrated AI
capability.

## Build

- Detect genuine image-generation requests semantically.

- Use current Gemini image-generation models rather than deprecated
  Imagen endpoints.

- Use a fast image model for normal creation and a stronger image model
  for difficult, text-heavy, high-resolution, or professional requests.

- Support image creation, editing, variations, and multi-turn refinement
  where the selected model supports it.

- If the user asks for an image based on current facts, allow grounded
  generation where supported.

- Return the generated image to the UI and provide a short spoken
  confirmation.

## Exit gate

- User: 'Create a logo for VAANI AI with a Kerala-inspired blue design.'
  -\> actual image is generated.

- User can ask follow-up edits such as 'make the background darker' or
  'add a microphone icon'.

- The assistant never responds with a fake image placeholder.

# Phase 12 - Human-Like Voice and Real-Time Conversation

**Goal:** Make VAANI sound and behave less like a request-response bot
and more like a natural voice assistant.

## Build

- Evaluate Gemini Live API for real-time bidirectional audio, native
  audio output, interruptions, and conversational turn-taking.

- Benchmark native audio conversation against the controlled STT +
  reasoning + TTS cascade.

- Use Malayalam as the default response language while allowing natural
  English technical terms and code switching.

- Implement barge-in so the user can interrupt VAANI when the selected
  voice architecture supports it.

- Keep response text short enough for natural speech.

- If using a cascaded TTS path, benchmark Malayalam Chirp 3 HD voices
  and choose one consistent default.

- Do not use browser SpeechSynthesis as the quality benchmark.

## Exit gate

- Voice latency is acceptable.

- Malayalam pronunciation and pacing sound natural enough in repeated
  tests.

- Interruptions do not leave stale audio playing.

# Phase 13 - Safety, Security, Reliability and Data Boundaries

**Goal:** Make the assistant safe and dependable enough for real users.

## Build

- Keep API keys, cloud credentials, and database credentials on the
  server.

- Scope all memories, reminders, history, and files by authenticated
  user.

- Add rate limits, request timeouts, retries where safe, and structured
  error handling.

- Separate uncertain information from unknown information and from
  unclear speech.

- Never claim a search, reminder, image generation, or other action
  occurred unless verified.

- Keep an audit trail for tool calls without exposing secrets.

## Exit gate

- Security review passes.

- Failure states are understandable.

- No cross-user memory or reminder access is possible.

# Phase 14 - Evaluation, Real-World Testing and Deployment

**Goal:** Prove that VAANI works outside a happy-path demo.

## Build

- Create a Malayalam voice test set covering short questions, long
  requests, code switching, accents, numbers, dates, names, follow-ups,
  multi-step tasks, current-information requests, product queries,
  reminders, and image requests.

- Measure STT accuracy, intent accuracy, tool selection accuracy, task
  completion, factual correctness, citation coverage, memory recall
  accuracy, and TTS quality.

- Run tests in quiet and moderately noisy environments.

- Test Chrome and the intended production browser/device targets.

- Track latency from speech start to answer and to first spoken audio.

- Create production logging/observability and error dashboards.

- Deploy only after the real-world acceptance checklist passes.

## Exit gate

- At least 30 real Malayalam/Manglish voice tests pass across core
  capabilities.

- Complex multi-step tests pass.

- Web search is used correctly.

- Memory and reminders persist.

- Product and image capabilities work end to end.

- No critical security or data-isolation issues remain.

# 6. Key End-to-End Workflows

## A. Normal Malayalam Question

**1.** User speaks in Malayalam

**2.** Capture audio

**3.** Recognize speech

**4.** Pass actual transcript to reasoning model

**5.** Answer directly

**6.** Speak concise Malayalam answer

## B. Unknown / Current Question

**1.** User asks a current or uncertain question

**2.** Reasoning model decides web search is needed

**3.** Google Search grounding retrieves sources

**4.** Model synthesizes and verifies

**5.** Answer with source-aware UI metadata

**6.** Speak concise Malayalam answer

## C. Reminder

**1.** User says what to remember/remind

**2.** Semantic parser extracts task and time

**3.** Reminder tool writes to database

**4.** Backend confirms success

**5.** VAANI confirms by voice

**6.** Later user asks about it

**7.** Database retrieval supplies the exact reminder

## D. Product Search

**1.** User names product/category and constraints

**2.** Search web/retailer sources

**3.** Extract price/specs/source

**4.** Compare when asked

**5.** State that price is observed at retrieval time

**6.** Speak recommendation; show richer details in UI

## E. Image Generation

**1.** User requests an image

**2.** Model classifies as image task

**3.** Image-generation tool/model is called

**4.** Generated image is returned

**5.** Optional multi-turn edit

**6.** VAANI gives short spoken confirmation

# 7. Data Model - Minimum Entities

| **Entity**   | **Important fields**                                       | **Purpose**                        |
|--------------|------------------------------------------------------------|------------------------------------|
| User         | id, profile, preferences, timezone                         | Identity and assistant preferences |
| Conversation | id, userId, startedAt, endedAt                             | Short-term context/session         |
| Message/Turn | id, conversationId, role, transcript, response, timestamps | Conversation trace                 |
| Memory       | id, userId, key, value, category, createdAt, updatedAt     | Explicit persistent memory         |
| Reminder     | id, userId, title, date, time, timezone, status, createdAt | Persistent reminders               |
| ToolCall     | id, requestId, toolName, args, resultStatus, timestamp     | Tool execution trace               |
| Source       | id, requestId, title, url, retrievedAt                     | Web grounding metadata             |

# 8. Intelligence Rules

- If the user asks a clear factual question, answer it; do not ask how
  you can help.

- If the information is time-sensitive or uncertain, search and ground
  the answer.

- If the request requires computation, use calculator/tool execution
  when appropriate.

- If the user asks VAANI to remember something, save persistent memory
  and confirm only after success.

- If the user asks about a previous reminder or memory, retrieve the
  stored record instead of guessing from the current turn.

- If the user asks for a product, search and return source-backed
  details; do not invent a price.

- If the user asks to create an image, invoke a real image-generation
  capability.

- If speech is unclear, ask the user to repeat; never replace unclear
  speech with a guessed request.

- If a supported action fails, report the failure honestly.

- Avoid canned phrases and repeated generic greetings after the user has
  already asked a clear question.

# 9. Voice Accuracy Test Matrix

| **Test class** | **Examples**                           | **Pass criteria**                                   |
|----------------|----------------------------------------|-----------------------------------------------------|
| Malayalam      | നാളെ രാവിലെ എട്ടുമണിക്ക് എന്നെ ഓർമ്മിപ്പിക്കണം | Meaning, time, and action preserved                 |
| Manglish       | nale 8 manikku remind cheyyanam        | Same intent as Malayalam equivalent                 |
| Code switching | project submit cheyyan reminder venam  | English terms preserved correctly                   |
| Numbers        | 12500 plus 18 percent GST              | Numbers and symbols correctly recognized            |
| Long request   | multi-part project/interview request   | No truncation; all parts understood                 |
| Follow-up      | അതിന്റെ advantages എന്തൊക്കെയാണ്?          | Correct antecedent resolved                         |
| Noise          | moderate background noise              | Meaning remains accurate or clarification requested |

# 10. What Not To Build

- Do not build a collection of hardcoded questions and answers.

- Do not use regex keyword matching as the main intelligence engine.

- Do not fake web search with prewritten search results.

- Do not fake reminders using local UI state only.

- Do not fake memory by stuffing everything into a prompt.

- Do not claim an action completed when the database/tool says it
  failed.

- Do not hide STT problems by letting the AI guess a transcript.

- Do not use an old/deprecated image model endpoint when a current
  Gemini image model is available.

- Do not optimize for a visually impressive demo before the core voice
  and intelligence tests pass.

# 11. Suggested Project Structure

> client/
>
> components/voice/
>
> services/voice/
>
> services/ui/
>
> state/
>
> server/
>
> ai/
>
> voice/
>
> tools/
>
> memory/
>
> reminders/
>
> search/
>
> products/
>
> image/
>
> db/
>
> auth/
>
> shared/
>
> types/
>
> schemas/
>
> config/

# 12. Phase Execution Method

1.  Implement one phase only.

2.  Run its exit tests using real voice where applicable.

3.  Record failures by layer: audio, STT, understanding, reasoning,
    tool, memory, search, image, or TTS.

4.  Fix the failed layer before adding another capability.

5.  Keep working features from previous phases intact.

6.  After each phase, update a short architecture and test report.

7.  Do not declare production readiness until the full regression suite
    passes.

# 13. Final Acceptance Checklist

**\[ \]** Voice is the primary interaction.

**\[ \]** Malayalam is the primary language.

**\[ \]** Manglish and Malayalam-English code switching work.

**\[ \]** Voice capture is clear and complete.

**\[ \]** STT accuracy has been measured and a production path selected.

**\[ \]** VAANI answers the actual question rather than returning canned
replies.

**\[ \]** Complex tasks are reasoned through properly.

**\[ \]** Google Search grounding is available and triggered when
needed.

**\[ \]** Current answers include usable source information.

**\[ \]** Specific product searches return useful details and observed
prices with source/time context.

**\[ \]** Reminders are persistent and retrievable later.

**\[ \]** Explicit memories are persistent, user-controlled, and
retrievable.

**\[ \]** Calculator and other tools are real and verified.

**\[ \]** Image generation creates actual images through a real
model/tool.

**\[ \]** Voice output is natural enough for repeated Malayalam
conversation.

**\[ \]** User can interrupt/retry safely where supported.

**\[ \]** No fake capabilities or fake success messages.

**\[ \]** Secrets are secured server-side.

**\[ \]** All data is user-scoped.

**\[ \]** Core tests pass in real-world voice conditions.

# 14. Official Technical References

**Gemini API Models**  
https://ai.google.dev/gemini-api/docs/models  
Current Gemini model catalog and capabilities, including
image-generation model endpoints.

**Grounding with Google Search**  
https://ai.google.dev/gemini-api/docs/google-search  
Google Search grounding, automatic search selection, source/citation
metadata, and tool combinations.

**Gemini Live API - Get started**  
https://ai.google.dev/gemini-api/docs/live-api/get-started-sdk  
Real-time bidirectional audio, native audio output, WebSocket sessions,
and audio input requirements.

**Gemini Live API - Capabilities**  
https://ai.google.dev/gemini-api/docs/live-api/capabilities  
Multilingual support, Malayalam support, voice configuration,
interruptions, context, and tools.

**Gemini Live API - Best practices**  
https://ai.google.dev/gemini-api/docs/live-api/best-practices  
Streaming, chunking, language guidance, interruptions, and context
management.

**Live transcription**  
https://ai.google.dev/gemini-api/docs/live-api/live-transcribe  
Current live transcription language support, including Malayalam ml-IN.

**Google Cloud Speech-to-Text - Chirp 3**  
https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3  
Current Chirp 3 model details and Speech-to-Text V2 usage.

**Google Cloud Speech-to-Text supported languages**  
https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages  
Supported language codes including Malayalam ml-IN.

**Google Cloud Text-to-Speech voices**  
https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types  
Current Malayalam voice options, including Chirp 3 HD.

**Gemini image generation**  
https://ai.google.dev/gemini-api/docs/image-generation  
Current image generation features.

**Gemini image generation model selection**  
https://ai.google.dev/gemini-api/docs/generate-content/image-generation  
Current Gemini image-generation recommendations and model choices.

As of September 2026, Google documentation states that the older Imagen
4 endpoints were deprecated/shut down in 2026; use current Gemini
image-generation endpoints for a new build. Verify model availability
and pricing before deployment.

# 15. Recommended Build Order

The most important implementation order is: foundation -\> voice capture
-\> speech accuracy benchmark -\> intelligence -\> memory -\> search -\>
tools -\> reminders -\> products -\> image generation -\> natural live
voice -\> reliability -\> deployment. Do not skip the speech benchmark:
if the assistant cannot reliably hear Malayalam, a stronger reasoning
model will still receive the wrong request.
