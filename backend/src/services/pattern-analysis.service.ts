import { PrismaClient } from '@prisma/client';
import { DexcomReading } from './dexcom.service';

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

    constructor() {
        this.prisma = new PrismaClient();
    }

    async storeReading(reading: DexcomReading, sessionId: string): Promise<void> {
        await this.prisma.bloodSugarReading.create({
            data: {
                sessionId,
                value: reading.value,
                trend: reading.trend,
                timestamp: new Date(reading.timestamp),
            },
        });
    }

    async getTimeOfDayAnalysis(sessionId: string, days: number = 7): Promise<Record<string, number>> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

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

        const timeSlots: Record<string, number[]> = {
            morning: [],   // 6-11
            afternoon: [], // 12-17
            evening: [],   // 18-23
            night: [],     // 0-5
        };

        readings.forEach(reading => {
            const hour = reading.timestamp.getHours();
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

        const dayGroups: Record<string, number[]> = {};
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        readings.forEach(reading => {
            const day = days[reading.timestamp.getDay()];
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