import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Ensure data directory exists
const dataDir = path.dirname(config.databasePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(config.databasePath);

// Initialize reminders schema safely
db.exec(`
  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    scheduledDate TEXT NOT NULL,
    scheduledTime TEXT NOT NULL,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    completedAt TEXT,
    source TEXT DEFAULT 'voice'
  );
`);

// Safe, Idempotent Migration for memories (Phase 6)
function migrateMemoriesTable(): void {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memories'").get() as { name?: string } | undefined;

  if (!tableCheck) {
    // Table doesn't exist yet, create fresh Phase 6 schema
    db.exec(`
      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        memory_key TEXT NOT NULL,
        memory_value TEXT NOT NULL,
        memory_type TEXT NOT NULL DEFAULT 'other',
        source TEXT DEFAULT 'voice',
        confidence REAL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_accessed_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        metadata_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_memories_user_active ON memories(user_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_memories_user_key ON memories(user_id, memory_key);
    `);
    console.log('[DB Migration] Fresh memories table created for Phase 6.');
    return;
  }

  // Check existing columns
  const columns = db.prepare('PRAGMA table_info(memories)').all() as Array<{ name: string }>;
  const colNames = new Set(columns.map((c) => c.name));

  if (!colNames.has('user_id')) {
    // Old schema detected (Phase 1 legacy: userId, key, value, category, createdAt)
    console.log('[DB Migration] Migrating legacy memories table to Phase 6 schema safely...');
    db.exec(`
      ALTER TABLE memories RENAME TO memories_legacy_backup;

      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        memory_key TEXT NOT NULL,
        memory_value TEXT NOT NULL,
        memory_type TEXT NOT NULL DEFAULT 'other',
        source TEXT DEFAULT 'voice',
        confidence REAL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_accessed_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        metadata_json TEXT
      );

      INSERT INTO memories (id, user_id, memory_key, memory_value, memory_type, source, confidence, created_at, updated_at, is_active)
      SELECT 
        id, 
        userId AS user_id, 
        key AS memory_key, 
        value AS memory_value, 
        COALESCE(category, 'other') AS memory_type, 
        'voice' AS source, 
        1.0 AS confidence, 
        createdAt AS created_at, 
        createdAt AS updated_at, 
        1 AS is_active 
      FROM memories_legacy_backup;

      DROP TABLE memories_legacy_backup;
    `);
    console.log('[DB Migration] Legacy memories table safely migrated to Phase 6 schema.');
  }

  // Ensure indexes exist
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_memories_user_active ON memories(user_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_memories_user_key ON memories(user_id, memory_key);
  `);
}

migrateMemoriesTable();


export interface ReminderRecord {
  id: string;
  userId: string;
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  source: string;
}

export interface MemoryRecord {
  id: string;
  user_id: string;
  memory_key: string;
  memory_value: string;
  memory_type: string;
  source?: string;
  confidence?: number;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string | null;
  is_active: number;
  metadata_json?: string | null;
}

export const dbService = {
  // Reminders
  createReminder: (reminder: Partial<ReminderRecord> & { userId: string, title: string, scheduledDate: string, scheduledTime: string }): ReminderRecord => {
    const id = `rem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO reminders (id, userId, title, description, scheduledDate, scheduledTime, timezone, status, createdAt, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, 'voice')
    `);
    insert.run(
      id,
      reminder.userId,
      reminder.title,
      reminder.description || '',
      reminder.scheduledDate,
      reminder.scheduledTime,
      reminder.timezone || 'Asia/Kolkata',
      now
    );
    return dbService.getReminder(id)!;
  },

  getReminder: (id: string): ReminderRecord | null => {
    const query = db.prepare('SELECT * FROM reminders WHERE id = ?');
    const result = query.get(id) as unknown as ReminderRecord;
    return result || null;
  },

  getReminders: (userId: string, filter?: { status?: string, dateStr?: string }): ReminderRecord[] => {
    let sql = 'SELECT * FROM reminders WHERE userId = ?';
    const params: any[] = [userId];
    
    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.dateStr) {
      sql += ' AND scheduledDate = ?';
      params.push(filter.dateStr);
    }
    sql += ' ORDER BY scheduledDate ASC, scheduledTime ASC';
    
    const query = db.prepare(sql);
    return query.all(...params) as unknown as ReminderRecord[];
  },

  updateReminder: (id: string, userId: string, updates: Partial<ReminderRecord>): ReminderRecord | null => {
    const existing = dbService.getReminder(id);
    if (!existing || existing.userId !== userId) return null;

    const setClauses: string[] = [];
    const params: any[] = [];
    
    if (updates.title) { setClauses.push('title = ?'); params.push(updates.title); }
    if (updates.scheduledDate) { setClauses.push('scheduledDate = ?'); params.push(updates.scheduledDate); }
    if (updates.scheduledTime) { setClauses.push('scheduledTime = ?'); params.push(updates.scheduledTime); }
    if (updates.status) { 
      setClauses.push('status = ?'); params.push(updates.status); 
      if (updates.status === 'completed') {
        setClauses.push('completedAt = ?'); params.push(new Date().toISOString());
      }
    }

    if (setClauses.length === 0) return existing;

    params.push(id, userId);
    const sql = `UPDATE reminders SET ${setClauses.join(', ')} WHERE id = ? AND userId = ?`;
    const update = db.prepare(sql);
    update.run(...params);
    
    return dbService.getReminder(id);
  },

  deleteReminder: (id: string, userId: string): boolean => {
    const del = db.prepare('DELETE FROM reminders WHERE id = ? AND userId = ?');
    const info = del.run(id, userId);
    return info.changes > 0;
  },

  // Memories (Backward Compatibility helper methods)
  saveMemory: (userId: string, key: string, value: string, category: string = 'general'): MemoryRecord => {
    const now = new Date().toISOString();
    const existingQuery = db.prepare('SELECT id FROM memories WHERE user_id = ? AND memory_key = ? AND is_active = 1');
    const existing = existingQuery.get(userId, key) as { id: string } | undefined;
    
    if (existing) {
      const update = db.prepare('UPDATE memories SET memory_value = ?, memory_type = ?, updated_at = ? WHERE id = ?');
      update.run(value, category, now, existing.id);
      return dbService.getMemoryById(existing.id)!;
    } else {
      const id = `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const insert = db.prepare(`
        INSERT INTO memories (id, user_id, memory_key, memory_value, memory_type, source, confidence, created_at, updated_at, is_active)
        VALUES (?, ?, ?, ?, ?, 'voice', 1.0, ?, ?, 1)
      `);
      insert.run(id, userId, key, value, category, now, now);
      return dbService.getMemoryById(id)!;
    }
  },

  getMemoryById: (id: string): MemoryRecord | null => {
    const query = db.prepare('SELECT * FROM memories WHERE id = ?');
    return (query.get(id) as unknown as MemoryRecord) || null;
  },

  getMemoryByKey: (userId: string, key: string): MemoryRecord | null => {
    const query = db.prepare('SELECT * FROM memories WHERE user_id = ? AND memory_key = ? AND is_active = 1');
    return (query.get(userId, key) as unknown as MemoryRecord) || null;
  },

  getAllMemories: (userId: string): MemoryRecord[] => {
    const query = db.prepare('SELECT * FROM memories WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC');
    return query.all(userId) as unknown as MemoryRecord[];
  },

  deleteMemory: (userId: string, key: string): boolean => {
    const del = db.prepare('UPDATE memories SET is_active = 0, updated_at = ? WHERE user_id = ? AND memory_key = ?');
    const info = del.run(new Date().toISOString(), userId, key);
    return info.changes > 0;
  }
};

