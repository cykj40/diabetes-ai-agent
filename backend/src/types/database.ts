export interface HealthData {
    id: number;
    clerk_user_id: string;
    data_type: string;
    value: any;
    timestamp: Date;
}

export interface User {
    id: string;
    email: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Session {
    id: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
} 