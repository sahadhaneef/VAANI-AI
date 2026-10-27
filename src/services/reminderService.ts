import type { ReminderItem } from '../types/assistant';

export class ReminderService {
  static async getReminders(): Promise<ReminderItem[]> {
    try {
      const res = await fetch('/api/reminders');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch reminders from backend', e);
    }
    return [];
  }

  static async addReminder(title: string, dateStr = 'Tomorrow', timeStr = '08:00 AM'): Promise<ReminderItem | null> {
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, scheduledDate: dateStr, scheduledTime: timeStr })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to add reminder to backend', e);
    }
    return null;
  }

  static async deleteReminder(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      console.warn('Failed to delete reminder', e);
    }
    return false;
  }
}
