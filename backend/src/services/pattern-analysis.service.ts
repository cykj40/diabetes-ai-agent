import { PrismaClient } from '@prisma/client';
import { DexcomReading, DexcomService } from './dexcom.service';
import crypto from 'crypto';

interface PatternAnalysis {
    timeOfDay: {
        morning: number;
        afternoon: number;
        evening: number;
        night: number;
    };
    weeklyTrends: {
        averageByDay: Record<string, number>;
        volatilityByDay: Record<string, number>;
    };
    commonPatterns: {
        highRiskTimes: string[];
        stablePeriods: string[];
        improvement: string[];
        concerns: string[];
    };
}

export class PatternAnalysisService {
    private prisma: PrismaClient;
    private dexcomService: DexcomService;

    constructor() {
        this.prisma = new PrismaClient();
        this.dexcomService = new DexcomService();
    }

    async storeReading(reading: DexcomReading, sessionId: string, userId: string = 'default-user'): Promise<void> {
        try {
            // Try to create the reading with userId
            try {
                await this.prisma.bloodSugarReading.create({
                    data: {
                        sessionId,
                        userId,
                        value: reading.value,
                        trend: reading.trend,
                        timestamp: new Date(reading.timestamp),
                    },
                });
            } catch (error: any) {
                // If the error is about the userId column not existing, try without it
                if (error.message && error.message.includes('column "userId" does not exist')) {
                    console.log('The userId column does not exist in the BloodSugarReading table. Using simplified schema.');

                    // Use a raw query to insert without userId
                    await this.prisma.$executeRaw`
                        INSERT INTO "BloodSugarReading" ("id", "sessionId", "value", "trend", "timestamp", "analyzed", "isEmbedded")
                        VALUES (${crypto.randomUUID()}, ${sessionId}, ${reading.value}, ${reading.trend}, ${new Date(reading.timestamp)}, false, false)
                    `;
                } else {
                    // Re-throw other errors
                    throw error;
                }
            }
        } catch (error) {
            console.error('Error storing reading in database:', error);
            // Don't throw the error, just log it and continue
        }
    }

    async getTimeOfDayAnalysis(sessionId: string, days: number = 7): Promise<Record<string, number>> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // First try to get readings from the database
        const readings = await this.prisma.bloodSugarReading.findMany({
            where: {
                sessionId,
                timestamp: {
                    gte: startDate,
                },
            },
            orderBy: {
                timestamp: 'asc',
            },
        });

        // If no readings in database, try to get them directly from Dexcom
        let allReadings: any[] = readings;
        if (readings.length === 0) {
            console.log('No readings found in database, fetching from Dexcom service...');
            try {
                const dexcomReadings = await this.dexcomService.getLatestReadings(days * 288); // 288 readings per day (5-minute intervals)

                // Filter to only include readings from the past 'days' days
                allReadings = dexcomReadings.filter(reading => {
                    const readingDate = new Date(reading.timestamp);
                    return readingDate >= startDate;
                });

                console.log(`Retrieved ${allReadings.length} readings from Dexcom service`);

                // Store these readings in the database for future use
                for (const reading of allReadings) {
                    await this.storeReading(reading, sessionId);
                }
            } catch (error) {
                console.error('Error fetching readings from Dexcom service:', error);
                // Continue with empty readings if Dexcom fetch fails
            }
        }

        const timeSlots: Record<string, number[]> = {
            morning: [],   // 6-11
            afternoon: [], // 12-17
            evening: [],   // 18-23
            night: [],     // 0-5
        };

        allReadings.forEach(reading => {
            const timestamp = reading.timestamp instanceof Date ? reading.timestamp : new Date(reading.timestamp);
            const hour = timestamp.getHours();
            if (hour >= 6 && hour < 12) timeSlots.morning.push(reading.value);
            else if (hour >= 12 && hour < 18) timeSlots.afternoon.push(reading.value);
            else if (hour >= 18) timeSlots.evening.push(reading.value);
            else timeSlots.night.push(reading.value);
        });

        return Object.entries(timeSlots).reduce((acc, [key, values]) => {
            acc[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            return acc;
        }, {} as Record<string, number>);
    }

    async getWeeklyPatterns(sessionId: string): Promise<PatternAnalysis['weeklyTrends']> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        // First try to get readings from the database
        const readings = await this.prisma.bloodSugarReading.findMany({
            where: {
                sessionId,
                timestamp: {
                    gte: startDate,
                },
            },
            orderBy: {
                timestamp: 'asc',
            },
        });

        // If no readings in database, try to get them directly from Dexcom
        let allReadings: any[] = readings;
        if (readings.length === 0) {
            console.log('No readings found in database for weekly patterns, fetching from Dexcom service...');
            try {
                const dexcomReadings = await this.dexcomService.getLatestReadings(2016); // 7 days * 24 hours * 12 readings per hour (5-min intervals)

                // Filter to only include readings from the past week
                allReadings = dexcomReadings.filter(reading => {
                    const readingDate = new Date(reading.timestamp);
                    return readingDate >= startDate;
                });

                console.log(`Retrieved ${allReadings.length} readings from Dexcom service for weekly patterns`);

                // Store these readings in the database for future use
                for (const reading of allReadings) {
                    await this.storeReading(reading, sessionId);
                }
            } catch (error) {
                console.error('Error fetching readings from Dexcom service for weekly patterns:', error);
                // Continue with empty readings if Dexcom fetch fails
            }
        }

        const dayGroups: Record<string, number[]> = {};
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        allReadings.forEach(reading => {
            const timestamp = reading.timestamp instanceof Date ? reading.timestamp : new Date(reading.timestamp);
            const day = days[timestamp.getDay()];
            if (!dayGroups[day]) dayGroups[day] = [];
            dayGroups[day].push(reading.value);
        });

        const averageByDay: Record<string, number> = {};
        const volatilityByDay: Record<string, number> = {};

        days.forEach(day => {
            const values = dayGroups[day] || [];
            if (values.length > 0) {
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                averageByDay[day] = avg;

                const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
                volatilityByDay[day] = Math.sqrt(variance);
            } else {
                averageByDay[day] = 0;
                volatilityByDay[day] = 0;
            }
        });

        return {
            averageByDay,
            volatilityByDay,
        };
    }

    async identifyPatterns(sessionId: string): Promise<PatternAnalysis['commonPatterns']> {
        const timeOfDay = await this.getTimeOfDayAnalysis(sessionId);
        const weeklyTrends = await this.getWeeklyPatterns(sessionId);

        const highRiskTimes: string[] = [];
        const stablePeriods: string[] = [];
        const improvement: string[] = [];
        const concerns: string[] = [];

        // Analyze time of day patterns
        Object.entries(timeOfDay).forEach(([period, avg]) => {
            if (avg > 180) highRiskTimes.push(`High readings during ${period}`);
            if (avg < 70) highRiskTimes.push(`Low readings during ${period}`);
            if (avg >= 70 && avg <= 180) stablePeriods.push(`Good control during ${period}`);
        });

        // Analyze weekly patterns
        Object.entries(weeklyTrends.volatilityByDay).forEach(([day, volatility]) => {
            if (volatility > 50) {
                concerns.push(`High variability on ${day}s`);
            } else if (volatility < 30) {
                stablePeriods.push(`Stable readings on ${day}s`);
            }
        });

        return {
            highRiskTimes,
            stablePeriods,
            improvement,
            concerns,
        };
    }
} 