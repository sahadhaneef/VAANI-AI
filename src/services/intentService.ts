/**
 * Advanced Semantic Intent & Sentiment Engine — Phase 6
 *
 * Detects structured Intent payloads (GREETING, MODIFY_REMINDER, WEATHER_FOLLOWUP, CALCULATE, CREATE_REMINDER, CREATE_NOTE, GET_WEATHER, GENERAL_QUERY)
 * and basic sentiment states (HAPPY, FRUSTRATED, NEUTRAL, SAD, URGENT).
 */

import type {
  ParsedIntent,
  IntentParameters,
  ConversationContext,
  SentimentState,
} from '../types/assistant';
import { sessionMemoryService } from './sessionMemoryService';

export class IntentService {
  /**
   * Parse user speech, conversation context, and session memory into semantic intent
   */
  static parseIntent(
    spokenSpeech: string,
    context?: ConversationContext | null
  ): ParsedIntent {
    const raw = spokenSpeech.trim();
    const lower = raw.toLowerCase();
    const sentiment = this.detectSentiment(lower);
    const memory = sessionMemoryService.getMemory();

    // 0. Check multi-turn conversation follow-up context first
    if (context && context.pendingIntent && context.missingParam) {
      return this.handleFollowupContext(raw, context, sentiment);
    }

    // 1. REMINDER MODIFICATION FOLLOW-UP ("Actually make it 9", "9 o'clock akku", "change to 9 AM")
    if (
      (lower.includes('make it') || lower.includes('change to') || lower.includes('ആക്കൂ') || lower.includes('മറ്റൂ')) &&
      (/\d/.test(lower) || lower.includes('nine') || lower.includes('eight')) &&
      memory.lastIntent?.includes('REMINDER')
    ) {
      const newTime = this.extractTimeFromText(lower) || '09:00 AM';
      return {
        intent: 'MODIFY_REMINDER',
        confidence: 0.98,
        sentiment,
        parameters: { time: newTime },
        rawSpeech: raw,
      };
    }

    // 2. WEATHER FOLLOW-UP ("How about tomorrow?", "Nale enganeyanu?", "Tomorrow?")
    if (
      (lower.includes('tomorrow') || lower.includes('നാളെ') || lower.includes('nale')) &&
      (lower.includes('how about') || lower.includes(' weather') || lower.includes('എങ്ങനെ') || lower.length < 20) &&
      memory.lastIntent?.includes('WEATHER')
    ) {
      return {
        intent: 'WEATHER_FOLLOWUP',
        confidence: 0.96,
        sentiment,
        parameters: { date: 'Tomorrow' },
        rawSpeech: raw,
      };
    }

    // 3. GREETING Intent Check (Hello, Hi, Good morning, Namaskaram)
    if (
      lower === 'hello' ||
      lower === 'hi' ||
      lower === 'hey' ||
      lower === 'നമസ്കാരം' ||
      lower === 'നമസ്തേ' ||
      lower.startsWith('good morning') ||
      lower.startsWith('good afternoon') ||
      lower.startsWith('good evening') ||
      lower === 'hello vaani' ||
      lower === 'hi vaani'
    ) {
      return {
        intent: 'GREETING',
        confidence: 0.99,
        sentiment,
        parameters: {},
        rawSpeech: raw,
      };
    }

    // 4. NAME_STATEMENT Intent Check ("Ente per Sahad aanu", "My name is Sahad")
    const nameMatch =
      lower.match(/(?:ente\s+per|my\s+name\s+is|എന്റെ\s+പേര്)\s+([a-zA-Z\u0D00-\u0D7F]+)/i) ||
      raw.match(/(?:ente\s+per|my\s+name\s+is|എന്റെ\s+പേര്)\s+([a-zA-Z\u0D00-\u0D7F]+)/i);

    if (nameMatch) {
      const extractedName = nameMatch[1].replace(/aanu|ആണ്/gi, '').trim();
      return {
        intent: 'NAME_STATEMENT',
        confidence: 0.98,
        sentiment,
        parameters: { userName: extractedName },
        rawSpeech: raw,
      };
    }

    // 5. NAME_QUERY Intent Check ("Ente per enthaanu?", "What is my name?")
    if (
      (lower.includes('ente per') && (lower.includes('entha') || lower.includes('എന്താണ്') || lower.includes(' what'))) ||
      lower.includes('what is my name') ||
      lower.includes('എന്റെ പേര് എന്താണ്')
    ) {
      return {
        intent: 'NAME_QUERY',
        confidence: 0.98,
        sentiment,
        parameters: {},
        rawSpeech: raw,
      };
    }

    // 6. CALCULATE Intent Check ("250ന്റെ 20 percent എത്രയാണ്?", "25 plus 35 ethra?")
    if (
      lower.includes('plus') ||
      lower.includes('minus') ||
      lower.includes('divided') ||
      lower.includes('multiply') ||
      lower.includes('ശതമാനം') ||
      lower.includes('%') ||
      lower.includes('percent') ||
      lower.includes('എത്രയാണ്') ||
      (lower.includes('ethra') && /\d/.test(lower)) ||
      (lower.includes('എത്ര') && /\d/.test(lower)) ||
      /\d+\s*[\+\-\*\/]\s*\d+/.test(lower)
    ) {
      return {
        intent: 'CALCULATE',
        confidence: 0.98,
        sentiment,
        parameters: { mathExpr: raw },
        rawSpeech: raw,
      };
    }

    // 7. CREATE_REMINDER Intent Check ("ഒരു റിമൈൻഡർ വെക്കണം എനിക്ക്", "Nale ravile 8 manikku enne remind cheyyanam")
    if (
      lower.includes('remind') ||
      lower.includes('reminder') ||
      lower.includes('റിമൈൻഡർ') ||
      lower.includes('റിമൈന്റർ') ||
      lower.includes('ഓർമ്മിപ്പിക്കണം') ||
      lower.includes('ഓർമ്മിപ്പിക്കൂ') ||
      lower.includes('ഓർമ്മപ്പെടുത്തണം') ||
      lower.includes('ഓർമ്മപ്പെടുത്തൂ') ||
      lower.includes('ഓർമ്മിപ്പിക്കുക') ||
      lower.includes('ഓർമ്മപ്പടുത്തൂ')
    ) {
      const params = this.extractReminderParams(raw);
      return {
        intent: 'CREATE_REMINDER',
        confidence: 0.96,
        sentiment,
        parameters: params,
        rawSpeech: raw,
      };
    }

    // 8. CREATE_NOTE Intent Check ("Enikku oru note save cheyyanam", "ഒരു നോട്ട് എഴുതണം")
    if (
      lower.includes('note') ||
      lower.includes('നോട്ട്') ||
      lower.includes('കുറിപ്പ്') ||
      lower.includes('എഴുതി വെക്കണം') ||
      lower.includes('സേവ് ചെയ്യണം') ||
      lower.includes('കുറിച്ചു വെക്കണം')
    ) {
      const content = this.extractNoteContent(raw);
      return {
        intent: 'CREATE_NOTE',
        confidence: 0.95,
        sentiment,
        parameters: { content },
        rawSpeech: raw,
      };
    }

    // 9. GET_WEATHER Intent Check ("Innu weather engane und?", "ഇന്നത്തെ കാലാവസ്ഥ")
    if (
      lower.includes('weather') ||
      lower.includes('വെതർ') ||
      lower.includes('കാലാവസ്ഥ') ||
      lower.includes('മഴ') ||
      lower.includes('ചൂട്')
    ) {
      const location = this.extractLocation(raw);
      return {
        intent: 'GET_WEATHER',
        confidence: 0.97,
        sentiment,
        parameters: { location },
        rawSpeech: raw,
      };
    }

    // 10. UNCERTAIN Check (Intentionally unclear / nonsensical short input)
    if (raw.length < 2 && !/[a-zA-Z\u0D00-\u0D7F]/.test(raw)) {
      return {
        intent: 'UNCERTAIN',
        confidence: 0.3,
        sentiment,
        parameters: {},
        rawSpeech: raw,
      };
    }

    // 11. EXPLANATION Check
    if (
      lower.includes('explain') ||
      lower.includes('വിശദീകരിക്കാമോ') ||
      lower.includes('എന്തുകൊണ്ട്') ||
      lower.includes('why')
    ) {
      return {
        intent: 'EXPLANATION',
        confidence: 0.94,
        sentiment,
        parameters: {},
        rawSpeech: raw,
      };
    }

    // 12. QUESTION Check
    if (
      lower.includes('what is') ||
      lower.includes('എന്താണ്') ||
      lower.includes('how to') ||
      lower.includes('എങ്ങനെ') ||
      lower.includes('who is') ||
      lower.includes('ആരാണ്') ||
      lower.includes('where is') ||
      lower.includes('എവിടെയാണ്') ||
      lower.includes('ഏതാണ്') ||
      lower.includes('which') ||
      lower.includes('എത്ര') ||
      lower.includes('എപ്പോഴാണ്') ||
      lower.includes('when') ||
      lower.includes('ആരുടേതാണ്') ||
      lower.includes('tell me about') ||
      lower.includes('കുറിച്ച് പറയാമോ')
    ) {
      return {
        intent: 'QUESTION',
        confidence: 0.95,
        sentiment,
        parameters: {},
        rawSpeech: raw,
      };
    }

    // Default: GENERAL_QUERY
    return {
      intent: 'GENERAL_QUERY',
      confidence: 0.92,
      sentiment,
      parameters: {},
      rawSpeech: raw,
    };
  }

