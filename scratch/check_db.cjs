const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.resolve(__dirname, '../server/data/vaani.db');
const db = new DatabaseSync(dbPath);

console.log('=== DATABASE AUDIT REPORT ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables found:', tables.map(t => t.name));

for (const t of tables) {
  if (t.name.startsWith('sqlite_')) continue;
  const count = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get();
  console.log(`Table [${t.name}]: ${count.c} records`);
}

const integrity = db.prepare('PRAGMA integrity_check').get();
console.log('PRAGMA integrity_check:', integrity);

const recentMemories = db.prepare('SELECT id, user_id, memory_key, memory_value, is_active FROM memories ORDER BY created_at DESC LIMIT 5').all();
console.log('\nSample Recent Memories:');
console.log(JSON.stringify(recentMemories, null, 2));
