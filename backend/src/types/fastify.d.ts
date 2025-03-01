import fastify from 'fastify';
import { FastifySession } from '@fastify/session';

// This is the correct way to extend the session in Fastify
declare module 'fastify' {
    interface Session {
        codeVerifier?: string;
        state?: string;
    }
} 