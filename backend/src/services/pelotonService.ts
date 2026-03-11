import { db, pelotonIntegration } from '../db';
import { eq } from 'drizzle-orm';
import { PelotonClient, getPelotonSessionCookie } from '../tools/peloton/pelotonClient';

/**
 * Gets a valid Peloton session cookie for a user
 * First tries to get the cookie from the database
 * If it doesn't exist or is invalid, gets a new one and updates the database
 */
export async function getUserPelotonSessionCookie(userId: string): Promise<string | null> {
    try {
        // Check if we have a stored integration for this user
        let integration = await db.query.pelotonIntegration.findFirst({
            where: eq(pelotonIntegration.userId, userId)
        });

        // If we have a stored session cookie, test if it's still valid
        if (integration?.sessionCookie) {
            console.log(`Found stored Peloton session cookie for user ${userId}`);

            // Test if the cookie is valid
            const client = new PelotonClient(integration.sessionCookie);
            const test = await client.testConnection();

            if (test.success) {
                console.log(`Stored Peloton session cookie is valid for user ${userId}`);

                // Update the lastUpdated timestamp
                await db.update(pelotonIntegration)
                    .set({ lastUpdated: new Date() })
                    .where(eq(pelotonIntegration.userId, userId));

                return integration.sessionCookie;
            }

            console.log(`Stored Peloton session cookie is invalid for user ${userId}, getting a fresh one`);
        }

        // If we have credentials stored, use them to get a new session cookie
        if (integration?.username && integration?.password) {
            // Temporarily set environment variables for the getPelotonSessionCookie function
            const originalUsername = process.env.PELOTON_USERNAME;
            const originalPassword = process.env.PELOTON_PASSWORD;

            process.env.PELOTON_USERNAME = integration.username;
            process.env.PELOTON_PASSWORD = integration.password;

            try {
                const freshCookie = await getPelotonSessionCookie();

                // Restore original environment variables
                process.env.PELOTON_USERNAME = originalUsername;
                process.env.PELOTON_PASSWORD = originalPassword;

                if (freshCookie) {
                    // Update the integration with the new session cookie
                    await db.update(pelotonIntegration)
                        .set({
                            sessionCookie: freshCookie,
                            isActive: true,
                            lastUpdated: new Date()
                        })
                        .where(eq(pelotonIntegration.userId, userId));

                    console.log(`Successfully obtained and stored new Peloton session cookie for user ${userId}`);
                    return freshCookie;
                }
            } catch (error) {
                console.error(`Error getting fresh Peloton session cookie for user ${userId}:`, error);

                // Restore original environment variables in case of error
                process.env.PELOTON_USERNAME = originalUsername;
                process.env.PELOTON_PASSWORD = originalPassword;
            }
        }

        // If all else fails, try the global session cookie
        console.log(`Falling back to global Peloton session cookie for user ${userId}`);
        return process.env.PELOTON_SESSION_COOKIE || null;
    } catch (error) {
        console.error(`Error getting Peloton session cookie for user ${userId}:`, error);
        return null;
    }
}

/**
 * Saves Peloton credentials for a user
 */
export async function savePelotonCredentials(
    userId: string,
    username: string,
    password: string
): Promise<boolean> {
    try {
        // Temporarily set environment variables to test the credentials
        const originalUsername = process.env.PELOTON_USERNAME;
        const originalPassword = process.env.PELOTON_PASSWORD;

        process.env.PELOTON_USERNAME = username;
        process.env.PELOTON_PASSWORD = password;

        try {
            // Test if the credentials work
            const sessionCookie = await getPelotonSessionCookie();

            // Restore original environment variables
            process.env.PELOTON_USERNAME = originalUsername;
            process.env.PELOTON_PASSWORD = originalPassword;

            if (!sessionCookie) {
                console.error(`Failed to authenticate with Peloton using provided credentials for user ${userId}`);
                return false;
            }

            // Check if integration exists for this user
            const existingIntegration = await db.query.pelotonIntegration.findFirst({
                where: eq(pelotonIntegration.userId, userId)
            });

            if (existingIntegration) {
                // Update existing integration
                await db.update(pelotonIntegration)
                    .set({
                        username,
                        password,
                        sessionCookie,
                        isActive: true,
                        lastUpdated: new Date()
                    })
                    .where(eq(pelotonIntegration.userId, userId));
            } else {
                // Create new integration
                await db.insert(pelotonIntegration)
                    .values({
                        userId,
                        username,
                        password,
                        sessionCookie,
                        isActive: true
                    });
            }

            console.log(`Successfully saved Peloton credentials for user ${userId}`);
            return true;
        } catch (error) {
            console.error(`Error testing Peloton credentials for user ${userId}:`, error);

            // Restore original environment variables in case of error
            process.env.PELOTON_USERNAME = originalUsername;
            process.env.PELOTON_PASSWORD = originalPassword;

            return false;
        }
    } catch (error) {
        console.error(`Error saving Peloton credentials for user ${userId}:`, error);
        return false;
    }
}

/**
 * Refreshes Peloton session cookie for a user
 */
export async function refreshPelotonSessionCookie(userId: string): Promise<string | null> {
    try {
        const integration = await db.query.pelotonIntegration.findFirst({
            where: eq(pelotonIntegration.userId, userId)
        });

        if (!integration?.username || !integration?.password) {
            console.error(`No stored Peloton credentials for user ${userId}`);
            return null;
        }

        // Temporarily set environment variables
        const originalUsername = process.env.PELOTON_USERNAME;
        const originalPassword = process.env.PELOTON_PASSWORD;

        process.env.PELOTON_USERNAME = integration.username;
        process.env.PELOTON_PASSWORD = integration.password;

        try {
            const freshCookie = await getPelotonSessionCookie();

            // Restore original environment variables
            process.env.PELOTON_USERNAME = originalUsername;
            process.env.PELOTON_PASSWORD = originalPassword;

            if (freshCookie) {
                // Update the integration with the new session cookie
                await db.update(pelotonIntegration)
                    .set({
                        sessionCookie: freshCookie,
                        isActive: true,
                        lastUpdated: new Date()
                    })
                    .where(eq(pelotonIntegration.userId, userId));

                console.log(`Successfully refreshed Peloton session cookie for user ${userId}`);
                return freshCookie;
            }

            return null;
        } catch (error) {
            console.error(`Error refreshing Peloton session cookie for user ${userId}:`, error);

            // Restore original environment variables in case of error
            process.env.PELOTON_USERNAME = originalUsername;
            process.env.PELOTON_PASSWORD = originalPassword;

            return null;
        }
    } catch (error) {
        console.error(`Error refreshing Peloton session cookie for user ${userId}:`, error);
        return null;
    }
}

/**
 * Deletes a user's Peloton integration
 */
export async function deletePelotonIntegration(userId: string): Promise<boolean> {
    try {
        await db.delete(pelotonIntegration)
            .where(eq(pelotonIntegration.userId, userId));

        console.log(`Successfully deleted Peloton integration for user ${userId}`);
        return true;
    } catch (error) {
        console.error(`Error deleting Peloton integration for user ${userId}:`, error);
        return false;
    }
}
