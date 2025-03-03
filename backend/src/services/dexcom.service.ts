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

export interface DexcomV3Reading {
    recordId: string;
    systemTime: string;
    displayTime: string;
    transmitterId?: string;
    transmitterTicks: number;
    value?: number;
    status?: 'unknown' | 'high' | 'low' | 'ok';
    trend?: 'none' | 'unknown' | 'doubleUp' | 'singleUp' | 'fortyFiveUp' | 'flat' | 'fortyFiveDown' | 'singleDown' | 'doubleDown' | 'notComputable' | 'rateOutOfRange';
    trendRate?: number;
    unit: string;
    rateUnit: string;
    displayDevice: string;
    transmitterGeneration: string;
}

export interface DexcomV3Response {
    recordType: string;
    recordVersion: string;
    userId: string;
    records: DexcomV3Reading[];
}

export interface DexcomEvent {
    systemTime: string;
    displayTime: string;
    recordId: string;
    eventStatus: 'created' | 'updated' | 'deleted';
    eventType: 'unknown' | 'insulin' | 'carbs' | 'exercise' | 'health' | 'bloodGlucose' | 'notes';
    eventSubType?: 'unknown' | 'fastActing' | 'longActing' | 'light' | 'medium' | 'heavy' | 'illness' | 'stress' | 'highSymptoms' | 'lowSymptoms' | 'cycle' | 'alcohol' | null;
    value: string;
    unit?: 'unknown' | 'grams' | 'mg/dL' | 'minutes' | 'units' | null;
    transmitterId: string;
    transmitterGeneration: 'unknown' | 'g4' | 'g5' | 'g6' | 'g6+' | 'dexcomPro' | 'g7';
    displayDevice: string;
}

export interface EventsResponse {
    recordType: string;
    recordVersion: string;
    userId: string;
    records: DexcomEvent[];
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
        if (!this.client || !this.tokenSet || !this.tokenSet.refresh_token) {
            console.log('Cannot refresh token: missing client or refresh token');
            return false;
        }

