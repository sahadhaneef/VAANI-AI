/**
 * VAANI AI — Voice Architecture, Smart Actions & Session Memory Types
 */

/* ── Voice State Machine (Phase 2) ────────────────── */

export type VoiceUIState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'thinking'
  | 'searching'
  | 'tool_running'
  | 'speaking'
  | 'error'
  | 'retry';

/**
 * Backward compatibility alias for existing services/components.
 * Includes legacy 'ready' and 'executing' during Phase 2 migration.
 */
export type VoiceState = VoiceUIState | 'ready' | 'executing';

export type FailureStage =
  | 'NONE'
  | 'MICROPHONE_FAILURE'
  | 'AUDIO_FAILURE'
  | 'STT_FAILURE'
  | 'AI_UNDERSTANDING_FAILURE';

export type AudioErrorCode =
  | 'NONE'
  | 'MIC_PERMISSION_DENIED'
  | 'MIC_UNAVAILABLE'
  | 'RECORDER_NOT_SUPPORTED'
  | 'AUDIO_EMPTY'
  | 'AUDIO_TOO_SHORT'
  | 'AUDIO_INVALID'
  | 'AUDIO_FINALIZATION_ERROR'
  | 'AUDIO_ENCODING_ERROR'
  | 'RECORDING_ALREADY_ACTIVE'
  | 'STALE_REQUEST'
  | 'STT_HANDOFF_ERROR'
  | 'UNKNOWN_AUDIO_ERROR';

export type RecordingLifecycleState =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'stopping'
  | 'finalizing_audio'
  | 'stt'
  | 'processing'
  | 'error';

export type TaskComplexity = 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'MULTI_STEP';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  intent?: string;
  topic?: string;
  timestamp: number;
}

export interface TaskStep {
  id: string;
  type: string;
  description: string;
  params: any;
  executed?: boolean;
  success?: boolean;
  result?: string;
}

export interface MultiStepTaskPlan {
  originalRequest: string;
  steps: TaskStep[];
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  finalSpeechSummary?: string;
}

export type STTProviderId = 'google-cloud-v2' | 'google-cloud-v1';

export interface STTBenchmarkTestCase {
  id: string;
  category: string;
  language: string;
  groundTruth: string;
  notes?: string;
  expectedKeywords?: string[];
  expectedNumbers?: string[];
  expectedDateTime?: string[];
  expectedTechnicalTerms?: string[];
}

export interface STTBenchmarkEvaluation {
  wer: number;
  cer: number;
  wordSubstitutions: number;
  wordDeletions: number;
  wordInsertions: number;
  numberAccuracy?: { score: number; found: string[]; expected: string[] };
  dateTimeAccuracy?: { score: number; found: string[]; expected: string[] };
  technicalTermAccuracy?: { score: number; found: string[]; expected: string[] };
  keywordAccuracy?: { score: number; found: string[]; expected: string[] };
  passed: boolean;
}

export interface AudioDiagnostics {
  recordingDurationMs: number;
  audioSize: number;
  mimeType: string;
  chunksCount: number;
  sttProvider: string;
  sttStatus: 'idle' | 'recording' | 'uploading' | 'success' | 'error';
  micPermission?: 'granted' | 'denied' | 'prompt' | 'unavailable' | 'unknown';
  trackState?: 'live' | 'ended' | 'none';
  trackEnabled?: boolean;
  failureStage?: FailureStage;
  isSttTestMode?: boolean;
  taskComplexity?: TaskComplexity;
  toolUsed?: string;
  // Phase 3 additions
  requestId?: string;
  recordingState?: RecordingLifecycleState;
  sampleRate?: number;
  channelCount?: number;
  startTime?: number;
  stopTime?: number;
  errorCode?: AudioErrorCode;
  errorMessage?: string;
  finalizationStatus?: 'idle' | 'in_progress' | 'completed' | 'failed';
  // Phase 4 additions
  providerId?: STTProviderId;
  model?: string;
  languageConfigUsed?: 'explicit_ml-IN' | 'auto_detect';
  status?: 'RUN' | 'NOT_RUN' | 'ERROR';
  providerLatencyMs?: number;
  uploadLatencyMs?: number;
  evaluation?: STTBenchmarkEvaluation;
  rawGroundTruth?: string;
}

