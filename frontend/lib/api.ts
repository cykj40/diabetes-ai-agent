/**
 * API utilities for making requests to the backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Get the authentication token from cookies
 */
export function getAuthToken(): string | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'auth_token') {
            return value;
        }
    }
    return null;
}

/**
 * Make a request to the API with proper headers and error handling
 */
export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getAuthToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
    });

    if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
            // If we can't parse JSON, just use the status text
        }

        throw new Error(errorMessage);
    }

    return response.json();
}

/**
 * Specific API methods for different endpoints
 */
export const api = {
    // Dexcom endpoints
    dexcom: {
        getCurrentReading: () => apiRequest('/api/dexcom/current-reading'),
        getReadings: (count = 48) => apiRequest(`/api/dexcom/readings?count=${count}`),
        getWeeklyData: () => apiRequest('/api/dexcom/weekly-data'),
        getDeviceData: () => apiRequest('/api/dexcom/device-data'),
    },

    // Peloton endpoints
    peloton: {
        testConnection: () => apiRequest('/api/peloton/test-connection'),
        getRecentWorkouts: (limit = 10) => apiRequest(`/api/peloton/recent-workouts?limit=${limit}`),
        getMuscleImpact: (days = 7) => apiRequest(`/api/peloton/muscle-impact?days=${days}`),
        getMuscleActivity: (period: '7_days' | '30_days' = '7_days') =>
            apiRequest(`/api/peloton/muscle-activity?period=${period}`),
        getMuscleChart: (period: '7_days' | '30_days' = '7_days') =>
            apiRequest(`/api/peloton/muscle-chart?period=${period}`),
    },

    // Auth endpoints
    auth: {
        me: () => apiRequest('/api/auth/me'),
        signin: (data: { email: string; password: string }) =>
            apiRequest('/api/auth/signin', { method: 'POST', body: JSON.stringify(data) }),
        signup: (data: { email: string; password: string; name: string }) =>
            apiRequest('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
        signout: () => apiRequest('/api/auth/signout', { method: 'POST' }),
    }
}; 