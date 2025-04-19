import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getPelotonSessionCookie } from './pelotonClient';

/**
 * Update the PELOTON_SESSION_COOKIE in the .env file
 * @param sessionCookie The new session cookie value
 * @returns Whether the update was successful
 */
async function updateSessionCookieInEnv(sessionCookie: string): Promise<boolean> {
    try {
        // Get path to .env file (in the project root)
        const envPath = path.resolve(__dirname, '../../../.env');

        // Read current .env file
        const envContent = fs.readFileSync(envPath, 'utf8');

        // Replace the session cookie line or add it if it doesn't exist
        const regex = /PELOTON_SESSION_COOKIE=".+"/;
        const newEnvContent = envContent.match(regex)
            ? envContent.replace(regex, `PELOTON_SESSION_COOKIE="${sessionCookie}"`)
            : envContent + `\nPELOTON_SESSION_COOKIE="${sessionCookie}"`;

        // Write the updated content back to the .env file
        fs.writeFileSync(envPath, newEnvContent);

        // Update current environment variable
        process.env.PELOTON_SESSION_COOKIE = sessionCookie;

        console.log('Successfully updated PELOTON_SESSION_COOKIE in .env file');
        return true;
    } catch (error) {
        console.error('Error updating .env file:', error);
        return false;
    }
}

/**
 * Run this script to refresh the Peloton session cookie
 */
async function main() {
    console.log('Starting Peloton session cookie refresh...');

    // Get a fresh session cookie
    const sessionCookie = await getPelotonSessionCookie();

    if (!sessionCookie) {
        console.error('Failed to get a new Peloton session cookie');
        process.exit(1);
    }

    // Update the .env file with the new cookie
    const updated = await updateSessionCookieInEnv(sessionCookie);

    if (!updated) {
        console.error('Failed to update .env file');
        process.exit(1);
    }

    console.log('Peloton session cookie refreshed successfully');
    process.exit(0);
}

// Run the script if it's called directly
if (require.main === module) {
    main();
}

// Export for use in other files
export { updateSessionCookieInEnv }; 