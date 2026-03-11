import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { AuthService } from '../services/auth.service';

const authRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
    const authService = new AuthService();

    const ErrorResponse = Type.Object({
        error: Type.String(),
        details: Type.Optional(Type.String())
    });

    // User signup route
    fastify.post('/signup', {
        schema: {
            body: Type.Object({
                email: Type.String({ format: 'email' }),
                password: Type.String({ minLength: 6 })
            }),
            response: {
                200: Type.Object({
                    success: Type.Boolean(),
                    message: Type.String(),
                    token: Type.Optional(Type.String())
                }),
                400: Type.Object({
                    success: Type.Boolean(),
                    message: Type.String(),
                    errors: Type.Optional(Type.Object({
                        email: Type.Optional(Type.Array(Type.String())),
                        password: Type.Optional(Type.Array(Type.String()))
                    }))
                }),
                500: ErrorResponse
            }
        }
    }, async (request, reply) => {
        try {
            const { email, password } = request.body as { email: string, password: string };

            const result = await authService.createUser(email, password);

            if (!result.success) {
                return reply.code(400).send(result);
            }

            return result;
        } catch (error) {
            fastify.log.error('Signup error:', error);
            return reply.code(500).send({
                success: false,
                message: 'An error occurred during signup'
            });
        }
    });

    // User signin route
    fastify.post('/signin', {
        schema: {
            body: Type.Object({
                email: Type.String({ format: 'email' }),
                password: Type.String()
            }),
            response: {
                200: Type.Object({
                    success: Type.Boolean(),
                    message: Type.String(),
                    token: Type.String()
                }),
                400: Type.Object({
                    success: Type.Boolean(),
                    message: Type.String(),
                    errors: Type.Optional(Type.Object({
                        email: Type.Optional(Type.Array(Type.String())),
                        password: Type.Optional(Type.Array(Type.String()))
                    }))
                }),
                500: ErrorResponse
            }
        }
    }, async (request, reply) => {
        try {
            const { email, password } = request.body as { email: string, password: string };

            console.log('[AUTH] Signin attempt:', { email, passwordLength: password?.length });

            const result = await authService.authenticateUser(email, password);

            console.log('[AUTH] Signin result:', {
                success: result.success,
                message: result.message,
                hasToken: !!result.token
            });

            if (!result.success) {
                console.log('[AUTH] Signin failed:', result);
                return reply.code(400).send(result);
            }

            return result;
        } catch (error) {
            fastify.log.error('Signin error:', error);
            console.error('[AUTH] Signin exception:', error);
            return reply.code(500).send({
                success: false,
                message: 'An error occurred during signin'
            });
        }
    });

    // Get current user route
    fastify.get('/me', {
        schema: {
            headers: Type.Object({
                authorization: Type.Optional(Type.String())
            }),
            response: {
                200: Type.Object({
                    success: Type.Boolean(),
                    user: Type.Object({
                        id: Type.String(),
                        email: Type.String()
                    })
                }),
                401: Type.Object({
                    success: Type.Boolean(),
                    message: Type.String()
                }),
                500: ErrorResponse
            }
        }
    }, async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return reply.code(401).send({
                    success: false,
                    message: 'Unauthorized'
                });
            }

            const token = authHeader.split(' ')[1];

            const result = await authService.verifyToken(token);

            if (!result.success) {
                return reply.code(401).send(result);
            }

            return result;
        } catch (error) {
            fastify.log.error('Auth me error:', error);
            return reply.code(500).send({
                success: false,
                message: 'An error occurred while fetching user'
            });
        }
    });

    // Logout route (just for API completeness)
    fastify.post('/signout', {
        schema: {
            response: {
                200: Type.Object({
                    success: Type.Boolean(),
                    message: Type.String()
                })
            }
        }
    }, async () => {
        // In a JWT-based auth system, there's no server-side session to invalidate
        // The client should remove the token from storage
        return {
            success: true,
            message: 'Logged out successfully'
        };
    });
};

export default authRoutes; 
