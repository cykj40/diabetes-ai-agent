import axios from 'axios';
import crypto from 'crypto';

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
    private accessToken: string | null = null;

    constructor() {
        console.log('Raw environment variables:');
        console.log('process.env.DEXCOM_API_URL =', process.env.DEXCOM_API_URL);
        console.log('process.env.DEXCOM_CLIENT_ID =', process.env.DEXCOM_CLIENT_ID);
        console.log('process.env.DEXCOM_CLIENT_SECRET =', process.env.DEXCOM_CLIENT_SECRET);
        console.log('process.env.DEXCOM_REDIRECT_URI =', process.env.DEXCOM_REDIRECT_URI);

        this.apiUrl = process.env.DEXCOM_API_URL || 'https://api.dexcom.com/v2';
        this.clientId = process.env.DEXCOM_CLIENT_ID || '';
        this.clientSecret = process.env.DEXCOM_CLIENT_SECRET || '';
        this.redirectUri = process.env.DEXCOM_REDIRECT_URI || 'http://localhost:3000/auth/dexcom/callback';

        console.log('\nAssigned values:');
        console.log('this.apiUrl =', this.apiUrl);
        console.log('this.clientId =', this.clientId);
        console.log('this.clientSecret =', this.clientSecret ? '[PRESENT]' : '[MISSING]');
        console.log('this.redirectUri =', this.redirectUri);

        if (!this.clientId || !this.clientSecret) {
            console.error('Missing credentials:', {
                hasClientId: !!this.clientId,
                hasClientSecret: !!this.clientSecret
            });
            throw new Error('Dexcom API credentials are required');
        }
    }

    getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            state: state,
            scope: 'offline_access'
        });
        return `${this.apiUrl}/oauth2/login?${params.toString()}`;
    }

    async exchangeCodeForToken(code: string): Promise<DexcomTokens> {
        try {
            const response = await axios.post(`${this.apiUrl}/oauth2/token`, {
                grant_type: 'authorization_code',
                code: code,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri
            });
            this.accessToken = response.data.access_token;
            return response.data;
        } catch (error) {
            console.error('Failed to exchange code for token:', error);
            throw new Error('Token exchange failed');
        }
    }

    async refreshToken(refreshToken: string): Promise<DexcomTokens> {
        try {
            const response = await axios.post(`${this.apiUrl}/oauth2/token`, {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri
            });
            this.accessToken = response.data.access_token;
            return response.data;
        } catch (error) {
            console.error('Failed to refresh token:', error);
            throw new Error('Token refresh failed');
        }
    }

    private async authenticate() {
        try {
            const response = await axios.post(`${this.apiUrl}/oauth2/token`, {
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: 'offline_access'
            });
            this.accessToken = response.data.access_token;
        } catch (error) {
            console.error('Failed to authenticate with Dexcom API:', error);
            throw new Error('Authentication failed');
        }
    }

    async getEgvs(startDate: Date, endDate: Date): Promise<DexcomReading[]> {
        if (!this.accessToken) {
            await this.authenticate();
        }

        try {
            const response = await axios.get(`${this.apiUrl}/users/self/egvs`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
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
        } catch (error) {
            console.error('Failed to fetch Dexcom readings:', error);
            throw new Error('Failed to fetch blood sugar readings');
        }
    }

    async getLatestReadings(count: number = 24): Promise<DexcomReading[]> {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (count * 5 * 60 * 1000)); // count * 5 minutes in ms
        return this.getEgvs(startDate, endDate);
    }

    async getAlerts(startDate: Date, endDate: Date): Promise<DexcomAlert[]> {
        if (!this.accessToken) {
            await this.authenticate();
        }

        try {
            const response = await axios.get<AlertsResponse>(`${this.apiUrl}/users/self/alerts`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
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
        if (!this.accessToken) {
            await this.authenticate();
        }

        try {
            const response = await axios.get<DevicesResponse>(`${this.apiUrl}/users/self/devices`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            return response.data.records;
        } catch (error) {
            console.error('Failed to fetch Dexcom devices:', error);
            throw new Error('Failed to fetch devices');
        }
    }

    async getDataRange(lastSyncTime?: Date): Promise<DataRangeResponse> {
        if (!this.accessToken) {
            await this.authenticate();
        }

        try {
            const params: { lastSyncTime?: string } = {};
            if (lastSyncTime) {
                params.lastSyncTime = lastSyncTime.toISOString();
            }

            const response = await axios.get<DataRangeResponse>(`${this.apiUrl}/users/self/dataRange`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
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