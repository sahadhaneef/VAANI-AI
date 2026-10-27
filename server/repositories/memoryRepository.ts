/**
 * Memory Repository — Phase 6 Context & Persistent Memory
 *
 * Encapsulates all SQLite persistence operations for explicit user memories.
 * STRICT SECURITY: Every query is scoped by authenticatedUserId.
 * Cross-user memory access is strictly prohibited at the query level.
 */

import { db, type MemoryRecord } from '../db.js';

export interface CreateMemoryInput {
  userId: string;
  memoryKey: string;
  memoryValue: string;
  memoryType?: string;
  source?: string;
  confidence?: number;
  metadataJson?: string | null;
}

export interface UpdateMemoryInput {
  memoryValue?: string;
  memoryType?: string;
  confidence?: number;
  metadataJson?: string | null;
}

export class MemoryRepository {
  /**
   * Create a new persistent memory record for a scoped user.
   */
  static createMemory(input: CreateMemoryInput): MemoryRecord {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const type = input.memoryType || 'other';
    const source = input.source || 'voice';
    const confidence = typeof input.confidence === 'number' ? input.confidence : 1.0;

    const stmt = db.prepare(`
      INSERT INTO memories (
        id, user_id, memory_key, memory_value, memory_type,
        source, confidence, created_at, updated_at, last_accessed_at,
        is_active, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    stmt.run(
      id,
      input.userId,
      input.memoryKey.trim(),
      input.memoryValue.trim(),
      type,
      source,
      confidence,
      now,
      now,
      now,
      input.metadataJson || null
    );

    return this.getMemoryById(id, input.userId)!;
  }

  /**
   * Retrieve a specific memory by ID, strictly enforcing user ownership.
   */
  static getMemoryById(id: string, userId: string): MemoryRecord | null {
    const stmt = db.prepare(`
      SELECT * FROM memories
      WHERE id = ? AND user_id = ?
    `);
    const record = stmt.get(id, userId) as unknown as MemoryRecord | undefined;
    return record || null;
  }

  /**
   * Find an active memory for a user by exact key (case-insensitive).
   */
  static findActiveByKey(userId: string, key: string): MemoryRecord | null {
    const stmt = db.prepare(`
      SELECT * FROM memories
      WHERE user_id = ? AND LOWER(memory_key) = LOWER(?) AND is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const record = stmt.get(userId, key.trim()) as unknown as MemoryRecord | undefined;
    return record || null;
  }

  /**
   * List active memories for a scoped user, ordered by recency.
   */
  static listActiveMemories(userId: string, limit: number = 20): MemoryRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM memories
      WHERE user_id = ? AND is_active = 1
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as unknown as MemoryRecord[];
  }

  /**
   * Find relevant active memories for a user given a list of search tokens / keywords.
   * Matches against memory_key, memory_value, and memory_type.
   */
  static findRelevantMemories(
    userId: string,
    queryTokens: string[],
    limit: number = 6
  ): MemoryRecord[] {
    if (!queryTokens || queryTokens.length === 0) {
      return this.listActiveMemories(userId, limit);
    }

    // Filter meaningful tokens (length >= 2, lowercased)
    const sanitizedTokens = queryTokens
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 2)
      .slice(0, 10);

    if (sanitizedTokens.length === 0) {
      return this.listActiveMemories(userId, limit);
    }

    // Build SQL with LIKE clauses for each token
    const conditions = sanitizedTokens.map(
      () => `(LOWER(memory_key) LIKE ? OR LOWER(memory_value) LIKE ? OR LOWER(memory_type) LIKE ?)`
    );

    const params: any[] = [userId];
    for (const token of sanitizedTokens) {
      const pattern = `%${token}%`;
      params.push(pattern, pattern, pattern);
    }
    params.push(limit);

    const sql = `
      SELECT * FROM memories
      WHERE user_id = ? AND is_active = 1 AND (${conditions.join(' OR ')})
      ORDER BY updated_at DESC
      LIMIT ?
    `;

    const stmt = db.prepare(sql);
    const results = stmt.all(...params) as unknown as MemoryRecord[];

    // If token match returns fewer results, supplement with recent active memories up to limit
    if (results.length < limit) {
      const existingIds = new Set(results.map((r) => r.id));
      const recent = this.listActiveMemories(userId, limit);
      for (const r of recent) {
        if (!existingIds.has(r.id) && results.length < limit) {
          results.push(r);
          existingIds.add(r.id);
        }
      }
    }

    return results;
  }

  /**
   * Update an existing memory's value or type, strictly scoped to user.
   */
  static updateMemory(
    id: string,
    userId: string,
    updates: UpdateMemoryInput
  ): MemoryRecord | null {
    const existing = this.getMemoryById(id, userId);
    if (!existing || existing.is_active !== 1) return null;

    const setClauses: string[] = ['updated_at = ?'];
    const params: any[] = [new Date().toISOString()];

    if (typeof updates.memoryValue === 'string') {
      setClauses.push('memory_value = ?');
      params.push(updates.memoryValue.trim());
    }

    if (typeof updates.memoryType === 'string') {
      setClauses.push('memory_type = ?');
      params.push(updates.memoryType.trim());
    }

    if (typeof updates.confidence === 'number') {
      setClauses.push('confidence = ?');
      params.push(updates.confidence);
    }

    if (updates.metadataJson !== undefined) {
      setClauses.push('metadata_json = ?');
      params.push(updates.metadataJson);
    }

    params.push(id, userId);
    const sql = `
      UPDATE memories
      SET ${setClauses.join(', ')}
      WHERE id = ? AND user_id = ?
    `;

    const stmt = db.prepare(sql);
    stmt.run(...params);

    return this.getMemoryById(id, userId);
  }

  /**
   * Soft-delete (deactivate) a memory by ID, setting is_active = 0.
   */
  static deactivateMemory(id: string, userId: string): boolean {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE memories
      SET is_active = 0, updated_at = ?
      WHERE id = ? AND user_id = ? AND is_active = 1
    `);
    const info = stmt.run(now, id, userId);
    return info.changes > 0;
  }

  /**
   * Soft-delete (deactivate) a memory by key for a scoped user.
   */
  static deactivateByKey(userId: string, key: string): boolean {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE memories
      SET is_active = 0, updated_at = ?
      WHERE user_id = ? AND LOWER(memory_key) = LOWER(?) AND is_active = 1
    `);
    const info = stmt.run(now, userId, key.trim());
    return info.changes > 0;
  }

  /**
   * Touch memory to update its last_accessed_at timestamp.
   */
  static touchMemory(id: string, userId: string): void {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE memories
      SET last_accessed_at = ?
      WHERE id = ? AND user_id = ?
    `);
    stmt.run(now, id, userId);
  }

  /**
   * Count total active memories for a scoped user.
   */
  static countActiveMemories(userId: string): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM memories
      WHERE user_id = ? AND is_active = 1
    `);
    const res = stmt.get(userId) as { count: number } | undefined;
    return res?.count || 0;
  }
}
