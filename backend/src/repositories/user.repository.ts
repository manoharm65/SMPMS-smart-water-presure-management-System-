import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { User } from '../types/index.js';

export class UserRepository {
  private mapRow(columns: string[], values: any[]): User {
    const row: any = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      password: row.password,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  findById(id: string): User | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM users WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  findByUsername(username: string): User | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM users WHERE username = ?', [username]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  findByEmail(email: string): User | null {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM users WHERE email = ?', [email]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRow(result[0].columns, result[0].values[0]);
  }

  create(username: string, email: string, passwordHash: string): User {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO users (id, username, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, email, passwordHash, now, now]
    );
    return this.findById(id)!;
  }

  findAll(): User[] {
    const db = getDatabase();
    const result = db.exec('SELECT * FROM users');
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.mapRow(result[0].columns, row));
  }
}

export const userRepository = new UserRepository();