  /**
   * Basic Sentiment Detection
   */
  private static detectSentiment(lowerSpeech: string): SentimentState {
    if (lowerSpeech.includes('frustrated') || lowerSpeech.includes('not working') || lowerSpeech.includes('സങ്കടം') || lowerSpeech.includes('ദേഷ്യം')) {
      return 'FRUSTRATED';
    }
    if (lowerSpeech.includes('happy') || lowerSpeech.includes('great') || lowerSpeech.includes('സന്തോഷം') || lowerSpeech.includes('നല്ലത്')) {
      return 'HAPPY';
    }
    if (lowerSpeech.includes('sad') || lowerSpeech.includes('ഉത്സാഹമില്ല')) {
      return 'SAD';
    }
    if (lowerSpeech.includes('urgent') || lowerSpeech.includes('immediately') || lowerSpeech.includes('പെട്ടെന്ന്')) {
      return 'URGENT';
    }
    return 'NEUTRAL';
  }

  /**
   * Handle Multi-turn Follow-up context
   */
  private static handleFollowupContext(
    spokenSpeech: string,
    context: ConversationContext,
    sentiment: SentimentState
  ): ParsedIntent {
    const raw = spokenSpeech.trim();
    const partial = context.partialData || {};

    if (context.pendingIntent === 'CREATE_REMINDER') {
      if (context.missingParam === 'title') {
        return {
          intent: 'CREATE_REMINDER',
          confidence: 0.98,
          sentiment,
          parameters: {
            ...partial,
            title: raw,
          },
          rawSpeech: raw,
        };
      } else if (context.missingParam === 'time') {
        return {
          intent: 'CREATE_REMINDER',
          confidence: 0.98,
          sentiment,
          parameters: {
            ...partial,
            time: raw,
          },
          rawSpeech: raw,
        };
      }
    } else if (context.pendingIntent === 'CREATE_NOTE') {
      return {
        intent: 'CREATE_NOTE',
        confidence: 0.98,
        sentiment,
        parameters: {
          content: raw,
        },
        rawSpeech: raw,
      };
    }

    return {
      intent: 'FOLLOWUP_RESPONSE',
      confidence: 0.95,
      sentiment,
      parameters: { title: raw },
      rawSpeech: raw,
    };
  }

