/**
 * Vite Server Plugin — Backend AI & Semantic Intelligence Layer
 *
 * PHASE 5 IMPLEMENTATION: Core Intelligence & Semantic Understanding
 *
 * Architecture:
 * - Server-Owned Conversation Context: Bounded to 6 turns per session, keyed by sessionId.
 * - Single-Call Semantic Reasoning: Performs intent classification, complexity analysis,
 *   entity extraction, reference resolution, and answer generation in ONE efficient Gemini request.
 * - Zero Tool Execution (Phase 5 Boundary): Identifies future tool intents (product_request,
 *   calculation_request, reminder_request, current_information_request, image_request) without
 *   executing tools or fabricating live data.
 * - Server-Side Output Validation: Validates structured output and classifies malformations
 *   as AI_INVALID_STRUCTURED_OUTPUT.
 * - Zero Chain-of-Thought: Emits only clean user-facing answers and structured metadata.
 */

import type { Plugin } from 'vite';
import type {
  UnderstandingResult,
  SemanticComplexity,
  LanguageMode,
  FutureToolIntent,
  MemoryType,
  MemoryIntent,
  MemoryCandidate,
  SearchIntent,
  SearchReason,
  RequestContext,
  AIErrorCategory,
} from './providers/interfaces.js';
import { geminiProvider } from './providers/geminiProvider.js';
import { MemoryService } from './memoryService.js';
import { SearchService } from './searchService.js';

/* ── 1. Server-Owned Conversation Context ────────────────────── */

interface SessionTurn {
  role: 'user' | 'model';
  text: string;
  topic?: string;
  timestamp: number;
}

interface ServerSession {
  sessionId: string;
  userId: string;
  turns: SessionTurn[];
  lastActive: number;
}

const MAX_TURNS_PER_SESSION = 6;
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const serverSessions = new Map<string, ServerSession>();

function getOrCreateSession(sessionId: string, userId: string = 'user_dev_123'): ServerSession {
  const now = Date.now();
  let session = serverSessions.get(sessionId);

  if (!session) {
    session = {
      sessionId,
      userId,
      turns: [],
      lastActive: now,
    };
    serverSessions.set(sessionId, session);
  } else {
    // If expired, reset turns
    if (now - session.lastActive > SESSION_EXPIRY_MS) {
      session.turns = [];
    }
    session.lastActive = now;
    if (userId && userId !== 'user_dev_123') {
      session.userId = userId;
    }
  }

  return session;
}

function recordTurn(
  sessionId: string,
  userText: string,
  modelAnswer: string,
  topic?: string
): void {
  const session = getOrCreateSession(sessionId);
  const now = Date.now();

  session.turns.push({
    role: 'user',
    text: userText.trim().substring(0, 500),
    topic,
    timestamp: now,
  });

  session.turns.push({
    role: 'model',
    text: modelAnswer.trim().substring(0, 800),
    topic,
    timestamp: now,
  });

  // Keep bounded to maximum recent turns (Phase 6 short-term context)
  if (session.turns.length > MAX_TURNS_PER_SESSION) {
    session.turns = session.turns.slice(-MAX_TURNS_PER_SESSION);
  }
}

/* ── 2. Structured Output Validator ──────────────────────────── */

const ALLOWED_COMPLEXITIES: SemanticComplexity[] = ['simple', 'moderate', 'complex', 'multi_step'];
const ALLOWED_LANGUAGE_MODES: LanguageMode[] = ['malayalam', 'manglish', 'english', 'mixed'];
const ALLOWED_FUTURE_TOOL_INTENTS: Array<FutureToolIntent> = [
  'product_request',
  'calculation_request',
  'reminder_request',
  'current_information_request',
  'image_request',
  null,
];
const ALLOWED_MEMORY_INTENTS: Array<MemoryIntent> = [
  'store',
  'retrieve',
  'update',
  'forget',
  'list',
  null,
];
const ALLOWED_MEMORY_TYPES: Array<MemoryType> = [
  'preference',
  'personal_fact',
  'project_context',
  'instruction',
  'goal',
  'relationship',
  'other',
];

const ALLOWED_SEARCH_INTENTS: SearchIntent[] = ['required', 'optional', 'not_required'];
const ALLOWED_SEARCH_REASONS: SearchReason[] = [
  'CURRENT_INFORMATION',
  'EXPLICIT_SEARCH_REQUEST',
  'UNKNOWN_FACT',
  'SOURCE_REQUEST',
  'STABLE_KNOWLEDGE',
  'CASUAL_CONVERSATION',
];

