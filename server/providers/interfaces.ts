/**
 * VAANI AI — Backend Provider Abstractions (Phase 1 Foundation)
 * 
 * Defines clean interfaces for external integrations (STT, TTS, AI, etc.)
 * Ensures that specific implementations (e.g., Google Cloud vs Web Speech)
 * can be swapped without rewriting the orchestrator.
 */

export interface RequestContext {
  requestId: string;
  sessionId: string;
  authenticatedUserId: string; // The server-verified user ID
  timestamp: number;
  locale?: string;
  timezone?: string;
}

export interface STTOptions {
  languageCode?: string;
  autoDetectLanguage?: boolean;
  verbatim?: boolean;
  providerId?: 'gemini-3.5-transcribe' | 'google-cloud-v2' | 'google-cloud-v1';
}

export interface ISTTProvider {
  readonly id: string;
  readonly name: string;
  /**
   * Transcribes a base64 encoded audio blob into text.
   */
  transcribe(
    audioBase64: string,
    mimeType: string,
    options: STTOptions,
    context: RequestContext
  ): Promise<STTResult>;
}

export interface STTResult {
  rawTranscript: string;
  transcript: string;
  confidence: number | null;
  sttProvider: string;
  model: string;
  languageCode: string;
  languageConfigUsed: 'explicit_ml-IN' | 'auto_detect';
  durationMs?: number;
  latencyMs?: number;
  audioSize: number;
  mimeType: string;
  status: 'RUN' | 'NOT_RUN' | 'ERROR';
  errorCode?: string;
  errorDetails?: string;
}

export interface ITTSProvider {
  /**
   * Synthesizes text into a base64 encoded audio stream (e.g., MP3).
   */
  synthesize(text: string, voiceName: string, context: RequestContext): Promise<TTSResult>;
}

export interface TTSResult {
  audioContent: string; // base64
  voiceUsed: string;
  format: string;
  durationEstimateMs: number;
  audioByteCount?: number;
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
  confidence: number | null; // Never invented; null if uncalibrated
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

export type AIErrorCategory =
  | 'AI_RATE_LIMIT'
  | 'AI_AUTHENTICATION_ERROR'
  | 'AI_INVALID_REQUEST'
  | 'AI_TIMEOUT'
  | 'AI_NETWORK_ERROR'
  | 'AI_API_ERROR'
  | 'AI_INVALID_STRUCTURED_OUTPUT'
  | 'SEARCH_RATE_LIMIT'
  | 'SEARCH_TIMEOUT'
  | 'SEARCH_API_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

export interface IAIProvider {
  readonly id: string;
  readonly name: string;
  /**
   * Generates a multi-turn response using tools where necessary.
   */
  generateContent(prompt: string, history: Array<{role: string, text: string}>, context: RequestContext): Promise<AIResult>;

  /**
   * Performs core semantic reasoning, returning structured UnderstandingResult.
   */
  understand(
    prompt: string,
    history: Array<{ role: 'user' | 'model'; text: string }>,
    context: RequestContext,
    memoryPromptBlock?: string
  ): Promise<UnderstandingResult>;
}

export interface AIResult {
  answer: string;
  responseText: string;
  source: string;
  confidence: number;
  grounding?: boolean;
  metadata?: UnderstandingResult;
}

// Future expansion interfaces (Phase 1 establishes the contracts)

export interface ISearchProvider {
  search(query: string, context: RequestContext): Promise<any>;
}

export interface IMemoryProvider {
  saveMemory(userId: string, key: string, value: string): Promise<boolean>;
  getMemory(userId: string, key: string): Promise<string | null>;
}

export interface IReminderProvider {
  createReminder(userId: string, details: any): Promise<any>;
  getReminders(userId: string): Promise<any[]>;
}

export interface ICalculatorProvider {
  calculate(expression: string): number;
}

export interface IWeatherProvider {
  getWeather(location: string): Promise<any>;
}

export interface IProductResearchProvider {
  searchProduct(query: string, context: RequestContext): Promise<any>;
}

export interface IImageGenerationProvider {
  generateImage(prompt: string, context: RequestContext): Promise<any>;
}