  private static extractTimeFromText(text: string): string | null {
    const match = text.match(/(\d{1,2}(?::\d{2})?)\s*(?:am|pm|manikku|മണിക്ക്|മണി)?/i);
    if (match) {
      const num = match[1];
      if (text.includes('pm') || text.includes('വൈകുന്നേരം')) return `${num}:00 PM`;
      return `${num}:00 AM`;
    }
    return null;
  }

  private static extractReminderParams(speech: string): IntentParameters {
    const lower = speech.toLowerCase();
    let title = '';
    let time = '08:00 AM';
    let date = 'Tomorrow';

    const timeMatch = lower.match(/(\d{1,2}(?::\d{2})?)\s*(?:am|pm|manikku|മണിക്ക്|മണി)?/i);
    if (timeMatch) {
      const numStr = timeMatch[1];
      if (lower.includes('pm') || lower.includes('വൈകുന്നേരം')) {
        time = `${numStr}:00 PM`;
      } else {
        time = `${numStr}:00 AM`;
      }
    }

    if (lower.includes('nale') || lower.includes('നാളെ') || lower.includes('tomorrow')) {
      date = 'Tomorrow';
    } else if (lower.includes('innu') || lower.includes('ഇന്ന്') || lower.includes('today')) {
      date = 'Today';
    }

    // Clean out command/trigger words from title candidate
    title = speech
      .replace(/ഒരു|റിമൈൻഡർ|റിമൈന്റർ|വെക്കണം|വേണം|എനിക്ക്|എന്നെ|nale|ravile|manikku|enne|remind|reminder|cheyyanam|tomorrow|remind me to|at \d+|മണിക്ക്|എന്ന|ഓർമ്മിപ്പിക്കണം|ഓർമ്മിപ്പിക്കൂ|ഓർമ്മപ്പെടുത്തണം|ഓർമ്മപ്പെടുത്തൂ|ഓർമ്മിപ്പിക്കുക/gi, '')
      .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
      .trim();

    return {
      title: title || '',
      date,
      time,
    };
  }

  private static extractNoteContent(speech: string): string {
    return speech
      .replace(/ഒരു|നോട്ട്|കുറിപ്പ്|സേവ് ചെയ്യണം|എഴുതി വെക്കണം|കുറിച്ചു വെക്കണം|എനിക്ക്|വേണം|note cheyyu|note edukkanam|note|ചെയ്യൂ|എടുക്കണം/gi, '')
      .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
      .trim();
  }

  private static extractLocation(speech: string): string {
    const lower = speech.toLowerCase();
    const cities = ['kochi', 'cochin', 'trivandrum', 'thiruvananthapuram', 'calicut', 'kozhikode', 'thrissur', 'kannur', 'kottayam', 'alappuzha', 'palakkad', 'wayanad'];
    for (const c of cities) {
      if (lower.includes(c)) return c;
    }
    return '';
  }
}
