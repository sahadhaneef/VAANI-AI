/**
 * Smart Action Router & Execution Service — Phase 9 Complex Task Orchestration
 *
 * Coordinates Understanding, Reasoning, Multi-Step Orchestration, Programmatic Tools,
 * and Natural Spoken Malayalam Conversations.
 */

import type {
  VoiceResponse,
  ConversationContext,
  QuickAction,
} from '../types/assistant';
import { UnderstandingService } from './understandingService';
import { ToolOrchestrator } from './toolOrchestrator';
import { ReasoningEngine } from './reasoningEngine';

import { aiService } from './aiService';
import { sessionMemoryService } from './sessionMemoryService';

export class ActionService {
  private activeContext: ConversationContext | null = null;

  getActiveContext(): ConversationContext | null {
    return this.activeContext;
  }

  clearContext(): void {
    this.activeContext = null;
  }

  /**
   * Process spoken input through Phase 9 8-Layer Intelligence Pipeline
   */
  async processVoiceCommand(spokenSpeech: string): Promise<VoiceResponse> {
    const rawSpeech = spokenSpeech.trim();



    // 2. Comprehensive Understanding Analysis
    const understood = UnderstandingService.analyzeSpeech(rawSpeech, this.activeContext);

    // 3. Multi-Step Compound Task Orchestration
    if (understood.isMultiStep && understood.taskComplexity === 'MULTI_STEP') {
      const plan = ReasoningEngine.createMultiStepPlan(rawSpeech, understood.subTasks);
      const multiResult = await ToolOrchestrator.executeMultiStepPlan(plan);
      sessionMemoryService.recordExchange(rawSpeech, multiResult.text, 'MULTI_STEP');
      return multiResult;
    }

    // 4. (Removed hardcoded reasoning interceptors)

    // 5. Semantic Dispatch to AI Engine
    // Phase 11 delegates task execution natively to the AI Backend using Gemini tools.
    return await aiService.processSpeech(rawSpeech, understood.primaryIntent);
  }



  getAvailableActions(): QuickAction[] {
    return [
      {
        id: 'weather',
        label: 'Weather',
        icon: '🌤️',
        demoQuery: 'Innathe Kochiyile weather engane aanu?',
        demoResponse: 'ഇന്ന് കൊച്ചിയിൽ താപനില 29 ഡിഗ്രി സെൽഷ്യസ് ആണ്. അന്തരീക്ഷം ഭാഗികമായി മേഘാവൃതമാണ്.',
      },
      {
        id: 'reminder',
        label: 'Reminder',
        icon: '⏰',
        demoQuery: 'Nale ravile 8 manikku enne remind cheyyanam.',
        demoResponse: 'ശരി, നാളെ രാവിലെ 8 മണിക്ക് ഞാൻ നിങ്ങളെ ഓർമ്മിപ്പിക്കാം.',
      },
      {
        id: 'note',
        label: 'Note',
        icon: '📝',
        demoQuery: 'Note cheyyu, tomorrow client meeting undu.',
        demoResponse: 'ശരി, note save ചെയ്തു.',
      },
      {
        id: 'calculator',
        label: 'Calculator',
        icon: '🧮',
        demoQuery: '12500 plus 18 percent GST എത്രയാണ്?',
        demoResponse: '12,500 രൂപയും 18% GSTയും കൂട്ടുമ്പോൾ ആകെ 14,750 രൂപയാണ്.',
      },
    ];
  }

  async executeAction(action: QuickAction): Promise<string> {
    await new Promise((r) => setTimeout(r, 200));
    return action.demoResponse;
  }
}

export const actionService = new ActionService();
