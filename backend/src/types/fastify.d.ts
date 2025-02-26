import fastify from 'fastify';
import { FastifySession } from '@fastify/session';

declare module 'fastify' {
    interface Session extends FastifySession {
        get(key: 'codeVerifier'): string | undefined;
        get(key: 'state'): string | undefined;
        set(key: 'codeVerifier', value: string): void;
        set(key: 'state', value: string): void;
        delete(key: 'codeVerifier'): void;
        delete(key: 'state'): void;
    }
} 