import { PrismaClient } from '@prisma/client';
import { hash, compare } from 'bcrypt';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export class AuthService {
    // Create a new user
    async createUser(email: string, password: string) {
        try {
            // Check if user exists
            const existingUser = await prisma.user.findUnique({
                where: { email }
            });

            if (existingUser) {
                return {
                    success: false,
                    message: 'User with this email already exists',
                    errors: { email: ['User with this email already exists'] }
                };
            }

            // Hash password
            const hashedPassword = await hash(password, 10);

            // Create user
            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword
                }
            });

            // Generate JWT
            const token = jwt.sign(
                { userId: user.id },
                process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!!!',
                { expiresIn: '7d' }
            );

            return {
                success: true,
                message: 'Account created successfully',
                token,
                user: {
                    id: user.id,
                    email: user.email
                }
            };
        } catch (error) {
            console.error('Error creating user:', error);
            return {
                success: false,
                message: 'Failed to create user'
            };
        }
    }

    // Authenticate a user
    async authenticateUser(email: string, password: string) {
        try {
            // Find user by email
            const user = await prisma.user.findUnique({
                where: { email }
            });

            if (!user) {
                return {
                    success: false,
                    message: 'Invalid email or password',
                    errors: { email: ['Invalid email or password'] }
                };
            }

            // Verify password
            const isPasswordValid = await compare(password, user.password);
            if (!isPasswordValid) {
                return {
                    success: false,
                    message: 'Invalid email or password',
                    errors: { password: ['Invalid email or password'] }
                };
            }

            // Generate JWT
            const token = jwt.sign(
                { userId: user.id },
                process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!!!',
                { expiresIn: '7d' }
            );

            return {
                success: true,
                message: 'Signed in successfully',
                token,
                user: {
                    id: user.id,
                    email: user.email
                }
            };
        } catch (error) {
            console.error('Error authenticating user:', error);
            return {
                success: false,
                message: 'An error occurred during authentication'
            };
        }
    }

    // Get user by ID
    async getUserById(userId: string) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                return null;
            }

            return {
                id: user.id,
                email: user.email
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

            const user = await this.getUserById(decoded.userId);
            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            return {
                success: true,
                user
            };
        } catch (error) {
            console.error('Error verifying token:', error);
            return {
                success: false,
                message: 'Invalid token'
            };
        }
    }
} 