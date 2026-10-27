/**
 * Natural Language Understanding Engine — Phase 9 Understanding Layer
 *
 * Analyzes spoken speech across Malayalam, Manglish, and English.
 * - Categorizes task complexity: SIMPLE, MODERATE, COMPLEX, MULTI_STEP.
 * - Identifies compound multi-step commands (e.g. reminder + note in a single sentence).
 * - Resolves conversational pronouns and entities using SessionMemory.
 * - Extracts temporal parameters, numbers, budgets, and domain entities.
 */

import type { IntentType, TaskComplexity, ConversationContext } from '../types/assistant';
import { IntentService } from './intentService';
import { sessionMemoryService } from './sessionMemoryService';

export interface SubTask {
  intent: IntentType;
  parameters: Record<string, any>;
  rawPart: string;
}

export interface UnderstoodSpeech {
  rawText: string;
  resolvedText: string;
  language: 'ml' | 'en' | 'mixed';
  taskComplexity: TaskComplexity;
  isMultiStep: boolean;
  subTasks: SubTask[];
  primaryIntent: IntentType;
  parameters: Record<string, any>;
  requiresReasoning: boolean;
  requiresTool: boolean;
  toolType?: 'calculator' | 'weather' | 'reminder' | 'note' | 'ai_knowledge';
  reasoningType?: 'INTERVIEW_PLAN' | 'LAPTOP_RECOMMENDATION' | 'COMPARISON' | 'GENERAL_REASONING';
}

export class UnderstandingService {
  /**
   * Main analysis pipeline for incoming voice transcript
   */
  static analyzeSpeech(spokenText: string, activeContext?: ConversationContext | null): UnderstoodSpeech {
    const rawText = spokenText.trim();
    const resolvedText = sessionMemoryService.resolveEntityReference(rawText);

    // 1. Language Detection
    const hasMalayalamScript = /[\u0D00-\u0D7F]/.test(rawText);
    const hasEnglishWords = /[a-zA-Z]/.test(rawText);
    const language: 'ml' | 'en' | 'mixed' =
      hasMalayalamScript && hasEnglishWords
        ? 'mixed'
        : hasMalayalamScript
        ? 'ml'
        : 'en';

    // 2. Check for Multi-Step Commands
    const multiStepParts = this.detectMultiStepParts(resolvedText);
    if (multiStepParts.length > 1) {
      const subTasks: SubTask[] = multiStepParts.map((part) => {
        const parsed = IntentService.parseIntent(part, null);
        return {
          intent: parsed.intent,
          parameters: parsed.parameters,
          rawPart: part,
        };
      });

      // Filter to actionable subtasks
      const actionableTasks = subTasks.filter(
        (t) =>
          t.intent === 'CREATE_REMINDER' ||
          t.intent === 'CREATE_NOTE' ||
          t.intent === 'CALCULATE' ||
          t.intent === 'GET_WEATHER'
      );

      if (actionableTasks.length > 1) {
        return {
          rawText,
          resolvedText,
          language,
          taskComplexity: 'MULTI_STEP',
          isMultiStep: true,
          subTasks: actionableTasks,
          primaryIntent: actionableTasks[0].intent,
          parameters: actionableTasks[0].parameters,
          requiresReasoning: false,
          requiresTool: true,
          toolType: this.mapIntentToTool(actionableTasks[0].intent),
        };
      }
    }

    // 3. (Removed hardcoded reasoning checks - delegated to native AI)

    // 4. Standard Single-Intent Parsing
    const parsedIntent = IntentService.parseIntent(resolvedText, activeContext);

    // 5. Determine Task Complexity for Single Intents
    let taskComplexity: TaskComplexity = 'SIMPLE';
    let requiresTool = false;
    let toolType: UnderstoodSpeech['toolType'] = undefined;

    switch (parsedIntent.intent) {
      case 'CALCULATE':
        taskComplexity = 'MODERATE';
        requiresTool = true;
        toolType = 'calculator';
        break;
      case 'GET_WEATHER':
      case 'WEATHER_FOLLOWUP':
        taskComplexity = 'MODERATE';
        requiresTool = true;
        toolType = 'weather';
        break;
      case 'CREATE_REMINDER':
      case 'MODIFY_REMINDER':
        taskComplexity = 'MODERATE';
        requiresTool = true;
        toolType = 'reminder';
        break;
      case 'CREATE_NOTE':
        taskComplexity = 'MODERATE';
        requiresTool = true;
        toolType = 'note';
        break;
      case 'GENERAL_QUERY':
      case 'QUESTION':
      case 'EXPLANATION':
      case 'INFORMATION_REQUEST':
      case 'SEARCH':
      case 'COMPARISON':
        // If it's a technical or general knowledge query, moderate complexity
        taskComplexity = 'MODERATE';
        requiresTool = true;
        toolType = 'ai_knowledge';
        break;
      default:
        taskComplexity = 'SIMPLE';
    }

    return {
      rawText,
      resolvedText,
      language,
      taskComplexity,
      isMultiStep: false,
      subTasks: [],
      primaryIntent: parsedIntent.intent,
      parameters: parsedIntent.parameters,
      requiresReasoning: false,
      requiresTool,
      toolType,
    };
  }

  /**
   * Detects multi-step splits using spoken conjunctions
   */
  private static detectMultiStepParts(text: string): string[] {
    // Look for conjunction boundaries like "and", "കൂടാതെ", "pinne"
    const splitRegex = /\s+(?:and\s+also|and\s+then|and|കൂടാതെ|പിന്നെ|ശേഷം|oppam|koodathe)\s+/i;

    if (!splitRegex.test(text)) {
      return [text];
    }

    const parts = text.split(splitRegex).map((p) => p.trim()).filter((p) => p.length > 0);
    return parts.length > 1 ? parts : [text];
  }

    // Removed legacy detectReasoningType

  private static mapIntentToTool(intent: IntentType): UnderstoodSpeech['toolType'] {
    switch (intent) {
      case 'CALCULATE':
        return 'calculator';
      case 'GET_WEATHER':
      case 'WEATHER_FOLLOWUP':
        return 'weather';
      case 'CREATE_REMINDER':
      case 'MODIFY_REMINDER':
        return 'reminder';
      case 'CREATE_NOTE':
        return 'note';
      default:
        return 'ai_knowledge';
    }
  }
}
