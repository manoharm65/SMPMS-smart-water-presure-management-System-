import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository } from '../../repositories/user.repository.js';
import { config } from '../../core/config.js';
import { AuthToken, JwtPayload } from '../../types/index.js';

export class AuthService {
  async register(username: string, email: string, password: string): Promise<AuthToken> {
    // Check if user exists
    const existingUser = userRepository.findByUsername(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    if (email) {
      const existingEmail = userRepository.findByEmail(email);
      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = userRepository.create(username, email || '', passwordHash);

    // Generate token
    const token = this.generateToken(user.id, user.username);

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }

  async login(usernameOrEmail: string, password: string): Promise<AuthToken> {
    // Find user by username or email
    let user = userRepository.findByUsername(usernameOrEmail);
    if (!user && usernameOrEmail.includes('@')) {
      user = userRepository.findByEmail(usernameOrEmail);
    }

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const token = this.generateToken(user.id, user.username);

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }

  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      return decoded;
    } catch {
      throw new Error('Invalid token');
    }
  }

  private generateToken(userId: string, username: string): string {
    return jwt.sign(
      { userId, username },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );
  }
}

export const authService = new AuthService();
