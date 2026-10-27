/**
 * Conversational Malayalam AI Engine — Natural Intelligent Brain (Phase 9)
 *
 * Coordinates Layered Intelligence:
 * - Knowledge retrieval via ToolOrchestrator
 * - Speech formatting via SpeechFormatter (spoken Malayalam connectors, 0 markdown/bullets)
 * - Factual verification via VerificationService (anti-hallucination)
 * - Multi-turn conversational context via SessionMemoryService
 * - Fully analyzes user speech without ever repeating or quoting raw user input.
 */

import type { VoiceResponse, AIAnalysis, UnderstandingResult } from '../types/assistant';
import { sessionMemoryService } from './sessionMemoryService';
import { ToolOrchestrator } from './toolOrchestrator';
import { SpeechFormatter } from './speechFormatter';
import { VerificationService } from './verificationService';

export interface AIDebugStatus {
  lastSpokenInput: string;
  generatedText: string;
  languageDetected: string;
  intentDetected: string;
  sentimentDetected: string;
  isAiSuccess: boolean;
  activeTopic?: string;
  referencedEntity?: string;
  complexity?: string;
  futureToolIntent?: string | null;
  memoryIntent?: string | null;
  memoryCandidate?: Record<string, any> | null;
  memoryDiagnostics?: Record<string, any>;
  searchIntent?: string | null;
  searchReason?: string | null;
  searchDiagnostics?: Record<string, any>;
  entities?: Record<string, any>;
  needsClarification?: boolean;
  understandingResult?: UnderstandingResult;
  lastUnderstanding?: UnderstandingResult;
}

export interface IAIService {
  processSpeech(spokenText: string, intentDetectedParam?: string): Promise<VoiceResponse>;
  getDebugStatus(): AIDebugStatus;
  setLastUnderstanding(spoken: string, answer: string, understanding?: UnderstandingResult): void;
}

class MalayalamAIBrain implements IAIService {
  private debugStatus: AIDebugStatus = {
    lastSpokenInput: '',
    generatedText: '',
    languageDetected: 'Malayalam',
    intentDetected: 'General',
    sentimentDetected: 'NEUTRAL',
    isAiSuccess: true,
  };

  getDebugStatus(): AIDebugStatus {
    return this.debugStatus;
  }

  setLastUnderstanding(spoken: string, answer: string, understanding?: UnderstandingResult): void {
    this.debugStatus.lastSpokenInput = spoken;
    this.debugStatus.generatedText = answer;
    if (understanding) {
      this.debugStatus.intentDetected = understanding.intent;
      this.debugStatus.languageDetected = understanding.languageMode;
      this.debugStatus.complexity = understanding.complexity;
      this.debugStatus.futureToolIntent = understanding.futureToolIntent;
      this.debugStatus.memoryIntent = understanding.memoryIntent || null;
      this.debugStatus.memoryCandidate = understanding.memoryCandidate || null;
      this.debugStatus.memoryDiagnostics = understanding.memoryDiagnostics;
      this.debugStatus.searchIntent = understanding.searchIntent || null;
      this.debugStatus.searchReason = understanding.searchReason || null;
      this.debugStatus.searchDiagnostics = understanding.searchDiagnostics;
      this.debugStatus.entities = understanding.entities;
      this.debugStatus.needsClarification = understanding.needsClarification;
      this.debugStatus.understandingResult = understanding;
      this.debugStatus.lastUnderstanding = understanding;
      if (understanding.entities?.products?.length) {
        this.debugStatus.referencedEntity = understanding.entities.products[0];
      }
    }
  }

