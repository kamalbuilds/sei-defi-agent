import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Logger } from '../../utils/logger';

export interface User {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthToken {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export class AuthService {
  private logger = new Logger('AuthService');
  private jwtSecret = process.env.JWT_SECRET || 'dev-secret';
  private tokenExpiry = process.env.JWT_EXPIRY || '24h';

  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as AuthToken;
      
      // In a real implementation, you would fetch the user from the database
      // and verify the token is still valid
      const user: User = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.logger.info('Token verified successfully', { userId: user.id });
      return user;
    } catch (error) {
      this.logger.error('Token verification failed', { error: (error as any).message });
      throw new Error('Invalid or expired token');
    }
  }

  async generateToken(user: User): Promise<string> {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: this.tokenExpiry });
    this.logger.info('Token generated', { userId: user.id });
    return token;
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    // Mock implementation - in production, fetch from database
    const mockUser: User = {
      id: 'user-123',
      email,
      role: 'user',
      permissions: ['VIEW_PORTFOLIO', 'TRADE', 'VIEW_ANALYTICS'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Mock password verification
    const isValidPassword = password === 'demo-password';
    
    if (isValidPassword) {
      this.logger.info('User authenticated successfully', { email });
      return mockUser;
    }

    this.logger.warn('Authentication failed', { email });
    return null;
  }

  async refreshToken(oldToken: string): Promise<string> {
    try {
      const decoded = jwt.verify(oldToken, this.jwtSecret) as AuthToken;
      
      // Generate new token with fresh expiry
      const user: User = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return this.generateToken(user);
    } catch (error) {
      this.logger.error('Token refresh failed', { error: (error as any).message });
      throw new Error('Unable to refresh token');
    }
  }

  async revokeToken(token: string): Promise<void> {
    // In production, you would add the token to a blacklist
    this.logger.info('Token revoked', { token: token.substring(0, 20) + '...' });
  }

  hasPermission(user: User, permission: string): boolean {
    return user.permissions.includes(permission) || user.role === 'admin';
  }

  hasRole(user: User, role: string): boolean {
    return user.role === role;
  }
}