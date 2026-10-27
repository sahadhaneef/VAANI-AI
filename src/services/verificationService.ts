/**
 * Anti-Hallucination & Execution Verification Service — Phase 9 Verification Layer
 *
 * Verifies tool execution results and factual claims before confirming to the user.
 * - Prevents false claims of successful action if a tool failed.
 * - Enforces strict anti-hallucination policies for unknown private facts and unverifiable predictions.
 * - Ensures safe, truthful spoken responses.
 */

export interface VerificationResult {
  isValid: boolean;
  verifiedText: string;
  reason?: string;
  confidence: number;
}

export class VerificationService {
  /**
   * Verifies a calculation result
   */
  static verifyCalculation(result: { value: number; spokenMalayalamResult: string } | null): VerificationResult {
    if (!result || isNaN(result.value) || !isFinite(result.value)) {
      return {
        isValid: false,
        verifiedText: 'ക്ഷമിക്കണം, എനിക്ക് ആ കണക്ക് ചെയ്യാൻ സാധിച്ചില്ല.',
        reason: 'Calculation produced invalid number or null',
        confidence: 0,
      };
    }
    return {
      isValid: true,
      verifiedText: result.spokenMalayalamResult,
      confidence: 100,
    };
  }

  /**
   * Verifies reminder creation
   */
  static verifyReminderCreated(reminderItem: any): VerificationResult {
    if (!reminderItem || !reminderItem.title || !reminderItem.timeStr) {
      return {
        isValid: false,
        verifiedText: 'ക്ഷമിക്കണം, റിമൈൻഡർ സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും പറയുക.',
        reason: 'Missing reminder parameters',
        confidence: 0,
      };
    }
    return {
      isValid: true,
      verifiedText: `ശരി, ${reminderItem.dateStr === 'Tomorrow' ? 'നാളെ' : reminderItem.dateStr} ${reminderItem.timeStr} മണിക്ക് ${reminderItem.title} ഞാൻ ഓർമ്മിപ്പിക്കാം.`,
      confidence: 100,
    };
  }

  /**
   * Verifies note creation
   */
  static verifyNoteCreated(noteItem: any): VerificationResult {
    if (!noteItem || !noteItem.content || noteItem.content.trim().length === 0) {
      return {
        isValid: false,
        verifiedText: 'ക്ഷമിക്കണം, നോട്ട് സേവ് ചെയ്യാൻ സാധിച്ചില്ല.',
        reason: 'Empty note content',
        confidence: 0,
      };
    }
    return {
      isValid: true,
      verifiedText: 'ശരി, note save ചെയ്തു.',
      confidence: 100,
    };
  }

  /**
   * Anti-hallucination check for unknown or private personal questions
   */
  static verifyFactualIntegrity(query: string, rawResponse: string): VerificationResult {
    const lower = query.toLowerCase();

    // Check for private / unknowable questions
    const isPersonalPrivate =
      lower.includes('what did i eat') ||
      lower.includes('breakfast today') ||
      (lower.includes('this morning') && lower.includes('eat')) ||
      lower.includes('what am i wearing') ||
      lower.includes('my clothes') ||
      lower.includes('inside my house') ||
      lower.includes('what am i thinking') ||
      lower.includes('where are my keys') ||
      lower.includes('my password') ||
      lower.includes('my bank balance') ||
      (lower.includes('ഇന്ന് രാവിലെ') && lower.includes('കഴിച്ചത്'));

    if (isPersonalPrivate) {
      if (lower.includes('wearing') || lower.includes('clothes')) {
        return {
          isValid: true,
          verifiedText: 'എനിക്ക് അത് കാണാൻ കഴിയില്ല.',
          confidence: 100,
        };
      }
      return {
        isValid: true,
        verifiedText: 'എനിക്ക് അത് അറിയില്ല.',
        confidence: 100,
      };
    }

    // Check for future predictions
    const isFuturePrediction =
      lower.includes('stock price') ||
      lower.includes('lottery') ||
      lower.includes('ഓഹരി വില');

    if (isFuturePrediction) {
      return {
        isValid: true,
        verifiedText: 'അതിനെക്കുറിച്ച് എനിക്ക് ഉറപ്പില്ല. നാളത്തെ കാര്യങ്ങൾ കൃത്യമായി പ്രവചിക്കാൻ കഴിയില്ല.',
        confidence: 90,
      };
    }

    return {
      isValid: true,
      verifiedText: rawResponse,
      confidence: 95,
    };
  }
}
