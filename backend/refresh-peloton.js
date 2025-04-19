const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PELOTON_API_URL = 'https://api.onepeloton.com';

async function getPelotonSessionCookie() {
    try {
        console.log('Getting fresh Peloton session cookie...');
        const username = process.env.PELOTON_USERNAME;
        const password = process.env.PELOTON_PASSWORD;

        console.log(`Username: ${username ? 'Found' : 'Not found'}`);
        console.log(`Password: ${password ? 'Found' : 'Not found'}`);

        if (!username || !password) {
            console.error('Peloton credentials not configured in environment variables');
            return null;
        }

        const response = await axios.post(`${PELOTON_API_URL}/auth/login`, {
            username_or_email: username,
            password: password
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'DiabetesAgentAI/1.0'
            }
        });

        if (!response.data || !response.data.session_id) {
            console.error('Failed to get session ID from Peloton response');
            return null;
        }

        const sessionId = response.data.session_id;
        console.log('Successfully retrieved new Peloton session cookie');
        return sessionId;
    } catch (error) {
        console.error('Error authenticating with Peloton:', error.message);
        return null;
    }
}

async function updateSessionCookieInEnv(sessionCookie) {
    try {
        // Get path to .env file
        const envPath = path.join(__dirname, '.env');
        console.log(`Env path: ${envPath}`);
        console.log(`Env exists: ${fs.existsSync(envPath)}`);

        // Read current .env file
        const envContent = fs.readFileSync(envPath, 'utf8');

        // Replace the session cookie line or add it if it doesn't exist
        const regex = /PELOTON_SESSION_COOKIE="[^"]*"/;
        const newEnvContent = envContent.match(regex)
            ? envContent.replace(regex, `PELOTON_SESSION_COOKIE="${sessionCookie}"`)
            : envContent + `\nPELOTON_SESSION_COOKIE="${sessionCookie}"`;

        // Write the updated content back to the .env file
        fs.writeFileSync(envPath, newEnvContent);

        console.log('Successfully updated PELOTON_SESSION_COOKIE in .env file');
        return true;
    } catch (error) {
        console.error('Error updating .env file:', error.message);
        return false;
    }
}

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
    console.log(`New session cookie: ${sessionCookie}`);
    process.exit(0);
}

main(); 