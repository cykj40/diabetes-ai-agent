import { db, user } from '../db';
import { eq } from 'drizzle-orm';
import { hash, compare } from 'bcrypt';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';

export class AuthService {
  // Create a new user
  async createUser(email: string, password: string) {
    try {
      // Check if user exists
      const existingUser = await db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (existingUser) {
        return {
          success: false,
          message: 'User with this email already exists',
          errors: { email: ['User with this email already exists'] },
        };
      }

      // Hash password
      const hashedPassword = await hash(password, 10);

      // Create user
      const [newUser] = await db
        .insert(user)
        .values({
          email,
          password: hashedPassword,
        })
        .returning();

      // Generate JWT
      const token = jwt.sign(
        { userId: newUser.id },
        process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!!!',
        { expiresIn: '7d' }
      );

      return {
        success: true,
        message: 'Account created successfully',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
        },
      };
    } catch (error) {
      console.error('Error creating user:', error);
      return {
        success: false,
        message: 'Failed to create user',
      };
    }
  }

  // Authenticate a user
  async authenticateUser(email: string, password: string) {
    try {
      console.log('[AUTH-SERVICE] Attempting to authenticate:', {
        email,
        hasPassword: !!password,
      });

      // Find user by email
      const foundUser = await db.query.user.findFirst({
        where: eq(user.email, email),
      });

      console.log('[AUTH-SERVICE] User lookup result:', {
        userFound: !!foundUser,
        userId: foundUser?.id,
        userEmail: foundUser?.email,
      });

      if (!foundUser) {
        console.log('[AUTH-SERVICE] User not found for email:', email);
        return {
          success: false,
          message: 'Invalid email or password',
          errors: { email: ['Invalid email or password'] },
        };
      }

      // Verify password
      console.log('[AUTH-SERVICE] Comparing passwords...');
      const isPasswordValid = await compare(password, foundUser.password);
      console.log('[AUTH-SERVICE] Password comparison result:', isPasswordValid);

      if (!isPasswordValid) {
        console.log('[AUTH-SERVICE] Password invalid for user:', email);
        return {
          success: false,
          message: 'Invalid email or password',
          errors: { password: ['Invalid email or password'] },
        };
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: foundUser.id },
        process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!!!',
        { expiresIn: '7d' }
      );

      console.log('[AUTH-SERVICE] Authentication successful for:', email);
      return {
        success: true,
        message: 'Signed in successfully',
        token,
        user: {
          id: foundUser.id,
          email: foundUser.email,
        },
      };
    } catch (error) {
      console.error('[AUTH-SERVICE] Error authenticating user:', error);
      return {
        success: false,
        message: 'An error occurred during authentication',
      };
    }
  }

  // Get user by ID
  async getUserById(userId: string) {
    try {
      const foundUser = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });

      if (!foundUser) {
        return null;
      }

      return {
        id: foundUser.id,
        email: foundUser.email,
      };
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  // Verify token and get user
  async verifyToken(token: string) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!!!'
      ) as { userId: string };

      const foundUser = await this.getUserById(decoded.userId);
      if (!foundUser) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      return {
        success: true,
        user: foundUser,
      };
    } catch (error) {
      console.error('Error verifying token:', error);
      return {
        success: false,
        message: 'Invalid token',
      };
    }
  }
}
