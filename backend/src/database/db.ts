import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv, config } from '../core/config.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

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

  // Apply schema — split into CREATE (idempotent) and ALTER (may fail if column exists)
  const schemaPath = join(__dirname, 'schema.sql');
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8');

    // Split schema into individual statements and run them one by one
    const statements = schema
      .split(/;[\r\n]*/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      if (!stmt) continue;
      try {
        db.run(stmt);
      } catch (err: any) {
        // Ignore "duplicate column name" errors from ALTER TABLE ADD COLUMN
        // These are safe to ignore since the column already exists
        if (err.message?.includes('duplicate column name')) {
          console.warn(`⚠️  Column already exists — skipping: ${stmt.substring(0, 50)}`);
        } else {
          throw err; // Re-throw unexpected errors
        }
      }
    }
    console.log('✅ Applied database schema');
  }

  // Seed default data (idempotent — uses INSERT OR IGNORE)
  await seedDefaultData(db);

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

// -----------------------------------------------------------------------------
// Default seed data — creates admin user + 5 DMA nodes if they don't exist
// -----------------------------------------------------------------------------
async function seedDefaultData(database: SqlJsDatabase): Promise<void> {
  // Create admin user if not exists
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin@123';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

  const existingAdmin = database.exec(
    `SELECT id FROM users WHERE username = ?`,
    [adminUsername]
  );
  if (existingAdmin.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);
    database.run(
      `INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)`,
      [randomUUID(), adminUsername, adminEmail, passwordHash]
    );
    console.log(`✅ Created admin user: ${adminUsername}`);
  } else {
    console.log(`ℹ️  Admin user already exists`);
  }

  // Create default DMA nodes if not exist
  const defaultNodes = [
    { nodeId: 'DMA_01', name: 'District Meter Area 1', location: 'Zone A' },
    { nodeId: 'DMA_02', name: 'District Meter Area 2', location: 'Zone B' },
    { nodeId: 'DMA_03', name: 'District Meter Area 3', location: 'Zone C' },
    { nodeId: 'DMA_04', name: 'District Meter Area 4', location: 'Zone D' },
    { nodeId: 'DMA_05', name: 'District Meter Area 5', location: 'Zone E' },
  ];

  for (const node of defaultNodes) {
    const existing = database.exec(
      `SELECT id FROM nodes WHERE node_id = ?`,
      [node.nodeId]
    );
    if (existing.length === 0) {
      database.run(
        `INSERT INTO nodes (id, node_id, name, location, is_active, valve_position, valve_mode)
         VALUES (?, ?, ?, ?, 1, 50, 'auto')`,
        [randomUUID(), node.nodeId, node.name, node.location]
      );
      console.log(`✅ Created node: ${node.nodeId} (${node.name})`);
    }
  }
  console.log(`✅ Database seeding complete`);
}