/* ── Sentiment State ───────────────────────────────── */

export type SentimentState =
  | 'NEUTRAL'
  | 'HAPPY'
  | 'SAD'
  | 'ANGRY'
  | 'FRUSTRATED'
  | 'CONFUSED'
  | 'URGENT';

/* ── Voice Session (History record of voice interaction) ─── */

export interface VoiceSession {
  id: string;
  requestId?: string;
  sessionId?: string;
  timestamp: Date;
  transcript: string;
  rawTranscript?: string;
  aiResponse: string;
  language: 'ml' | 'en' | 'mixed';
  durationMs?: number;
  intent?: string;
  sentiment?: SentimentState;
  analysis?: AIAnalysis;
}

/* ── Session Conversational Memory ─────────────────── */

export interface SessionMemory {
  userName?: string;
  lastUserSpeech?: string;
  lastAssistantResponse?: string;
  lastIntent?: string;
  lastReminder?: ReminderItem;
  activeTopic?: string;
  referencedEntity?: string;
  conversationTurns: ConversationTurn[];
  contextData: Record<string, any>;
  sessionStartedAt: Date;
}

export type FutureToolIntent =
  | 'product_request'
  | 'calculation_request'
  | 'reminder_request'
  | 'current_information_request'
  | 'image_request'
  | null;

export type SemanticComplexity = 'simple' | 'moderate' | 'complex' | 'multi_step';
export type LanguageMode = 'malayalam' | 'manglish' | 'english' | 'mixed';

export interface SemanticEntities {
  date: string | null;
  time: string | null;
  people: string[];
  products: string[];
  locations: string[];
  amounts: string[];
  constraints: string[];
  references: string[];
  brand: string | null;
  technicalTerms: string[];
}

export type MemoryType =
  | 'preference'
  | 'personal_fact'
  | 'project_context'
  | 'instruction'
  | 'goal'
  | 'relationship'
  | 'other';

export type MemoryIntent =
  | 'store'
  | 'retrieve'
  | 'update'
  | 'forget'
  | 'list'
  | null;

export interface MemoryRecord {
  id: string;
  user_id: string;
  memory_key: string;
  memory_value: string;
  memory_type: MemoryType;
  source?: string;
  confidence?: number;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string | null;
  is_active: number;
  metadata_json?: string | null;
}

export interface MemoryCandidate {
  key: string;
  value: string;
  type: MemoryType;
}

export interface MemoryDiagnostics {
  memoryIntent: MemoryIntent;
  memoryOperation: 'created' | 'updated' | 'deactivated' | 'retrieved' | 'refused' | 'none';
  memoryId?: string;
  memoryType?: MemoryType;
  retrievalCount: number;
  retrievalLatencyMs: number;
  dbStatus: 'OK' | 'ERROR' | 'IDLE';
  errorMessage?: string;
}

export type SearchIntent = 'required' | 'optional' | 'not_required';

export type SearchReason =
  | 'CURRENT_INFORMATION'
  | 'EXPLICIT_SEARCH_REQUEST'
  | 'UNKNOWN_FACT'
  | 'SOURCE_REQUEST'
  | 'STABLE_KNOWLEDGE'
  | 'CASUAL_CONVERSATION';

export interface SearchSource {
  title: string;
  url: string;
}

export interface SearchDiagnostics {
  searched: boolean;
  searchIntent: SearchIntent;
  searchReason: SearchReason;
  queryCount: number;
  sourcesCount: number;
  searchLatencyMs: number;
  groundingUsed: boolean;
  sources: SearchSource[];
  queries: string[];
  errorMessage?: string;
  errorCategory?: string;
  httpStatus?: number;
}