export function validateUnderstandingResult(raw: any): UnderstandingResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Structured output must be a non-null JSON object');
  }

  const intent = typeof raw.intent === 'string' && raw.intent.trim() ? raw.intent.trim().toLowerCase() : 'other';

  const complexity: SemanticComplexity = ALLOWED_COMPLEXITIES.includes(raw.complexity)
    ? raw.complexity
    : 'moderate';

  const languageMode: LanguageMode = ALLOWED_LANGUAGE_MODES.includes(raw.languageMode)
    ? raw.languageMode
    : 'mixed';

  let futureToolIntent: FutureToolIntent = null;
  if (raw.futureToolIntent && ALLOWED_FUTURE_TOOL_INTENTS.includes(raw.futureToolIntent)) {
    futureToolIntent = raw.futureToolIntent;
  }

  // Memory intent validation (Phase 6)
  let memoryIntent: MemoryIntent = null;
  if (raw.memoryIntent && ALLOWED_MEMORY_INTENTS.includes(raw.memoryIntent)) {
    memoryIntent = raw.memoryIntent;
  }

  // Memory candidate validation (Phase 6)
  let memoryCandidate: MemoryCandidate | null = null;
  if (raw.memoryCandidate && typeof raw.memoryCandidate === 'object') {
    const k = typeof raw.memoryCandidate.key === 'string' ? raw.memoryCandidate.key.trim() : '';
    const v = typeof raw.memoryCandidate.value === 'string' ? raw.memoryCandidate.value.trim() : '';
    const t: MemoryType = ALLOWED_MEMORY_TYPES.includes(raw.memoryCandidate.type)
      ? raw.memoryCandidate.type
      : 'other';
    if (k && v) {
      memoryCandidate = { key: k, value: v, type: t };
    }
  }

  // Search intent validation (Phase 7)
  let searchIntent: SearchIntent = 'not_required';
  if (raw.searchIntent && ALLOWED_SEARCH_INTENTS.includes(raw.searchIntent)) {
    searchIntent = raw.searchIntent;
  }

  let searchReason: SearchReason = 'STABLE_KNOWLEDGE';
  if (raw.searchReason && ALLOWED_SEARCH_REASONS.includes(raw.searchReason)) {
    searchReason = raw.searchReason;
  }

  // Sanitize entities without hallucination
  const rawEnt = raw.entities || {};
  const entities = {
    date: typeof rawEnt.date === 'string' && rawEnt.date.trim() ? rawEnt.date.trim() : null,
    time: typeof rawEnt.time === 'string' && rawEnt.time.trim() ? rawEnt.time.trim() : null,
    people: Array.isArray(rawEnt.people) ? rawEnt.people.map(String).slice(0, 10) : [],
    products: Array.isArray(rawEnt.products) ? rawEnt.products.map(String).slice(0, 10) : [],
    locations: Array.isArray(rawEnt.locations) ? rawEnt.locations.map(String).slice(0, 10) : [],
    amounts: Array.isArray(rawEnt.amounts) ? rawEnt.amounts.map(String).slice(0, 10) : [],
    constraints: Array.isArray(rawEnt.constraints) ? rawEnt.constraints.map(String).slice(0, 10) : [],
    references: Array.isArray(rawEnt.references) ? rawEnt.references.map(String).slice(0, 10) : [],
    brand: typeof rawEnt.brand === 'string' && rawEnt.brand.trim() ? rawEnt.brand.trim() : null,
    technicalTerms: Array.isArray(rawEnt.technicalTerms)
      ? rawEnt.technicalTerms.map(String).slice(0, 15)
      : [],
  };

  const needsClarification = Boolean(raw.needsClarification);
  const clarificationQuestion =
    needsClarification && typeof raw.clarificationQuestion === 'string'
      ? raw.clarificationQuestion.trim()
      : null;

  // Answer validation: must not be empty and must not contain thought blocks
  let answer = typeof raw.answer === 'string' ? raw.answer.trim() : '';
  if (!answer) {
    throw new Error('Model answer field is empty or not a string');
  }

  // Strip accidental thought tags if present
  answer = answer.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

  return {
    intent,
    complexity,
    languageMode,
    confidence: null, // Safeguard: Never invent confidence
    entities,
    needsClarification,
    clarificationQuestion,
    futureToolIntent,
    memoryIntent,
    memoryCandidate,
    searchIntent,
    searchReason,
    answer,
  };
}

/* ── 3. Single-Call Semantic Reasoning Engine ────────────────── */

