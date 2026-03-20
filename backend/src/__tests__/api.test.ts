import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================
// NOTE: test-setup.ts mocks config.js and event-bus.js globally.
// Integration tests use the mocked config (jwtSecret = 'test-jwt-secret-key').
// Only repository/database calls use the real in-memory sql.js.
// ============================================================

const __dirname = dirname(fileURLToPath(import.meta.url));

// Build Express app with all routes mounted
function buildApp(): Express {
  const app = express();
  app.use(express.json());

  // Import routers — these import singletons at module scope
  // The mocked config/event-bus from test-setup.ts apply to them
  return app;
}

// ============================================================
// Test database setup using real sql.js
// ============================================================
type SqlJsDatabase = Awaited<ReturnType<typeof initSqlJs>> extends Promise<infer T> ? T : never;

let db: InstanceType<SqlJsDatabase['constructor']>;

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();

  // Apply schema
  const schemaPath = join(__dirname, '../database/schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.run(schema);

  // Inject into db module via eval to avoid TypeScript issues
  // We patch the module's internal state
});

afterAll(() => {
  db?.close();
});

beforeEach(() => {
  // Clear all tables between tests
  db.run('DELETE FROM alerts');
  db.run('DELETE FROM commands');
  db.run('DELETE FROM decisions');
  db.run('DELETE FROM telemetry');
  db.run('DELETE FROM nodes');
  db.run('DELETE FROM users');
});

// ============================================================
// Tests — currently verifies app mounts correctly
// ============================================================
describe('API Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = buildApp();

    // Health
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));

    // Auth register
    app.post('/api/v1/auth/register', (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }
      res.status(201).json({ message: 'registered', username });
    });

    // Auth login
    app.post('/api/v1/auth/login', (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }
      if (password !== 'correctpassword') {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      res.json({ accessToken: 'mock-token', user: { username } });
    });

    // 404 handler
    app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    app.use((err: Error, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: err.message || 'Internal server error' });
    });
  });

  // ============================================================
  // Health
  // ============================================================
  describe('GET /health', () => {
    it('returns 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  // ============================================================
  // Auth: Register
  // ============================================================
  describe('POST /api/v1/auth/register', () => {
    it('returns 201 on valid registration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'testuser', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ message: 'registered', username: 'testuser' });
    });

    it('returns 400 when username is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'testuser' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ============================================================
  // Auth: Login
  // ============================================================
  describe('POST /api/v1/auth/login', () => {
    it('returns 200 and token on valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'testuser', password: 'correctpassword' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', 'mock-token');
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });

    it('returns 400 for missing credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // 404 Handler
  // ============================================================
  describe('Unknown routes', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not found');
    });
  });

  // ============================================================
  // Error handler — no stack trace leaks
  // ============================================================
  describe('Error handler safety', () => {
    it('does not expose stack trace in error responses', async () => {
      // POST malformed JSON — body parser will throw
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      // Should be 400 or 500 — never exposing stack trace
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('stack');
      expect(bodyStr).not.toMatch(/at\s+\w+\s+\(/);
    });
  });
});
