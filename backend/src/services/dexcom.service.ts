import axios from 'axios';
import { Issuer, Client, generators, TokenSet } from 'openid-client';
import { PrismaClient } from '@prisma/client';

export interface DexcomReading {
    value: number;
    trend: string;
    timestamp: string;
}

export interface DexcomTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
}

export interface DexcomAlert {
    recordId: string;
    systemTime: string;
    displayTime: string;
    alertName: 'unknown' | 'high' | 'low' | 'rise' | 'fall' | 'outOfRange' | 'urgentLow' | 'urgentLowSoon' | 'noReadings' | 'fixedLow';
    alertState: 'unknown' | 'inactive' | 'activeSnoozed' | 'activeAlarming';
    displayDevice: 'unknown' | 'receiver' | 'iOS' | 'android';
    transmitterGeneration: 'unknown' | 'g4' | 'g5' | 'g6' | 'g6+' | 'dexcomPro' | 'g7';
    transmitterId: string;
    displayApp?: string;
}

export interface AlertsResponse {
    recordType: string;
    recordVersion: string;
    userId: string;
    records: DexcomAlert[];
}

export type DexcomUnit = 'unknown' | 'grams' | 'mg/dL' | 'mmol/L' | 'mg/dL/min' | 'mmol/L/min' | 'minutes' | 'units';
export type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
export type AlertName = 'unknown' | 'high' | 'low' | 'rise' | 'fall' | 'outOfRange' | 'urgentLow' | 'urgentLowSoon' | 'noReadings' | 'fixedLow';
export type SoundTheme = 'unknown' | 'modern' | 'classic';
export type SoundOutputMode = 'unknown' | 'sound' | 'vibrate' | 'match';
export type OverrideMode = 'unknown' | 'quiet' | 'vibrate';

export interface DeviceAlertSetting {
    alertName: AlertName;
    value?: number;
    unit?: DexcomUnit;
    snooze?: number;
    enabled: boolean;
    systemTime?: string;
    displayTime?: string;
    delay?: number;
    secondaryTriggerCondition?: number;
    soundTheme?: SoundTheme;
    soundOutputMode?: SoundOutputMode;
}

export interface OverrideSetting {
    isOverrideEnabled?: boolean;
    mode?: OverrideMode;
    endTime?: string;
}

export interface DeviceAlertScheduleSettings {
    alertScheduleName: string;
    isEnabled: boolean;
    isDefaultSchedule: boolean;
    startTime: string;
    endTime: string;
    daysOfWeek: DayOfWeek[];
    isActive?: boolean;
    override?: OverrideSetting;
}

export interface DeviceAlertSchedule {
    alertScheduleSettings: DeviceAlertScheduleSettings;
    alertSettings: DeviceAlertSetting[];
}

export interface DexcomDevice {
    lastUploadDate: string;
    transmitterId?: string;
    transmitterGeneration: 'unknown' | 'g4' | 'g5' | 'g6' | 'g6+' | 'dexcomPro' | 'g7';
    displayDevice: 'unknown' | 'receiver' | 'iOS' | 'android';
    displayApp?: string;
    alertSchedules: DeviceAlertSchedule[];
}

export interface DevicesResponse {
    recordType: string;
    recordVersion: string;
    userId: string;
    records: DexcomDevice[];
}

export interface DataRangeMoment {
    systemTime: string;
    displayTime: string;
}

export interface DataRangeStartAndEnd {
    start: DataRangeMoment;
    end: DataRangeMoment;
}

export interface DataRangeResponse {
    recordType: string;
    recordVersion: string;
    userId: string;
    calibrations?: DataRangeStartAndEnd;
    egvs?: DataRangeStartAndEnd;
    events?: DataRangeStartAndEnd;
}

export class DexcomService {
    private readonly apiUrl: string;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;
    private client: Client | null = null;
    private tokenSet: TokenSet | null = null;
    private prisma: PrismaClient;
    private userId: string = 'default-user'; // We'll use a default user ID for now

    constructor() {
        this.apiUrl = process.env.DEXCOM_API_URL || 'https://sandbox-api.dexcom.com';
        this.clientId = process.env.DEXCOM_CLIENT_ID || '';
        this.clientSecret = process.env.DEXCOM_CLIENT_SECRET || '';
        this.redirectUri = process.env.DEXCOM_REDIRECT_URI || 'http://localhost:3001/auth/dexcom/callback';
        this.prisma = new PrismaClient();
        this.initializeClient();
        this.loadTokenFromDatabase();
    }

