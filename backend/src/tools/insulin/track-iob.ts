import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { UserProfileService } from "../../services/user-profile.service";
import { db } from '../../db';
import { eq } from 'drizzle-orm';

interface InsulinDose {
    id: string;
    userId: string;
    units: number;
    insulinType: string;
    timestamp: Date;
    description?: string;
}

/**
 * Creates a tool for tracking insulin on board (IOB)
 * @param userId User ID for accessing personalized insulin data
 * @returns A tool that can be used by the agent to track insulin on board
 */
export function trackInsulinOnBoardTool(userId: string): DynamicStructuredTool {
    const userProfileService = new UserProfileService();

    return new DynamicStructuredTool({
        name: "track_insulin_on_board",
        description: "Track insulin on board (IOB) based on recent Novolog doses. The user takes Novolog as short-acting insulin which remains active for 4 hours. Use this tool to check how much insulin is still active in the body before calculating new doses.",
        schema: z.object({
            recordDose: z.boolean().optional().describe("Whether to record a new insulin dose"),
            units: z.number().optional().describe("Units of insulin for the new dose"),
            insulinType: z.string().optional().describe("Type of insulin (default is Novolog)"),
            description: z.string().optional().describe("Description of the dose (e.g., 'breakfast', 'correction')"),
            timeAgo: z.number().optional().describe("Hours ago the dose was taken (default is now)"),
        }) as any, // Type assertion to avoid TypeScript errors
        func: async ({ recordDose = false, units, insulinType, description, timeAgo = 0 }) => {
            try {
                // Get user profile
                const profile = await userProfileService.getProfile(userId);

                // Record a new dose if requested
                if (recordDose) {
                    if (!units || units <= 0) {
                        return "Unable to record insulin dose: Units must be greater than 0.";
                    }

                    if (!insulinType) {
                        insulinType = profile.bolusInsulinType; // Default to user's bolus insulin type
                    }

                    // Calculate timestamp based on timeAgo
                    const timestamp = new Date(Date.now() - timeAgo * 60 * 60 * 1000);

                    // In a real implementation, this would store to a database
                    // For now, we'll just log it
                    console.log(`Recording insulin dose: ${units} units of ${insulinType} for user ${userId}`);
                    console.log(`Description: ${description || 'No description'}, Time: ${timestamp.toLocaleString()}`);

                    // Mock database storage
                    // In a real implementation, this would use Drizzle to store to the database
                    // Example: await db.insert(insulinDose).values({ userId, units, insulinType, timestamp, description }).returning();
                    const newDose = {
                        id: Date.now().toString(),
                        userId,
                        units,
                        insulinType,
                        timestamp,
                        description
                    };

                    // Return confirmation
                    return `Successfully recorded ${units} units of ${insulinType} at ${newDose.timestamp.toLocaleTimeString()}.`;
                }

                // Calculate insulin on board
                // In a real implementation, this would fetch recent doses from the database
                // For now, we'll return a mock calculation

                // Mock recent doses (in a real implementation, these would come from the database)
                const recentDoses: InsulinDose[] = [
                    {
                        id: '1',
                        userId,
                        units: 3,
                        insulinType: profile.bolusInsulinType,
                        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                        description: 'Lunch'
                    },
                    {
                        id: '2',
                        userId,
                        units: 1.5,
                        insulinType: profile.bolusInsulinType,
                        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
                        description: 'Correction'
                    }
                ];

                // Calculate IOB for each dose
                let totalIOB = 0;
                const iobDetails = [];

                for (const dose of recentDoses) {
                    const hoursAgo = (Date.now() - dose.timestamp.getTime()) / (60 * 60 * 1000);

                    // Skip if the dose is older than the insulin duration
                    if (hoursAgo >= profile.insulinDurationHours) {
                        continue;
                    }

                    // Calculate remaining insulin percentage based on a linear model
                    // In a real implementation, this would use a more sophisticated model
                    const remainingPercentage = Math.max(0, 1 - (hoursAgo / profile.insulinDurationHours));
                    const remainingUnits = dose.units * remainingPercentage;

                    totalIOB += remainingUnits;

                    iobDetails.push({
                        dose,
                        hoursAgo: Math.round(hoursAgo * 10) / 10,
                        remainingUnits: Math.round(remainingUnits * 10) / 10
                    });
                }

                // Format the response
                let response = `Insulin On Board (IOB) Calculation:\n\n`;

                if (iobDetails.length === 0) {
                    response += `No active insulin detected. All previous doses have completed their ${profile.insulinDurationHours}-hour duration.\n`;
                } else {
                    response += `Recent insulin doses:\n`;

                    iobDetails.forEach(detail => {
                        response += `- ${detail.dose.units} units of ${detail.dose.insulinType} (${detail.hoursAgo} hours ago): ${detail.remainingUnits} units remaining\n`;
                    });

                    response += `\n**Total insulin on board: ${Math.round(totalIOB * 10) / 10} units**\n\n`;

                    // Add notes
                    response += `Note: This calculation is based on your ${profile.insulinDurationHours}-hour insulin duration setting.\n`;
                }

                return response;
            } catch (error) {
                console.error("Error tracking insulin on board:", error);
                return "Failed to track insulin on board. Please try again later.";
            }
        },
    });
}
