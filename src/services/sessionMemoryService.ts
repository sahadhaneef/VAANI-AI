/**
 * Session Conversational Memory Service — Phase 9 Context & Entity Tracking
 *
 * Maintains multi-turn conversation turns, active topics, referenced entities ("he", "it", "അതിന്റെ"),
 * and contextual continuity across conversational exchanges.
 */

import type { SessionMemory, ReminderItem, ConversationTurn } from '../types/assistant';

const SESSION_STORAGE_KEY = 'vaani_session_memory';

class SessionMemoryService {
  private memory: SessionMemory = {
    userName: undefined,
    lastUserSpeech: undefined,
    lastAssistantResponse: undefined,
    lastIntent: undefined,
    lastReminder: undefined,
    activeTopic: undefined,
    referencedEntity: undefined,
    conversationTurns: [],
    contextData: {},
    sessionStartedAt: new Date(),
  };

  constructor() {
    this.loadFromSessionStorage();
  }

  private loadFromSessionStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.memory = {
            ...this.memory,
            ...parsed,
            conversationTurns: parsed.conversationTurns || [],
          };
        }
      }
    } catch (e) {
      console.warn('Could not load session memory:', e);
    }
  }

  private saveToSessionStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.memory));
      }
    } catch (e) {
      console.warn('Could not save session memory:', e);
    }
  }

  getMemory(): SessionMemory {
    return this.memory;
  }

  getUserName(): string | undefined {
    return this.memory.userName;
  }

  setUserName(name: string): void {
    this.memory.userName = name;
    this.saveToSessionStorage();
  }

  getActiveTopic(): string | undefined {
    return this.memory.activeTopic;
  }

  setActiveTopic(topic: string): void {
    this.memory.activeTopic = topic;
    this.saveToSessionStorage();
  }

  getReferencedEntity(): string | undefined {
    return this.memory.referencedEntity;
  }

  setReferencedEntity(entity: string): void {
    this.memory.referencedEntity = entity;
    this.saveToSessionStorage();
  }

  getLastReminder(): ReminderItem | undefined {
    return this.memory.lastReminder;
  }

  setLastReminder(reminder: ReminderItem): void {
    this.memory.lastReminder = reminder;
    this.saveToSessionStorage();
  }

  recordExchange(userSpeech: string, assistantResponse: string, intent?: string, topic?: string): void {
    this.memory.lastUserSpeech = userSpeech;
    this.memory.lastAssistantResponse = assistantResponse;
    if (intent) {
      this.memory.lastIntent = intent;
    }
    if (topic) {
      this.memory.activeTopic = topic;
    }

    const now = Date.now();
    const userTurn: ConversationTurn = {
      role: 'user',
      text: userSpeech,
      intent,
      topic: topic || this.memory.activeTopic,
      timestamp: now,
    };
    const assistantTurn: ConversationTurn = {
      role: 'assistant',
      text: assistantResponse,
      intent,
      topic: topic || this.memory.activeTopic,
      timestamp: now + 50,
    };

    this.memory.conversationTurns.push(userTurn, assistantTurn);

    // Keep last 20 turns for token and memory efficiency
    if (this.memory.conversationTurns.length > 20) {
      this.memory.conversationTurns = this.memory.conversationTurns.slice(-20);
    }

    this.saveToSessionStorage();
  }

  /**
   * Resolves pronouns and references ("he", "she", "it", "അതിന്റെ", "അദ്ദേഹം", "that")
   * using recent turn history and active entities.
   */
  resolveEntityReference(speech: string): string {
    const lower = speech.toLowerCase();

    // Check for anaphoric pronouns
    const hasPronoun =
      lower.includes(' he ') ||
      lower.startsWith('he ') ||
      lower.includes(' his ') ||
      lower.includes('അദ്ദേഹം') ||
      lower.includes('അദ്ദേഹത്തിന്') ||
      lower.includes('അതിന്റെ') ||
      lower.includes('athinte') ||
      lower.includes(' it ') ||
      lower.includes('its ');

    if (hasPronoun) {
      if (this.memory.referencedEntity) {
        return `${speech} [Ref: ${this.memory.referencedEntity}]`;
      }
      if (this.memory.activeTopic) {
        return `${speech} [Topic: ${this.memory.activeTopic}]`;
      }
    }

    return speech;
  }

  setContextVariable(key: string, value: any): void {
    this.memory.contextData[key] = value;
    this.saveToSessionStorage();
  }

  getContextVariable(key: string): any {
    return this.memory.contextData[key];
  }

  resetSession(): void {
    this.memory = {
      userName: undefined,
      lastUserSpeech: undefined,
      lastAssistantResponse: undefined,
      lastIntent: undefined,
      lastReminder: undefined,
      activeTopic: undefined,
      referencedEntity: undefined,
      conversationTurns: [],
      contextData: {},
      sessionStartedAt: new Date(),
    };
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (e) {
      // ignore
    }
  }
}

export const sessionMemoryService = new SessionMemoryService();