        try {
            console.log('Refreshing token...');
            const newTokenSet = await this.client.refresh(this.tokenSet.refresh_token);

            // Important: Dexcom issues a new refresh token with each refresh
            // The old refresh token is immediately invalidated
            this.tokenSet = newTokenSet;

            // Save the new token set to the database
            await this.saveTokenToDatabase();

            console.log('Token refreshed successfully');
            return true;
        } catch (error: any) {
            // Handle specific error cases as mentioned in Dexcom docs
            if (error.response?.statusCode === 400) {
                console.error('Refresh token is no longer valid. User needs to re-authorize.');
                // Clear invalid tokens
                this.tokenSet = null;
                await this.clearTokenFromDatabase();
                // User will need to go through authorization flow again
            } else {
                console.error('Failed to refresh token:', error);
            }
            return false;
        }
    }

    private async clearTokenFromDatabase() {
        try {
            await this.prisma.dexcomToken.delete({
                where: { userId: this.userId }
            });
            console.log('Cleared invalid token from database');
        } catch (error) {
            console.error('Failed to clear token from database:', error);
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

                // Try to use the v3 API first
                try {
                    const v3Readings = await this.getV3EGVs(count);
                    console.log(`Successfully fetched ${v3Readings.length} readings from v3 API`);
                    return v3Readings;
                } catch (v3Error) {
                    console.error('Error using v3 API, falling back to v2:', v3Error);

                    // Fall back to v2 API if v3 fails
                    try {
                        return await this.getV2Readings(count);
                    } catch (v2Error) {
                        console.error('Error using v2 API, falling back to mock data:', v2Error);
                        return this.generateMockReadings(count);
                    }
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

    private async getV2Readings(count: number): Promise<DexcomReading[]> {
        // Use current date instead of fixed date
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (count * 5 * 60 * 1000));

        console.log('Using date range for v2 API:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });

        try {
            const response = await axios.get(`${this.apiUrl}/v2/users/self/egvs`, {
                headers: {
                    'Authorization': `Bearer ${this.tokenSet!.access_token}`
                },
                params: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            });

            console.log('Dexcom v2 API response status:', response.status);
            console.log('Response has data:', !!response.data);
            console.log('Response has records:', !!response.data.records);
            console.log('Number of records:', response.data.records ? response.data.records.length : 0);

            return response.data.records.map((record: any) => ({
                value: record.value,
                trend: record.trend,
                timestamp: record.timestamp
            }));
        } catch (apiError: any) {
            console.error('Error calling Dexcom v2 API:', apiError.message);
            if (apiError.response) {
                console.error('Response status:', apiError.response.status);
                console.error('Response data:', apiError.response.data);
            }
            throw apiError;
        }
    }

    async getV3EGVs(count: number = 48): Promise<DexcomReading[]> {
        if (!await this.ensureValidToken()) {
            throw new Error('Not authenticated with Dexcom');
        }

        // Use current date instead of fixed date
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (count * 5 * 60 * 1000));

        console.log('Using date range for v3 API:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });

        try {
            console.log('Calling Dexcom v3 API endpoint...');
            const response = await axios.get<DexcomV3Response>(`${this.apiUrl}/v3/users/self/egvs`, {
                headers: {
                    'Authorization': `Bearer ${this.tokenSet!.access_token}`
                },
                params: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            });

            console.log('Dexcom v3 API response status:', response.status);
            console.log('Response has data:', !!response.data);
            console.log('Response has records:', !!response.data.records);
            console.log('Number of records:', response.data.records ? response.data.records.length : 0);

            // Convert v3 format to the format expected by the frontend
            return response.data.records.map(record => {
                // Convert trend values from v3 to v2 format
                let trendValue = 'Stable';
                switch (record.trend) {
                    case 'doubleUp':
                        trendValue = 'Rising Rapidly';
                        break;
                    case 'singleUp':
                        trendValue = 'Rising';
                        break;
                    case 'fortyFiveUp':
                        trendValue = 'Rising Slightly';
                        break;
                    case 'flat':
                        trendValue = 'Stable';
                        break;
                    case 'fortyFiveDown':
                        trendValue = 'Falling Slightly';
                        break;
                    case 'singleDown':
                        trendValue = 'Falling';
                        break;
                    case 'doubleDown':
                        trendValue = 'Falling Rapidly';
                        break;
                    default:
                        trendValue = 'Stable';
                }

                return {
                    value: record.value || 0,
                    trend: trendValue,
                    timestamp: record.systemTime
                };
            });
        } catch (error: any) {
            console.error('Error calling Dexcom v3 API:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            throw error;
        }
    }

    private generateMockReadings(count: number): DexcomReading[] {
        console.log('Generating mock blood sugar data');
        const mockReadings: DexcomReading[] = [];

        // Use current date instead of fixed date from 2023
        const endDate = new Date();

        for (let i = 0; i < count; i++) {
            const timestamp = new Date(endDate.getTime() - (i * 5 * 60 * 1000));
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
        // Use current date instead of fixed date
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000)); // hours in ms
        return this.getAlerts(startDate, endDate);
    }

    async getV3Devices(): Promise<DexcomDevice[]> {
        if (!await this.ensureValidToken()) {
            return [];
        }

        try {
            console.log('Calling Dexcom v3 devices API endpoint...');
            const response = await axios.get<DevicesResponse>(`${this.apiUrl}/v3/users/self/devices`, {
                headers: {
                    'Authorization': `Bearer ${this.tokenSet!.access_token}`
                }
            });

            console.log('Dexcom v3 devices API response status:', response.status);
            console.log('Response has data:', !!response.data);
            console.log('Response has records:', !!response.data.records);
            console.log('Number of records:', response.data.records ? response.data.records.length : 0);

            return response.data.records;
        } catch (error: any) {
            console.error('Error calling Dexcom v3 devices API:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            return [];
        }
    }

    async getDevices(): Promise<DexcomDevice[]> {
        if (!await this.ensureValidToken()) {
            return [];
        }

        try {
            // Try v3 API first
            try {
                const v3Devices = await this.getV3Devices();
                if (v3Devices.length > 0) {
                    console.log(`Successfully fetched ${v3Devices.length} devices from v3 API`);
                    return v3Devices;
                }
            } catch (v3Error) {
                console.error('Error using v3 devices API, falling back to v2:', v3Error);
            }

            // Fall back to v2 API
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
            // Try v3 API first
            try {
                return await this.getV3DataRange(lastSyncTime);
            } catch (v3Error) {
                console.error('Error using v3 data range API, falling back to v2:', v3Error);

                // Fall back to v2 API
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
            }
        } catch (error) {
            console.error('Failed to fetch Dexcom data range:', error);
            throw new Error('Failed to fetch data range');
        }
    }

    async getV3DataRange(lastSyncTime?: Date): Promise<DataRangeResponse> {
        if (!await this.ensureValidToken()) {
            throw new Error('Not authenticated with Dexcom');
        }

        try {
            console.log('Calling Dexcom v3 data range API endpoint...');

            const params: { lastSyncTime?: string } = {};
            if (lastSyncTime) {
                params.lastSyncTime = lastSyncTime.toISOString();
                console.log(`Using lastSyncTime: ${params.lastSyncTime}`);
            }

            const response = await axios.get<DataRangeResponse>(`${this.apiUrl}/v3/users/self/dataRange`, {
                headers: {
                    'Authorization': `Bearer ${this.tokenSet!.access_token}`
                },
                params
            });

            console.log('Dexcom v3 data range API response status:', response.status);
            console.log('Response has data:', !!response.data);

            if (response.data.egvs) {
                console.log('EGVs data range:', {
                    start: response.data.egvs.start.systemTime,
                    end: response.data.egvs.end.systemTime
                });
            }

            return response.data;
        } catch (error: any) {
            console.error('Error calling Dexcom v3 data range API:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            throw error;
        }
    }

    async getWeeklyBloodSugarData(): Promise<{
        labels: string[];
        values: number[];
        trends: string[];
        insights: string[];
    }> {
        try {
            console.log('Fetching weekly blood sugar data...');

            // Use current date instead of fixed date
            const endDate = new Date();
            const startDate = new Date(endDate.getTime());
            startDate.setDate(startDate.getDate() - 7);

            console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

            // Get readings for the past week
            const readings = await this.getLatestReadings(2016); // 7 days * 24 hours * 12 readings per hour (5-min intervals)

            // Filter readings to only include those from the past week
            const weeklyReadings = readings.filter(reading => {
                const readingDate = new Date(reading.timestamp);
                return readingDate >= startDate && readingDate <= endDate;
            });

            console.log(`Found ${weeklyReadings.length} readings in the past week`);

            if (weeklyReadings.length === 0) {
                return {
                    labels: [],
                    values: [],
                    trends: [],
                    insights: ['No blood sugar data available for the past week.']
                };
            }

            // Format data for the chart
            const labels = weeklyReadings.map(reading => {
                const date = new Date(reading.timestamp);
                return date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                });
            });

            const values = weeklyReadings.map(reading => reading.value);
            const trends = weeklyReadings.map(reading => reading.trend);

            // Generate insights
            const insights = this.generateInsightsFromReadings(weeklyReadings);

            return {
                labels,
                values,
                trends,
                insights
            };
        } catch (error) {
            console.error('Error fetching weekly blood sugar data:', error);
            throw error;
        }
    }

    private generateInsightsFromReadings(readings: DexcomReading[]): string[] {
        const insights: string[] = [];

        if (readings.length === 0) {
            return ['No data available for analysis.'];
        }

        // Calculate average blood sugar
        const sum = readings.reduce((total, reading) => total + reading.value, 0);
        const average = Math.round(sum / readings.length);
        insights.push(`Average blood sugar: ${average} mg/dL`);

        // Find highest and lowest readings
        const sortedReadings = [...readings].sort((a, b) => a.value - b.value);
        const lowest = sortedReadings[0];
        const highest = sortedReadings[sortedReadings.length - 1];

        insights.push(`Lowest reading: ${lowest.value} mg/dL (${new Date(lowest.timestamp).toLocaleString()})`);
        insights.push(`Highest reading: ${highest.value} mg/dL (${new Date(highest.timestamp).toLocaleString()})`);

        // Calculate time in range (70-180 mg/dL)
        const inRange = readings.filter(r => r.value >= 70 && r.value <= 180).length;
        const percentInRange = Math.round((inRange / readings.length) * 100);
        insights.push(`Time in range (70-180 mg/dL): ${percentInRange}%`);

        // Identify patterns
        const morningReadings = readings.filter(r => {
            const hour = new Date(r.timestamp).getHours();
            return hour >= 6 && hour < 12;
        });

        const afternoonReadings = readings.filter(r => {
            const hour = new Date(r.timestamp).getHours();
            return hour >= 12 && hour < 18;
        });

        const eveningReadings = readings.filter(r => {
            const hour = new Date(r.timestamp).getHours();
            return hour >= 18 && hour < 22;
        });

        const nightReadings = readings.filter(r => {
            const hour = new Date(r.timestamp).getHours();
            return hour >= 22 || hour < 6;
        });

        const morningAvg = morningReadings.length > 0
            ? Math.round(morningReadings.reduce((sum, r) => sum + r.value, 0) / morningReadings.length)
            : 0;

        const afternoonAvg = afternoonReadings.length > 0
            ? Math.round(afternoonReadings.reduce((sum, r) => sum + r.value, 0) / afternoonReadings.length)
            : 0;

        const eveningAvg = eveningReadings.length > 0
            ? Math.round(eveningReadings.reduce((sum, r) => sum + r.value, 0) / eveningReadings.length)
            : 0;

        const nightAvg = nightReadings.length > 0
            ? Math.round(nightReadings.reduce((sum, r) => sum + r.value, 0) / nightReadings.length)
            : 0;

        if (morningAvg > 0) insights.push(`Morning average: ${morningAvg} mg/dL`);
        if (afternoonAvg > 0) insights.push(`Afternoon average: ${afternoonAvg} mg/dL`);
        if (eveningAvg > 0) insights.push(`Evening average: ${eveningAvg} mg/dL`);
        if (nightAvg > 0) insights.push(`Night average: ${nightAvg} mg/dL`);

        return insights;
    }

    async getEvents(startDate: Date, endDate: Date): Promise<DexcomEvent[]> {
        if (!await this.ensureValidToken()) {
            throw new Error('Not authenticated with Dexcom');
        }

        try {
            console.log('Fetching Dexcom events...');
            console.log('Date range:', {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });

            const response = await axios.get<EventsResponse>(`${this.apiUrl}/v3/users/self/events`, {
                headers: {
                    'Authorization': `Bearer ${this.tokenSet!.access_token}`
                },
                params: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            });

            console.log('Dexcom events API response status:', response.status);
            console.log('Response has data:', !!response.data);
            console.log('Response has records:', !!response.data.records);
            console.log('Number of event records:', response.data.records ? response.data.records.length : 0);

            if (response.data.records && response.data.records.length > 0) {
                // Log summary of event types
                const eventTypeCounts = response.data.records.reduce((counts, event) => {
                    counts[event.eventType] = (counts[event.eventType] || 0) + 1;
                    return counts;
                }, {} as Record<string, number>);

                console.log('Event type summary:', eventTypeCounts);
            }

            return response.data.records || [];
        } catch (error: any) {
            console.error('Error fetching Dexcom events:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            throw new Error('Failed to fetch Dexcom events');
        }
    }

    async getLatestEvents(days: number = 7): Promise<DexcomEvent[]> {
        // Use current date
        const endDate = new Date();
        const startDate = new Date(endDate.getTime());
        startDate.setDate(startDate.getDate() - days);

        return this.getEvents(startDate, endDate);
    }

    async getNutritionData(days: number = 7): Promise<{
        dates: string[];
        carbs: number[];
    }> {
        try {
            const events = await this.getLatestEvents(days);

            // Filter for carb events only
            const carbEvents = events.filter(event => event.eventType === 'carbs');

            // Group by day
            const dailyCarbs: Record<string, number> = {};

            carbEvents.forEach(event => {
                const date = new Date(event.systemTime);
                const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD

                // Convert value to number (it's stored as string in the API)
                const carbValue = parseFloat(event.value) || 0;

                // Add to daily total
                dailyCarbs[dateString] = (dailyCarbs[dateString] || 0) + carbValue;
            });

            // Sort dates
            const sortedDates = Object.keys(dailyCarbs).sort();

            return {
                dates: sortedDates,
                carbs: sortedDates.map(date => dailyCarbs[date])
            };
        } catch (error) {
            console.error('Error fetching nutrition data:', error);
            return {
                dates: [],
                carbs: []
            };
        }
    }

    async getInsulinData(days: number = 7): Promise<{
        dates: string[];
        fastActing: number[];
        longActing: number[];
    }> {
        try {
            const events = await this.getLatestEvents(days);

            // Filter for insulin events only
            const insulinEvents = events.filter(event => event.eventType === 'insulin');

            // Group by day and insulin type
            const dailyFastActing: Record<string, number> = {};
            const dailyLongActing: Record<string, number> = {};

            insulinEvents.forEach(event => {
                const date = new Date(event.systemTime);
                const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD

                // Convert value to number (it's stored as string in the API)
                const insulinValue = parseFloat(event.value) || 0;

                // Add to appropriate daily total based on subtype
                if (event.eventSubType === 'fastActing') {
                    dailyFastActing[dateString] = (dailyFastActing[dateString] || 0) + insulinValue;
                } else if (event.eventSubType === 'longActing') {
                    dailyLongActing[dateString] = (dailyLongActing[dateString] || 0) + insulinValue;
                }
            });

            // Sort dates (combine all dates from both types)
            const allDates = new Set([...Object.keys(dailyFastActing), ...Object.keys(dailyLongActing)]);
            const sortedDates = Array.from(allDates).sort();

            return {
                dates: sortedDates,
                fastActing: sortedDates.map(date => dailyFastActing[date] || 0),
                longActing: sortedDates.map(date => dailyLongActing[date] || 0)
            };
        } catch (error) {
            console.error('Error fetching insulin data:', error);
            return {
                dates: [],
                fastActing: [],
                longActing: []
            };
        }
    }
} 