    private async loadTokenFromDatabase() {
        try {
            console.log('Attempting to load token from database for user:', this.userId);
            const tokenRecord = await this.prisma.dexcomToken.findUnique({
                where: { userId: this.userId }
            });

            if (tokenRecord) {
                console.log('Found token record in database');
                console.log('Access token (first 10 chars):', tokenRecord.accessToken.substring(0, 10) + '...');
                console.log('Has refresh token:', !!tokenRecord.refreshToken);
                console.log('Token expires at:', tokenRecord.expiresAt);

                // Create a TokenSet from the database record
                this.tokenSet = new TokenSet({
                    access_token: tokenRecord.accessToken,
                    refresh_token: tokenRecord.refreshToken,
                    expires_at: Math.floor(tokenRecord.expiresAt.getTime() / 1000)
                });

                console.log('Successfully loaded token from database');
                console.log('Token expired:', this.tokenSet.expired());
            } else {
                console.log('No token record found in database');
            }
        } catch (error) {
            console.error('Failed to load token from database:', error);
        }
    }

    private async saveTokenToDatabase() {
        if (!this.tokenSet) return;

        try {
            const expiresAt = new Date(this.tokenSet.expires_at! * 1000);

            await this.prisma.dexcomToken.upsert({
                where: { userId: this.userId },
                update: {
                    accessToken: this.tokenSet.access_token!,
                    refreshToken: this.tokenSet.refresh_token!,
                    expiresAt
                },
                create: {
                    userId: this.userId,
                    accessToken: this.tokenSet.access_token!,
                    refreshToken: this.tokenSet.refresh_token!,
                    expiresAt
                }
            });

            console.log('Saved token to database');
        } catch (error) {
            console.error('Failed to save token to database:', error);
        }
    }

    private async initializeClient() {
        try {
            const issuer = new Issuer({
                issuer: this.apiUrl,
                authorization_endpoint: `${this.apiUrl}/v2/oauth2/login`,
                token_endpoint: `${this.apiUrl}/v2/oauth2/token`,
                userinfo_endpoint: `${this.apiUrl}/v2/users/self/egvs`
            });

            this.client = new issuer.Client({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uris: [this.redirectUri],
                response_types: ['code'],
                token_endpoint_auth_method: 'client_secret_post'
            });

            console.log('DexcomService initialized with OpenID client');
        } catch (error) {
            console.error('Failed to initialize OpenID client:', error);
            throw error;
        }
    }

    get isAuthenticated(): boolean {
        return this.tokenSet !== null && !this.tokenSet.expired();
    }

    async getAuthUrl(): Promise<{ url: string, codeVerifier: string, state: string }> {
        if (!this.client) {
            await this.initializeClient();
        }

        const codeVerifier = generators.codeVerifier();
        const codeChallenge = generators.codeChallenge(codeVerifier);
        const state = generators.state();

        const url = this.client!.authorizationUrl({
            scope: 'offline_access',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state
        });

        return { url, codeVerifier, state };
    }

