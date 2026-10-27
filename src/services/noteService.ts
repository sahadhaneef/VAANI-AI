/**
 * Note Service — LocalStorage Persistence & Management
 *
 * Manages notes created via natural voice commands.
 * Persists data in `vaani_notes`.
 */

import type { NoteItem } from '../types/assistant';

const STORAGE_KEY = 'vaani_notes';

const defaultNotes: NoteItem[] = [
  {
    id: 'note-1',
    content: 'Tomorrow meeting at 10 AM with design team',
    createdAt: new Date(Date.now() - 5000000),
  },
  {
    id: 'note-2',
    content: 'Buy milk, eggs, and bread for grocery list',
    createdAt: new Date(Date.now() - 10000000),
  },
];

export class NoteService {
  static getNotes(): NoteItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to read notes from localStorage');
    }
    return defaultNotes;
  }

  static addNote(content: string): NoteItem {
    const notes = this.getNotes();
    const newItem: NoteItem = {
      id: `note-${Date.now()}`,
      content: content || 'Voice Note',
      createdAt: new Date(),
    };

    const updated = [newItem, ...notes].slice(0, 30);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save note to localStorage');
    }
    return newItem;
  }

  static deleteNote(id: string): void {
    const notes = this.getNotes().filter((n) => n.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (e) {
      console.warn('Failed to delete note');
    }
  }
}
