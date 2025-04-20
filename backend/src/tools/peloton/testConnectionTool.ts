import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PelotonClient } from './pelotonClient';
import { getUserPelotonSessionCookie } from '../../services/pelotonService';

/**
 * Creates a tool for testing the connection to the Peloton API
 * @param userId User ID for accessing Peloton data
 * @returns A tool that can be used by the agent to test the Peloton connection
 */
export function getTestPelotonConnectionTool(userId: string): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "test_peloton_connection",
        description: "Tests the connection to the Peloton API. Use this to verify that the Peloton account is properly connected and accessible.",
        schema: z.object({}),
        func: async () => {
            try {
                const sessionCookie = await getUserPelotonSessionCookie(userId);

                if (!sessionCookie) {
                    return "Peloton session cookie not configured. Please connect your Peloton account in settings.";
                }

                const pelotonClient = new PelotonClient(sessionCookie);
                const connectionTest = await pelotonClient.testConnection();

                if (connectionTest.success) {
                    return `✅ Peloton connection test successful! ${connectionTest.details}`;
                } else {
                    return `❌ Peloton connection test failed. ${connectionTest.details}`;
                }
            } catch (error: any) {
                console.error('Error testing Peloton connection:', error);
                return `Error testing Peloton connection: ${error.message || 'Unknown error'}`;
            }
        },
    });
} 