    async handleCallback(code: string, codeVerifier: string, state: string): Promise<boolean> {
        try {
            if (!this.client) {
                await this.initializeClient();
            }

            console.log('Attempting to exchange code for token with:');
            console.log('- redirectUri:', this.redirectUri);
            console.log('- code:', code.substring(0, 8) + '...');
            console.log('- state:', state.substring(0, 8) + '...');
            console.log('- codeVerifier length:', codeVerifier ? codeVerifier.length : 0);
            console.log('- codeVerifier first 10 chars:', codeVerifier ? codeVerifier.substring(0, 10) + '...' : 'missing');

            // Instead of using the OpenID client, let's directly call the token endpoint
            // as described in the Dexcom API documentation
            try {
                // Log the full request details (except secrets)
                const requestParams = {
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: this.redirectUri,
                    client_id: this.clientId.substring(0, 8) + '...',
                    // Don't log the client_secret
                };
                console.log('Token request parameters:', requestParams);

                // Make sure the redirect URI exactly matches what's registered with Dexcom
                // including trailing slashes, protocol, etc.
                const tokenResponse = await axios.post(
                    `${this.apiUrl}/v2/oauth2/token`,
                    new URLSearchParams({
                        grant_type: 'authorization_code',
                        code: code,
                        redirect_uri: this.redirectUri,
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                console.log('Token exchange response status:', tokenResponse.status);

                if (tokenResponse.status === 200 && tokenResponse.data) {
                    const { access_token, refresh_token, expires_in } = tokenResponse.data;

                    // Create a TokenSet from the response
                    this.tokenSet = new TokenSet({
                        access_token,
                        refresh_token,
                        expires_in
                    });

                    console.log('Token exchange successful!');
                    console.log('- access_token:', access_token ? (access_token.substring(0, 8) + '...') : 'missing');
                    console.log('- refresh_token:', refresh_token ? 'present' : 'missing');
                    console.log('- expires_in:', expires_in);

                    // Save token to database
                    await this.saveTokenToDatabase();

                    console.log('Successfully authenticated with Dexcom API');
                    return true;
                } else {
                    console.error('Unexpected token response:', tokenResponse.data);
                    return false;
                }
            } catch (error: any) {
                console.error('Error during token exchange:', error);
                if (error.response) {
                    console.error('Response status:', error.response.status);
                    console.error('Response data:', error.response.data);

                    // Handle specific error cases
                    if (error.response.status === 400) {
                        if (error.response.data.error === 'invalid_grant') {
                            console.error('Invalid grant error. Possible reasons:');
                            console.error('1. The authorization code has already been used (they are single-use)');
                            console.error('2. The authorization code has expired (they expire after one minute)');
                            console.error('3. The code_verifier doesn\'t match what was used to generate the code_challenge');
                            console.error('4. The redirect_uri doesn\'t match what was registered with Dexcom');
                        }
                    }
                }
                return false;
            }
        } catch (error) {
            console.error('Failed to exchange auth code:', error);
            if (error instanceof Error) {
                console.error('Error details:', error.message);
                console.error('Error stack:', error.stack);
            }
            this.tokenSet = null;
            return false;
        }
    }

    async refreshToken(): Promise<boolean> {
        try {
            if (!this.tokenSet?.refresh_token) {
                console.error('No refresh token available');
                return false;
            }

            console.log('Attempting to refresh token...');

            // Direct implementation of token refresh based on Dexcom API docs
            try {
                const refreshResponse = await axios.post(
                    `${this.apiUrl}/v2/oauth2/token`,
                    new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: this.tokenSet.refresh_token!,
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                console.log('Refresh token response status:', refreshResponse.status);

                if (refreshResponse.status === 200 && refreshResponse.data) {
                    const { access_token, refresh_token, expires_in } = refreshResponse.data;

                    // Create a new TokenSet from the response
                    this.tokenSet = new TokenSet({
                        access_token,
                        refresh_token,
                        expires_in
                    });

                    console.log('Token refresh successful!');
                    console.log('- new access_token:', access_token ? (access_token.substring(0, 8) + '...') : 'missing');
                    console.log('- new refresh_token:', refresh_token ? 'present' : 'missing');

                    // Save updated token to database
                    await this.saveTokenToDatabase();

                    return true;
                } else {
                    console.error('Unexpected refresh response:', refreshResponse.data);
                    return false;
                }
            } catch (error: any) {
                console.error('Error during token refresh:', error);
                if (error.response) {
                    console.error('Response status:', error.response.status);
                    console.error('Response data:', error.response.data);
                }

                // If we get a 400 error, the refresh token is no longer valid
                if (error.response && error.response.status === 400) {
                    console.error('Refresh token is no longer valid. User needs to re-authorize.');
                    this.tokenSet = null;
                }

                return false;
            }
        } catch (error) {
            console.error('Failed to refresh token:', error);
            this.tokenSet = null;
            return false;
        }
    }

    private async ensureValidToken(): Promise<boolean> {
        if (!this.isAuthenticated && this.tokenSet?.refresh_token) {
            return this.refreshToken();
        }
        return this.isAuthenticated;
    }

    async getLatestReadings(count: number = 48): Promise<DexcomReading[]> {
        try {
            console.log('Starting getLatestReadings...');
            console.log('Is authenticated before token check:', this.isAuthenticated);
            console.log('Has tokenSet:', !!this.tokenSet);
            if (this.tokenSet) {
                console.log('Token expires at:', this.tokenSet.expires_at);
                console.log('Token expired:', this.tokenSet.expired());
                console.log('Has refresh token:', !!this.tokenSet.refresh_token);
            }

            const hasValidToken = await this.ensureValidToken();
            console.log('Token status after ensureValidToken:', hasValidToken ? 'Valid' : 'Invalid/Missing');

            if (hasValidToken && this.tokenSet) {
                console.log('Fetching real Dexcom data...');
                console.log('API URL:', this.apiUrl);

                // Get current date and ensure it's not in the future
                const now = new Date();
                const currentTime = new Date();
                // Check if date is in the future and adjust if needed
                if (now > new Date(Date.now() + 86400000)) { // If more than 1 day in the future
                    console.log('System date appears to be in the future, using current timestamp instead');
                    now.setTime(Date.now());
                }

                const endDate = now;
                const startDate = new Date(endDate.getTime() - (count * 5 * 60 * 1000));

                console.log('Current time from Date.now():', new Date(Date.now()).toISOString());
                console.log('Using date range:', {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                });

                try {
                    const response = await axios.get(`${this.apiUrl}/v2/users/self/egvs`, {
                        headers: {
                            'Authorization': `Bearer ${this.tokenSet.access_token}`
                        },
                        params: {
                            startDate: startDate.toISOString(),
                            endDate: endDate.toISOString()
                        }
                    });

                    console.log('Dexcom API response status:', response.status);
                    console.log('Response has data:', !!response.data);
                    console.log('Response has records:', !!response.data.records);
                    console.log('Number of records:', response.data.records ? response.data.records.length : 0);

                    return response.data.records.map((record: any) => ({
                        value: record.value,
                        trend: record.trend,
                        timestamp: record.timestamp
                    }));
                } catch (apiError: any) {
                    console.error('Error calling Dexcom API:', apiError.message);
                    if (apiError.response) {
                        console.error('Response status:', apiError.response.status);
                        console.error('Response data:', apiError.response.data);
                    }
                    throw apiError; // Re-throw to be caught by the outer catch
                }
            } else {
                console.log('No valid token available, falling back to mock data');
                return this.generateMockReadings(count);
            }
        } catch (error) {
            console.error('Error in getLatestReadings:', error);
            console.log('Falling back to mock data due to error');
            return this.generateMockReadings(count);
        }
    }

    private generateMockReadings(count: number): DexcomReading[] {
        console.log('Generating mock blood sugar data');
        const mockReadings: DexcomReading[] = [];
        const now = new Date();

        for (let i = 0; i < count; i++) {
            const timestamp = new Date(now.getTime() - (i * 5 * 60 * 1000));
            const baseValue = 140;
            const variation = Math.sin(i / 12) * 30;
            const randomness = (Math.random() - 0.5) * 20;
            const value = Math.round(baseValue + variation + randomness);

            let trend: string;
            if (i === 0 || mockReadings.length === 0) {
                trend = 'Stable';
            } else {
                const prevValue = mockReadings[mockReadings.length - 1].value;
                if (value > prevValue + 10) trend = 'Rising';
                else if (value < prevValue - 10) trend = 'Falling';
                else trend = 'Stable';
            }

            mockReadings.push({
                value,
                trend,
                timestamp: timestamp.toISOString()
            });
        }

        return mockReadings.reverse();
    }

    async getAlerts(startDate: Date, endDate: Date): Promise<DexcomAlert[]> {
        if (!await this.ensureValidToken()) {
            throw new Error('Not authenticated with Dexcom');
        }

        try {
            const response = await axios.get<AlertsResponse>(`${this.apiUrl}/v2/users/self/alerts`, {
                headers: {
                    'Authorization': `Bearer ${this.tokenSet!.access_token}`
                },
                params: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            });

            return response.data.records;
        } catch (error) {
            console.error('Failed to fetch Dexcom alerts:', error);
            throw new Error('Failed to fetch alerts');
        }
    }

    async getLatestAlerts(hours: number = 24): Promise<DexcomAlert[]> {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000)); // hours in ms
        return this.getAlerts(startDate, endDate);
    }

    async getDevices(): Promise<DexcomDevice[]> {
        if (!await this.ensureValidToken()) {
            return [];
        }

        try {
            const response = await axios.get<DevicesResponse>(`${this.apiUrl}/v2/users/self/devices`, {
                headers: {
                    'Authorization': `Bearer ${this.tokenSet!.access_token}`
                }
            });

            return response.data.records;
        } catch (error) {
            console.error('Failed to fetch Dexcom devices:', error);
            return [];
        }
    }

    async getDataRange(lastSyncTime?: Date): Promise<DataRangeResponse> {
        if (!await this.ensureValidToken()) {
            throw new Error('Not authenticated with Dexcom');
        }

        try {
            const params: { lastSyncTime?: string } = {};
            if (lastSyncTime) {
                params.lastSyncTime = lastSyncTime.toISOString();
            }

            const response = await axios.get<DataRangeResponse>(`${this.apiUrl}/v2/users/self/dataRange`, {
                headers: {
                    'Authorization': `Bearer ${this.tokenSet!.access_token}`
                },
                params
            });

            return response.data;
        } catch (error) {
            console.error('Failed to fetch Dexcom data range:', error);
            throw new Error('Failed to fetch data range');
        }
    }
} 