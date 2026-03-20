// Test database hook — patches the db singleton for integration tests
// This allows tests to use a controlled in-memory database

import { Database as SqlJsDatabase } from 'sql.js';

let _testDb: SqlJsDatabase | null = null;

export function setTestDatabase(db: SqlJsDatabase): void {
  _testDb = db;
}

export function getTestDatabase(): SqlJsDatabase | null {
  return _testDb;
}
