/**
 * Tool Orchestrator Engine — Phase 9 Tool Execution Layer
 *
 * Central dispatcher for programmatic tools:
 * - Calculator (arithmetic, percentages, discounts, GST)
 * - Weather (Open-Meteo live forecasts)
 * - Reminder (creation, modification, session memory)
 * - Note (creation, retrieval)
 * - AI Knowledge Endpoint (/api/ai backend)
 * - Multi-Step Task Orchestration
 */

import type { MultiStepTaskPlan, VoiceResponse } from '../types/assistant';
import { CalculatorService } from './calculatorService';
import { WeatherService } from './weatherService';
import { ReminderService } from './reminderService';
import { NoteService } from './noteService';
import { VerificationService } from './verificationService';
import { sessionMemoryService } from './sessionMemoryService';

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data: any;
  spokenOutput: string;
}

export class ToolOrchestrator {
  /**
   * Execute Calculator Tool
   */
  static executeCalculator(expression: string): ToolExecutionResult {
    const calcResult = CalculatorService.calculate(expression);
    const verification = VerificationService.verifyCalculation(calcResult);

    return {
      toolName: 'CALCULATOR',
      success: verification.isValid,
      data: calcResult,
      spokenOutput: verification.verifiedText,
    };
  }

  /**
   * Execute Weather Tool
   */
  static async executeWeather(location: string): Promise<ToolExecutionResult> {
    try {
      const weatherResult = await WeatherService.getWeather(location);
      return {
        toolName: 'WEATHER',
        success: true,
        data: weatherResult,
        spokenOutput: weatherResult.spokenResponse,
      };
    } catch (e) {
      return {
        toolName: 'WEATHER',
        success: false,
        data: null,
        spokenOutput: 'ക്ഷമിക്കണം, കാലാവസ്ഥാ വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമായില്ല.',
      };
    }
  }

  /**
   * Execute Reminder Tool
   */
  static async executeReminder(params: { title?: string; date?: string; time?: string }): Promise<ToolExecutionResult> {
    const title = params.title || 'Reminder';
    const date = params.date || 'Tomorrow';
    const time = params.time || '08:00 AM';

    const saved = await ReminderService.addReminder(title, date, time);
    if (saved) {
      sessionMemoryService.setLastReminder(saved);
      const verification = VerificationService.verifyReminderCreated(saved);

      return {
        toolName: 'REMINDER',
        success: verification.isValid,
        data: saved,
        spokenOutput: verification.verifiedText,
      };
    }
    
    return {
      toolName: 'REMINDER',
      success: false,
      data: null,
      spokenOutput: 'ക്ഷമിക്കണം, റിമൈൻഡർ സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല.'
    };
  }

  /**
   * Execute Note Tool
   */
  static executeNote(params: { content?: string }): ToolExecutionResult {
    const content = params.content || 'Note';
    const saved = NoteService.addNote(content);
    const verification = VerificationService.verifyNoteCreated(saved);

    return {
      toolName: 'NOTE',
      success: verification.isValid,
      data: saved,
      spokenOutput: verification.verifiedText,
    };
  }

  /**
   * Execute Backend AI Knowledge Query (/api/ai)
   */
  static async executeAiKnowledge(query: string, history?: any[], requestId?: string): Promise<{ answer: string | null; errorType: string | null; }> {
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history, requestId, sessionId: 'client_sess_1' }),
      });

      const data = await res.json().catch(() => null);
      
      if (!res.ok || (data && data.ok === false)) {
        return { answer: null, errorType: data?.error?.type || 'UNKNOWN_ERROR' };
      }
      
      return { answer: data?.answer || null, errorType: null };
    } catch (e) {
      return { answer: null, errorType: 'NETWORK_ERROR' };
    }
  }

  /**
   * Execute Multi-Step Plan sequentially
   */
  static async executeMultiStepPlan(plan: MultiStepTaskPlan): Promise<VoiceResponse> {
    plan.status = 'EXECUTING';
    const stepOutputs: string[] = [];
    const toolsUsed: string[] = [];

    for (const step of plan.steps) {
      if (step.type === 'CREATE_REMINDER') {
        const res = await this.executeReminder(step.params);
        step.executed = true;
        step.success = res.success;
        step.result = res.spokenOutput;
        stepOutputs.push(res.spokenOutput);
        toolsUsed.push('Reminder');
      } else if (step.type === 'CREATE_NOTE') {
        const res = this.executeNote(step.params);
        step.executed = true;
        step.success = res.success;
        step.result = res.spokenOutput;
        stepOutputs.push(res.spokenOutput);
        toolsUsed.push('Note');
      } else if (step.type === 'CALCULATE') {
        const expr = step.params?.mathExpr || step.description;
        const res = this.executeCalculator(expr);
        step.executed = true;
        step.success = res.success;
        step.result = res.spokenOutput;
        stepOutputs.push(res.spokenOutput);
        toolsUsed.push('Calculator');
      } else if (step.type === 'GET_WEATHER') {
        const loc = step.params?.location || 'Kochi';
        const res = await this.executeWeather(loc);
        step.executed = true;
        step.success = res.success;
        step.result = res.spokenOutput;
        stepOutputs.push(res.spokenOutput);
        toolsUsed.push('Weather');
      }
    }

    plan.status = 'COMPLETED';

    // Combine outputs into a single coherent spoken response
    // E.g., "ശരി, നാളെ 8:00 AM മണിക്ക് meeting ഞാൻ ഓർമ്മിപ്പിക്കാം. കൂടാതെ, note save ചെയ്തു."
    let combinedSpoken = stepOutputs.join(' കൂടാതെ, ');
    if (combinedSpoken.endsWith('.')) {
      // Clean duplicate periods
      combinedSpoken = combinedSpoken.replace(/\.\s*കൂടാതെ,\s*/g, '. കൂടാതെ, ');
    }
    plan.finalSpeechSummary = combinedSpoken;

    return {
      text: combinedSpoken,
      actionExecuted: `MULTI_STEP: ${toolsUsed.join(' + ')}`,
      executingMessage: `Executed ${plan.steps.length} actions: ${toolsUsed.join(', ')}`,
      analysis: {
        language: 'Malayalam',
        intent: 'MULTI_STEP_ACTION',
        emotion: 'Accomplished',
        confidence: 99,
        action: `Multi-Step: ${toolsUsed.join(' + ')}`,
        contextStatus: 'Active',
      },
    };
  }
}
