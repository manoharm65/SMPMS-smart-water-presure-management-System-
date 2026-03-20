import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv, config } from '../core/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  loadEnv();
  dbPath = config.sqliteDbPath;

  // Ensure data directory exists
  const dataDir = join(__dirname, '../../data');
  mkdirSync(dataDir, { recursive: true });

  // Initialize SQL.js
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log(`✅ Loaded existing database from ${dbPath}`);
  } else {
    db = new SQL.Database();
    console.log(`✅ Created new database`);
  }

  // Apply schema
  const schemaPath = join(__dirname, 'schema.sql');
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8');
    db.run(schema);
    console.log('✅ Applied database schema');
  }

  // Auto-save every 5 seconds
  setInterval(() => {
    saveDatabase();
  }, 5000);

  return db;
}

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function saveDatabase(): void {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}