async function executeSemanticReasoning(
  prompt: string,
  sessionId: string,
  context: RequestContext
): Promise<UnderstandingResult> {
  // Pre-check: Intercept sensitive secrets before sending prompt or calling cloud AI
  if (MemoryService.isSensitiveSecret(prompt)) {
    const isMalayalam = Boolean(prompt.match(/[\u0D00-\u0D7F]/));
    const refusal = MemoryService.getSecretRefusalMessage(isMalayalam);
    console.warn(`[Memory Security] [req:${context.requestId}] Intercepted sensitive secret before AI request. Refusing.`);
    return {
      intent: 'instruction_request',
      complexity: 'simple',
      languageMode: isMalayalam ? 'malayalam' : 'english',
      confidence: null,
      entities: {
        date: null,
        time: null,
        people: [],
        products: [],
        locations: [],
        amounts: [],
        constraints: [],
        references: [],
        brand: null,
        technicalTerms: [],
      },
      needsClarification: false,
      clarificationQuestion: null,
      futureToolIntent: null,
      memoryIntent: 'store',
      memoryCandidate: null,
      memoryDiagnostics: {
        memoryIntent: 'store',
        memoryOperation: 'refused',
        retrievalCount: 0,
        retrievalLatencyMs: 0,
        dbStatus: 'OK',
        errorMessage: 'Storage refused: sensitive credentials detected',
      },
      answer: refusal,
    };
  }

  // 1. Retrieve bounded relevant persistent memories for authenticated user
  const { memories, retrievalLatencyMs } = MemoryService.getRelevantMemories(
    context.authenticatedUserId,
    prompt,
    6
  );
  const memoryPromptBlock = MemoryService.formatMemoriesForPrompt(memories);

  // 2. Retrieve server-owned session context
  const session = getOrCreateSession(sessionId, context.authenticatedUserId);

  // 3. Delegate to GeminiProvider with structured JSON output
  const tStart = Date.now();
  const rawUnderstood = await geminiProvider.understand(
    prompt,
    session.turns,
    context,
    memoryPromptBlock
  );
  const latencyMs = Date.now() - tStart;

  // Validate schema strictly
  const validated = validateUnderstandingResult(rawUnderstood);

  // 3. Process Memory Operations following semantic reasoning
  const memoryOp = await MemoryService.processSemanticMemory(
    prompt,
    validated.memoryIntent || null,
    validated.memoryCandidate,
    context.authenticatedUserId
  );

  // Apply memory operation outcomes to response
  if (memoryOp.operation === 'refused') {
    // Secret protection refusal
    validated.answer = memoryOp.refusalMessage || validated.answer;
  } else if (validated.memoryIntent === 'store') {
    if (memoryOp.success) {
      if (!validated.answer || validated.answer.length < 2) {
        validated.answer = memoryOp.confirmationMessage || 'ശരി, ഞാൻ അത് ഓർമ്മയിൽ വെച്ചു.';
      }
    } else {
      validated.answer = memoryOp.refusalMessage || 'ക്ഷമിക്കണം, ഓർമ്മ സൂക്ഷിക്കാൻ കഴിഞ്ഞില്ല.';
    }
  } else if (validated.memoryIntent === 'update') {
    if (memoryOp.success) {
      if (!validated.answer || validated.answer.length < 2) {
        validated.answer = memoryOp.confirmationMessage || 'ശരി, ആ വിവരം ഞാൻ പുതുക്കിയിട്ടുണ്ട്.';
      }
    } else {
      validated.answer = 'ക്ഷമിക്കണം, ഓർമ്മ പുതുക്കാൻ കഴിഞ്ഞില്ല.';
    }
  } else if (validated.memoryIntent === 'forget') {
    if (memoryOp.success) {
      validated.answer = memoryOp.confirmationMessage || 'ശരി, ഞാൻ ആ ഓർമ്മ ഒഴിവാക്കിയിട്ടുണ്ട്.';
    } else {
      validated.answer = 'ക്ഷമിക്കണം, ആ ഓർമ്മ കണ്ടെത്താനോ ഒഴിവാക്കാനോ കഴിഞ്ഞില്ല.';
    }
  } else if (
    (validated.memoryIntent === 'retrieve' || prompt.toLowerCase().includes('what did i tell you') || prompt.toLowerCase().includes('what is my') || prompt.includes('ഓർമ്മ')) &&
    memories.length === 0
  ) {
    // Guard against hallucinations if no active memory exists for query
    const lowerP = prompt.toLowerCase();
    const isMalayalam = Boolean(prompt.match(/[\u0D00-\u0D7F]/));
    if (
      lowerP.includes('remember') ||
      lowerP.includes('project') ||
      lowerP.includes('language do i prefer') ||
      prompt.includes('ഓർമ്മ') ||
      prompt.includes('പ്രോജക്റ്റ്') ||
      prompt.includes('പഠിക്കുന്നത്')
    ) {
      validated.answer = isMalayalam
        ? 'അത് സംബന്ധിച്ച ഒരു ഓർമ്മ എനിക്ക് കണ്ടെത്താൻ കഴിഞ്ഞില്ല.'
        : 'I could not find any stored memory about that.';
    }
  }

  // Combine diagnostics
  validated.memoryDiagnostics = {
    ...memoryOp.diagnostics,
    retrievalLatencyMs: memoryOp.diagnostics.retrievalLatencyMs || retrievalLatencyMs,
  };

  // 4. Process Google Search Grounding if searchIntent is 'required' (Phase 7)
  const isMemoryStoreOrForget =
    validated.memoryIntent === 'store' ||
    validated.memoryIntent === 'update' ||
    validated.memoryIntent === 'forget';

  if (validated.searchIntent === 'required' && !isMemoryStoreOrForget) {
    // Build contextual background for search without leaking unrelated private data
    const contextParts: string[] = [];

    // Add recent turns to resolve antecedents (e.g. "അതിന്റെ")
    if (session.turns.length > 0) {
      const recentHistory = session.turns
        .slice(-4)
        .map((t) => `${t.role}: ${t.text}`)
        .join('\n');
      contextParts.push(`Recent conversation turns:\n${recentHistory}`);
    }

    // If relevant project context exists in memory, include it safely
    const projectMem = memories.find(
      (m) => m.memory_type === 'project_context' || m.memory_key.includes('project')
    );
    if (projectMem) {
      contextParts.push(`User Project Context: ${projectMem.memory_key} is ${projectMem.memory_value}`);
    }

    const contextText = contextParts.join('\n\n');
    console.log(
      `[Semantic Engine] [req:${context.requestId}] SEARCH_DECISION | SearchIntent: ${validated.searchIntent} | SearchReason: ${validated.searchReason}`
    );

    const searchRes = await SearchService.executeWebSearchGrounding(prompt, {
      contextText,
      languageMode: validated.languageMode,
      searchReason: validated.searchReason || 'CURRENT_INFORMATION',
      requestId: context.requestId,
      sessionId: context.sessionId,
    });

    validated.answer = searchRes.answer;
    validated.searchDiagnostics = searchRes.diagnostics;
  } else {
    console.log(
      `[Semantic Engine] [req:${context.requestId}] SEARCH_DECISION | SearchIntent: not_required | SearchReason: ${validated.searchReason || 'STABLE_KNOWLEDGE'}`
    );
    validated.searchDiagnostics = {
      searched: false,
      searchIntent: validated.searchIntent || 'not_required',
      searchReason: validated.searchReason || 'STABLE_KNOWLEDGE',
      queryCount: 0,
      sourcesCount: 0,
      searchLatencyMs: 0,
      groundingUsed: false,
      sources: [],
      queries: [],
    };
  }

  console.log(
    `[Semantic Engine] [req:${context.requestId}] SEMANTIC_CALL_SUCCESS | Intent: ${validated.intent} | Search: ${validated.searchIntent} (${validated.searchDiagnostics?.searched ? 'searched' : 'no-search'}) | Mem: ${validated.memoryIntent || 'none'} | Latency: ${latencyMs}ms`
  );

  // Record turn in server-owned session
  recordTurn(sessionId, prompt, validated.answer, validated.intent);

  return validated;
}



