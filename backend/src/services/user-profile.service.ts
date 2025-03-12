import { PrismaClient } from '@prisma/client';

export interface DiabetesProfile {
    userId: string;
    insulinToCarbRatio: number;
    correctionFactor: number;
    insulinDurationHours: number;
    targetRangeLow: number;
    targetRangeHigh: number;
    basalMorningMin: number;
    basalMorningMax: number;
    basalEveningMin: number;
    basalEveningMax: number;
    basalInsulinType: string;
    bolusInsulinType: string;
    customNotes?: string;
}

export class UserProfileService {
    private prisma: PrismaClient;
    private defaultProfiles: Map<string, DiabetesProfile> = new Map();

    constructor() {
        this.prisma = new PrismaClient();
        this.initializeDefaultProfiles();
    }

    private initializeDefaultProfiles() {
        // Add a default profile for the main user
        this.defaultProfiles.set('default-user', {
            userId: 'default-user',
            insulinToCarbRatio: 4.5,
            correctionFactor: 25,
            insulinDurationHours: 4,
            targetRangeLow: 80,
            targetRangeHigh: 120,
            basalMorningMin: 20,
            basalMorningMax: 24,
            basalEveningMin: 10,
            basalEveningMax: 14,
            basalInsulinType: 'Basaglar',
            bolusInsulinType: 'Novolog',
            customNotes: 'User prefers to maintain tight blood sugar control. Interested in fitness, nutrition, and optimizing insulin doses.'
        });
    }

    async getProfile(userId: string): Promise<DiabetesProfile> {
        try {
            // In the future, this could be expanded to fetch from a database
            // For now, return the default profile
            return this.defaultProfiles.get(userId) || this.defaultProfiles.get('default-user')!;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            // Return default profile if there's an error
            return this.defaultProfiles.get('default-user')!;
        }
    }

    async updateProfile(profile: DiabetesProfile): Promise<DiabetesProfile> {
        try {
            // In the future, this could be expanded to update in a database
            // For now, just update the in-memory map
            this.defaultProfiles.set(profile.userId, profile);
            return profile;
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw new Error('Failed to update user profile');
        }
    }

    getProfilePrompt(userId: string): string {
        const profile = this.defaultProfiles.get(userId) || this.defaultProfiles.get('default-user')!;

        return `
USER DIABETES PROFILE:
- Insulin to Carb ratio: 1 unit of ${profile.bolusInsulinType} for every ${profile.insulinToCarbRatio} carbs
- Correction dose: 1 unit of ${profile.bolusInsulinType} lowers blood sugar by ${profile.correctionFactor} mg/dl
- Duration of Insulin Action: ${profile.insulinDurationHours} hours
- Long Acting Insulin ${profile.basalInsulinType}: 
  * ${profile.basalMorningMin} - ${profile.basalMorningMax} units in the morning 
  * ${profile.basalEveningMin} - ${profile.basalEveningMax} units in the evening
- Target blood sugar range: ${profile.targetRangeLow} - ${profile.targetRangeHigh} mg/dl

CALCULATION GUIDELINES:
1. Calculate insulin doses based on carb intake (1:${profile.insulinToCarbRatio} ratio)
2. Calculate correction doses (1 unit per ${profile.correctionFactor} mg/dl)
3. Track insulin on board (${profile.insulinDurationHours}-hour duration)
4. Consider basal insulin schedule (morning: ${profile.basalMorningMin}-${profile.basalMorningMax}u, evening: ${profile.basalEveningMin}-${profile.basalEveningMax}u)
`;
    }
} 