export interface UnderstandingResult {
  intent: string;
  complexity: SemanticComplexity;
  languageMode: LanguageMode;
  confidence: number | null;
  entities: SemanticEntities;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  futureToolIntent: FutureToolIntent;
  memoryIntent?: MemoryIntent;
  memoryCandidate?: MemoryCandidate | null;
  memoryDiagnostics?: MemoryDiagnostics;
  searchIntent?: SearchIntent;
  searchReason?: SearchReason;
  searchDiagnostics?: SearchDiagnostics;
  answer: string;
}

/* ── AI Analysis Metadata ──────────────────────────── */

export interface AIAnalysis {
  language: string;
  intent: string;
  questionType?: string;
  emotion: string;
  confidence: number;
  action: string;
  contextStatus: 'Active' | 'Idle' | 'Expired';
  metadata?: UnderstandingResult;
}

/* ── Smart Action Item Types ───────────────────────── */

export interface ReminderItem {
  id: string;
  title: string;
  dateStr: string;
  timeStr: string;
  createdAt: Date;
}

export interface NoteItem {
  id: string;
  content: string;
  createdAt: Date;
}

export interface WeatherResult {
  city: string;
  temperature: number;
  condition: string;
  humidity?: number;
  windSpeed?: number;
}

/* ── Intent Detection Payloads ─────────────────────── */

export type IntentType =
  | 'GREETING'
  | 'SMALL_TALK'
  | 'CREATE_REMINDER'
  | 'MODIFY_REMINDER'
  | 'CREATE_NOTE'
  | 'CALCULATE'
  | 'GET_WEATHER'
  | 'WEATHER_FOLLOWUP'
  | 'GENERAL_QUERY'
  | 'FOLLOWUP_RESPONSE'
  | 'NAME_STATEMENT'
  | 'NAME_QUERY'
  | 'UNCERTAIN'
  | 'UNKNOWN'
  | 'QUESTION'
  | 'INFORMATION_REQUEST'
  | 'SEARCH'
  | 'EXPLANATION'
  | 'COMPARISON'
  | 'PLANNING'
  | 'MULTI_STEP_TASK'
  | 'CLARIFICATION_REQUIRED';

export interface IntentParameters {
  title?: string;
  date?: string;
  time?: string;
  content?: string;
  location?: string;
  mathExpr?: string;
  userName?: string;
  sentiment?: SentimentState;
}

export interface ParsedIntent {
  intent: IntentType;
  confidence: number;
  parameters: IntentParameters;
  sentiment: SentimentState;
  rawSpeech: string;
}

/* ── Multi-Turn Conversation Context ───────────────── */

export interface ConversationContext {
  pendingIntent?: IntentType;
  missingParam?: 'title' | 'time' | 'content' | 'location';
  partialData?: IntentParameters;
  lastUpdated: number;
}

/* ── Quick Voice Prompts ───────────────────────────── */

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  demoQuery: string;
  demoResponse: string;
}

/* ── User Profile & Voice Statistics ───────────────── */

export interface VoiceStats {
  name: string;
  avatar?: string;
  totalSessions: number;
  commandsCompleted: number;
  malayalamInteractions: number;
  mixedInteractions: number;
}

/* ── Pipeline Interface Payloads ───────────────────── */

export interface SpeechResult {
  transcript: string;
  rawTranscript: string;
  language: 'ml' | 'en' | 'mixed';
  confidence: number | null;
  providerId?: STTProviderId;
  providerName?: string;
  model?: string;
  status?: 'RUN' | 'NOT_RUN' | 'ERROR';
  diagnostics?: AudioDiagnostics;
  isFinal?: boolean;
}

export interface VoiceResponse {
  text: string;
  analysis: AIAnalysis;
  actionExecuted?: string;
  executingMessage?: string;
}
