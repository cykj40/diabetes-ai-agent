const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PELOTON_API_URL = 'https://api.onepeloton.com';

// Rate limiting constants
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 1 minute

/**
 * Makes an API request with retry logic for rate limiting
 * @param {Object} config - Axios request configuration
 * @param {number} retries - Number of retries attempted so far
 * @returns {Promise<any>} - The API response data
 */
async function makeApiRequest(config, retries = 0) {
    try {
        console.log(`Making API request to: ${config.url}`);
        const response = await axios(config);
        return response.data;
    } catch (error) {
        // Handle rate limiting (HTTP 429)
        if (error.response && error.response.status === 429 && retries < MAX_RETRIES) {
            const retryDelay = Math.min(
                INITIAL_RETRY_DELAY * Math.pow(2, retries),
                MAX_RETRY_DELAY
            );

            console.log(`Rate limited. Retrying in ${retryDelay}ms (Attempt ${retries + 1}/${MAX_RETRIES})`);

            // Wait for the calculated delay
            await new Promise(resolve => setTimeout(resolve, retryDelay));

            // Retry the request
            return makeApiRequest(config, retries + 1);
        }

        // Log detailed error information
        console.error('API request failed:');
        console.error('Status:', error.response ? error.response.status : 'No response');
        console.error('Message:', error.message);
        console.error('Response data:', error.response ? error.response.data : 'No response data');
        throw error;
    }
}

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

        // Add jitter to prevent multiple server instances from hitting the API at exactly the same time
        const jitter = Math.floor(Math.random() * 2000); // Random delay up to 2 seconds
        console.log(`Adding random delay of ${jitter}ms before API call`);
        await new Promise(resolve => setTimeout(resolve, jitter));

        const config = {
            method: 'post',
            url: `${PELOTON_API_URL}/auth/login`,
            data: {
                username_or_email: username,
                password: password
            },
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'DiabetesAgentAI/1.0'
            }
        };

        const response = await makeApiRequest(config);

        if (!response || !response.session_id) {
            console.error('Failed to get session ID from Peloton response');
            return null;
        }

        const sessionId = response.session_id;
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

async function testConnection(sessionCookie) {
    try {
        console.log('Testing connection with the new session cookie...');

        // First try the /api/me endpoint
        const config = {
            method: 'get',
            url: `${PELOTON_API_URL}/api/me`,
            headers: {
                'Cookie': `peloton_session_id=${sessionCookie}`,
                'User-Agent': 'DiabetesAgentAI/1.0',
                'Accept': 'application/json',
                'peloton-platform': 'web'
            }
        };

        try {
            const response = await makeApiRequest(config);

            if (response && response.username) {
                console.log(`✅ Connection test successful! Connected as user: ${response.username}`);
                return true;
            }
        } catch (error) {
            console.log('First endpoint test failed, trying alternative endpoint...');
        }

        // If the first endpoint fails, try the /auth/check_session endpoint
        const altConfig = {
            method: 'get',
            url: `${PELOTON_API_URL}/auth/check_session`,
            headers: {
                'Cookie': `peloton_session_id=${sessionCookie}`,
                'User-Agent': 'DiabetesAgentAI/1.0',
                'Accept': 'application/json'
            }
        };

        const altResponse = await makeApiRequest(altConfig);

        if (altResponse && (altResponse.user_id || altResponse.user)) {
            console.log(`✅ Connection test successful using alternative endpoint!`);
            return true;
        } else {
            console.log('❌ Connection test failed. Unexpected response format from both endpoints.');
            return false;
        }
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
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

    // Test the connection with the new cookie
    const connectionTest = await testConnection(sessionCookie);

    if (!connectionTest) {
        console.log('Warning: The new session cookie did not pass the connection test.');
        console.log('You may still proceed, but the connection might not work.');
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