  async processSpeech(spokenText: string, intentDetectedParam: string = 'UNKNOWN'): Promise<VoiceResponse> {
    const rawInput = spokenText.trim();
    const lowerInput = rawInput.toLowerCase();
    const memory = sessionMemoryService.getMemory();
    const activeTopic = memory.activeTopic;
    const reqId = Date.now().toString();

    // 0. UNCLEAR / GARBLED SPEECH CHECK
    if (rawInput.length <= 2 || lowerInput === 'um' || lowerInput === 'ah') {
      const resp = 'ശബ്ദം വ്യക്തമായില്ല. ഒന്ന് കൂടി പറയാമോ?';
      console.log(`[${reqId}] UNCLEAR SPEECH -> Fallback: ${resp}`);
      return {
        text: resp,
        analysis: {
          language: 'Malayalam',
          intent: 'UNCLEAR_SPEECH',
          questionType: 'UNCLEAR_SPEECH',
          emotion: 'NEUTRAL',
          confidence: 90,
          action: 'Ask to repeat',
          contextStatus: 'Idle',
        },
      };
    }

    // 1. GREETING CHECK (Removed hardcoded greetings - routed to AI natively)

    // 2. Call the AI Backend with history
    const history = memory.conversationTurns.map(t => ({ role: t.role, text: t.text }));
    const aiResult = await ToolOrchestrator.executeAiKnowledge(rawInput, history, reqId);
    
    let responseText = aiResult.answer || '';
    let fallbackUsed = false;
    let fallbackReason = 'NONE';

    if (aiResult.errorType) {
      fallbackUsed = true;
      fallbackReason = aiResult.errorType;
      switch (aiResult.errorType) {
        case 'AI_RATE_LIMIT':
          responseText = 'ഇപ്പോൾ AI സേവനവുമായി ബന്ധപ്പെടാൻ കഴിഞ്ഞില്ല. കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കാം.';
          break;
        case 'AUTHENTICATION_ERROR':
          responseText = 'AI സേവനത്തിന്റെ ക്രമീകരണത്തിൽ ഒരു പ്രശ്നമുണ്ട്.';
          break;
        case 'CONFIGURATION_ERROR':
          responseText = 'VAANIയുടെ AI സേവനം ഇപ്പോൾ ശരിയായി ക്രമീകരിച്ചിട്ടില്ല.';
          break;
        case 'AI_TIMEOUT':
          responseText = 'മറുപടി തയ്യാറാക്കാൻ കൂടുതൽ സമയം എടുത്തു. വീണ്ടും ശ്രമിക്കാം.';
          break;
        case 'SEARCH_ERROR':
          responseText = 'ഇപ്പോൾ ഇന്റർനെറ്റിൽ നിന്ന് വിവരങ്ങൾ ലഭ്യമാക്കാൻ കഴിഞ്ഞില്ല.';
          break;
        case 'TOOL_ERROR':
          responseText = 'ആ പ്രവർത്തനം ഇപ്പോൾ പൂർത്തിയാക്കാൻ കഴിഞ്ഞില്ല.';
          break;
        case 'NETWORK_ERROR':
          responseText = 'ഇന്റർനെറ്റ് കണക്ഷൻ ലഭ്യമായെന്ന് ഉറപ്പുവരുത്തുക.';
          break;
        default:
          responseText = 'ഇപ്പോൾ ഒരു പ്രശ്നം സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കാം.';
      }
    } else if (!responseText || responseText.length < 2) {
      fallbackUsed = true;
      fallbackReason = 'EMPTY_AI_RESPONSE';
      responseText = 'അതിനെക്കുറിച്ച് എനിക്ക് ഉറപ്പുള്ള വിവരം ഇല്ല.';
    }

    // 3. INTERNAL LOGGING FOR DEBUGGING
    console.log('\n==================================================');
    console.log('REQUEST ID:', reqId);
    console.log('RAW TRANSCRIPT:', rawInput);
    console.log('INTENT:', intentDetectedParam);
    console.log('AI RESPONSE RECEIVED:', !!aiResult.answer);
    console.log('FINAL RESPONSE:', responseText);
    console.log('FALLBACK USED?:', fallbackUsed);
    if (fallbackUsed) console.log('FALLBACK REASON:', fallbackReason);
    console.log('==================================================\n');

    // Run verification on the final response
    const verification = VerificationService.verifyFactualIntegrity(rawInput, responseText);
    responseText = SpeechFormatter.cleanForSpeech(verification.verifiedText);

    const analysisMeta: AIAnalysis = {
      language: rawInput.match(/[\u0D00-\u0D7F]/) ? 'Malayalam' : 'English / Manglish',
      intent: intentDetectedParam,
      questionType: 'AI_GENERATED',
      emotion: 'NEUTRAL',
      confidence: verification.confidence,
      action: 'Conversational Spoken Response',
      contextStatus: 'Active',
    };

    sessionMemoryService.recordExchange(rawInput, responseText, intentDetectedParam, activeTopic);

    this.debugStatus = {
      lastSpokenInput: rawInput,
      generatedText: responseText,
      languageDetected: analysisMeta.language,
      intentDetected: intentDetectedParam,
      sentimentDetected: 'NEUTRAL',
      isAiSuccess: !fallbackUsed,
      activeTopic,
      referencedEntity: sessionMemoryService.getReferencedEntity(),
    };

    return {
      text: responseText,
      analysis: analysisMeta,
    };
  }
}

export const aiService: IAIService = new MalayalamAIBrain();