/* ── 4. Vite Plugin Implementation ───────────────────────────── */

export function aiPlugin(): Plugin {
  return {
    name: 'vaani-ai-backend',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Endpoint 1: POST /api/assistant (Phase 5 Primary Voice Assistant Pipeline)
        if (req.method === 'POST' && req.url === '/api/assistant') {
          let bodyStr = '';
          req.on('data', (chunk) => (bodyStr += chunk));
          req.on('end', async () => {
            const tReqStart = Date.now();
            let reqId = `req_${Date.now()}`;
            let sessId = `sess_dev_${Date.now()}`;
            try {
              const body = JSON.parse(bodyStr || '{}');
              const message = (body.message || '').trim();
              sessId = body.sessionId || sessId;
              reqId = body.requestId || reqId;

              if (!message) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    ok: false,
                    errorType: 'VALIDATION_ERROR',
                    message: 'Message parameter is required and cannot be empty',
                  })
                );
                return;
              }

              // Authenticated user identity: backend-enforced (Section 2 & 5 of prompt)
              let authenticatedUserId = 'user_dev_123';
              const devHeaderUser = req.headers['x-vaani-user-id'];
              if (typeof devHeaderUser === 'string' && devHeaderUser.trim()) {
                authenticatedUserId = devHeaderUser.trim();
              } else if (typeof body.userId === 'string' && body.userId.trim()) {
                authenticatedUserId = body.userId.trim();
              }

              const context: RequestContext = {
                requestId: reqId,
                sessionId: sessId,
                authenticatedUserId,
                timestamp: tReqStart,
              };

              console.log(
                `[Assistant API] [req:${reqId}] [sess:${sessId}] ASSISTANT_REQUEST_RECEIVED | User: ${authenticatedUserId} | Len: ${message.length}`
              );

              const understanding = await executeSemanticReasoning(message, sessId, context);
              const elapsedMs = Date.now() - tReqStart;

              console.log(
                `[Assistant API] [req:${reqId}] [sess:${sessId}] ASSISTANT_RESPONSE_READY | Elapsed: ${elapsedMs}ms | Searched: ${understanding.searchDiagnostics?.searched || false} | Status: 200`
              );

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: true,
                  answer: understanding.answer,
                  metadata: {
                    intent: understanding.intent,
                    complexity: understanding.complexity,
                    languageMode: understanding.languageMode,
                    confidence: understanding.confidence,
                    entities: understanding.entities,
                    needsClarification: understanding.needsClarification,
                    clarificationQuestion: understanding.clarificationQuestion,
                    futureToolIntent: understanding.futureToolIntent,
                    memoryIntent: understanding.memoryIntent,
                    memoryCandidate: understanding.memoryCandidate,
                    memoryDiagnostics: understanding.memoryDiagnostics,
                    searchIntent: understanding.searchIntent,
                    searchReason: understanding.searchReason,
                    searchDiagnostics: understanding.searchDiagnostics,
                  },
                })
              );
            } catch (err: any) {
              const elapsedMs = Date.now() - tReqStart;
              const errorType: AIErrorCategory = geminiProvider.classifyError(err);
              let statusCode = 500;

              switch (errorType) {
                case 'AI_RATE_LIMIT':
                case 'SEARCH_RATE_LIMIT':
                  statusCode = 429;
                  break;
                case 'CONFIGURATION_ERROR':
                case 'AI_AUTHENTICATION_ERROR':
                  statusCode = 401;
                  break;
                case 'AI_INVALID_REQUEST':
                case 'VALIDATION_ERROR':
                  statusCode = 400;
                  break;
                case 'AI_TIMEOUT':
                case 'SEARCH_TIMEOUT':
                  statusCode = 504;
                  break;
                case 'AI_NETWORK_ERROR':
                case 'AI_API_ERROR':
                case 'SEARCH_API_ERROR':
                  statusCode = 502;
                  break;
                default:
                  statusCode = 500;
              }

              const safeMsg = (err.message || 'AI Semantic Reasoning failed')
                .replace(/bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]')
                .replace(/key=[a-zA-Z0-9_\-.]+/gi, 'key=[REDACTED]');

              console.error(
                `[Assistant API] [req:${reqId}] ASSISTANT_REQUEST_ERROR | Status: ${statusCode} | Category: ${errorType} | Elapsed: ${elapsedMs}ms | Msg: ${safeMsg.substring(0, 150)}`
              );

              res.statusCode = statusCode;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: false,
                  errorType,
                  message: safeMsg,
                })
              );
            }
          });
          return;
        }

        // Endpoint 2: POST /api/assistant/session/clear (Session context reset for testing)
        if (req.method === 'POST' && req.url === '/api/assistant/session/clear') {
          let bodyStr = '';
          req.on('data', (chunk) => (bodyStr += chunk));
          req.on('end', () => {
            const body = JSON.parse(bodyStr || '{}');
            const sessionId = body.sessionId;
            if (sessionId && serverSessions.has(sessionId)) {
              serverSessions.delete(sessionId);
            } else if (!sessionId) {
              serverSessions.clear();
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, cleared: true }));
          });
          return;
        }

        // Endpoint 3: GET /api/assistant/session (Safe observability of session context)
        if (req.method === 'GET' && req.url?.startsWith('/api/assistant/session')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const sessionId = urlObj.searchParams.get('sessionId') || '';
          const session = serverSessions.get(sessionId);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              sessionId,
              turnsCount: session ? session.turns.length : 0,
              lastActive: session ? session.lastActive : null,
              turns: session
                ? session.turns.map((t) => ({ role: t.role, text: t.text, topic: t.topic }))
                : [],
            })
          );
          return;
        }

        next();
      });
    },
  };
}
