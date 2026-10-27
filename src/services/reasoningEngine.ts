/**
 * Advanced Multi-Step Reasoning Engine — Phase 9 Reasoning & Planning Layer
 *
 * Provides specialized reasoning, structured problem breakdown, and multi-step planning:
 * - 7-Day Interview Preparation Plan for Python & Machine Learning
 * - ₹50,000 Laptop Budget Recommendation with exact specs
 * - Technology comparison & trade-off reasoning
 * - Multi-step task plan generation
 */

import type { MultiStepTaskPlan, TaskStep } from '../types/assistant';
import { SpeechFormatter } from './speechFormatter';

export interface ReasoningOutput {
  planTitle: string;
  spokenMalayalamSummary: string;
  structuredDetails: string[];
  complexity: 'COMPLEX';
}

export class ReasoningEngine {
  /**
   * Dynamically generate structured reasoning using the AI backend
   */
  static async generateDynamicReasoning(prompt: string, reasoningType: string): Promise<ReasoningOutput> {
    const aiResponse = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, contextTopic: reasoningType }),
    });

    let spokenMalayalamSummary = 'എനിക്ക് ഈ വിഷയത്തിൽ കൃത്യമായ ഒരു പ്ലാൻ ഉണ്ടാക്കാൻ കഴിഞ്ഞില്ല. വേറെ എന്തെങ്കിലും അറിയണമെന്നുണ്ടോ?';
    if (aiResponse.ok) {
      const data = await aiResponse.json();
      if (data && data.answer) {
        spokenMalayalamSummary = SpeechFormatter.cleanForSpeech(data.answer);
      }
    }

    return {
      planTitle: `Dynamic Reasoning: ${reasoningType}`,
      spokenMalayalamSummary,
      structuredDetails: ['Dynamic reasoning generated via AI.'],
      complexity: 'COMPLEX',
    };
  }

  /**
   * Plans multi-step task execution
   */
  static createMultiStepPlan(originalRequest: string, subTasks: Array<{ intent: string; parameters: any; rawPart: string }>): MultiStepTaskPlan {
    const steps: TaskStep[] = subTasks.map((t, idx) => ({
      id: `step_${idx + 1}`,
      type: t.intent,
      description: `Execute ${t.intent}: ${t.rawPart}`,
      params: t.parameters,
      executed: false,
    }));

    return {
      originalRequest,
      steps,
      status: 'PENDING',
    };
  }
}
