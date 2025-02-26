import axios from 'axios';
import { Issuer, Client, generators, TokenSet } from 'openid-client';

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

    constructor() {
        this.apiUrl = process.env.DEXCOM_API_URL || 'https://sandbox-api.dexcom.com';
        this.clientId = process.env.DEXCOM_CLIENT_ID || '';
        this.clientSecret = process.env.DEXCOM_CLIENT_SECRET || '';
        this.redirectUri = process.env.DEXCOM_REDIRECT_URI || 'http://localhost:3001/auth/dexcom/callback';
        this.initializeClient();
    }

    private async initializeClient() {
        try {
            const issuer = new Issuer({
                issuer: this.apiUrl,
                authorization_endpoint: `${this.apiUrl}/v3/oauth2/login`,
                token_endpoint: `${this.apiUrl}/v3/oauth2/token`,
                userinfo_endpoint: `${this.apiUrl}/v3/users/self/egvs`
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

            this.tokenSet = await this.client.callback(
                this.redirectUri,
                { code, state },
                { code_verifier: codeVerifier }
            );

            console.log('Successfully authenticated with Dexcom API');
            return true;
        } catch (error) {
            console.error('Failed to exchange auth code:', error);
            this.tokenSet = null;
            return false;
        }
    }

    async refreshToken(): Promise<boolean> {
        try {
            if (!this.client || !this.tokenSet?.refresh_token) {
                return false;
            }

            this.tokenSet = await this.client.refresh(this.tokenSet.refresh_token);
            return true;
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
            const hasValidToken = await this.ensureValidToken();
            console.log('Token status:', hasValidToken ? 'Valid' : 'Invalid/Missing');

            if (hasValidToken && this.tokenSet) {
                console.log('Fetching real Dexcom data...');
                const endDate = new Date();
                const startDate = new Date(endDate.getTime() - (count * 5 * 60 * 1000));

                const response = await axios.get(`${this.apiUrl}/v3/users/self/egvs`, {
                    headers: {
                        'Authorization': `Bearer ${this.tokenSet.access_token}`
                    },
                    params: {
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString()
                    }
                });

                return response.data.records.map((record: any) => ({
                    value: record.value,
                    trend: record.trend,
                    timestamp: record.timestamp
                }));
            }

            return this.generateMockReadings(count);
        } catch (error) {
            console.error('Error in getLatestReadings:', error);
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
        if (!this.tokenSet) {
            await this.ensureValidToken();
        }

        try {
            const response = await axios.get<AlertsResponse>(`${this.apiUrl}/users/self/alerts`, {
                headers: {
                    'Authorization': `Bearer ${this.tokenSet.access_token}`
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
            const response = await axios.get<DevicesResponse>(`${this.apiUrl}/v3/users/self/devices`, {
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
        if (!this.tokenSet) {
            await this.ensureValidToken();
        }

        try {
            const params: { lastSyncTime?: string } = {};
            if (lastSyncTime) {
                params.lastSyncTime = lastSyncTime.toISOString();
            }

            const response = await axios.get<DataRangeResponse>(`${this.apiUrl}/users/self/dataRange`, {
                headers: {
                    'Authorization': `Bearer ${this.tokenSet.access_token}`
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