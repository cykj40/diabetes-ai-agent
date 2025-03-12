import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { UserProfileService } from "../../services/user-profile.service";
import { DexcomService } from "../../services/dexcom.service";

/**
 * Creates a tool for calculating insulin doses based on user's profile
 * @param userId User ID for accessing personalized insulin calculations
 * @returns A tool that can be used by the agent to calculate insulin doses
 */
export function calculateInsulinDoseTool(userId: string): DynamicStructuredTool {
    const userProfileService = new UserProfileService();
    const dexcomService = new DexcomService();

    return new DynamicStructuredTool({
        name: "calculate_insulin_dose",
        description: "Calculate insulin dose based on carbs, current blood sugar, and target blood sugar",
        schema: z.object({
            carbsInGrams: z.number().describe("Amount of carbohydrates in grams"),
            currentBloodSugar: z.number().optional().describe("Current blood sugar in mg/dL (if not provided, will be fetched from Dexcom)"),
            targetBloodSugar: z.number().optional().describe("Target blood sugar in mg/dL (if not provided, will use the middle of the target range)"),
            insulinOnBoard: z.number().optional().describe("Insulin on board in units (if known)"),
        }) as any, // Type assertion to avoid TypeScript errors
        func: async ({ carbsInGrams, currentBloodSugar, targetBloodSugar, insulinOnBoard = 0 }) => {
            try {
                // Get user profile
                const profile = await userProfileService.getProfile(userId);

                // If current blood sugar not provided, try to get it from Dexcom
                if (!currentBloodSugar) {
                    const reading = await dexcomService.getCurrentReading(userId);
                    if (reading) {
                        currentBloodSugar = reading.value;
                    } else {
                        return "Unable to calculate insulin dose: Current blood sugar is not available. Please provide your current blood sugar.";
                    }
                }

                // If target blood sugar not provided, use the middle of the target range
                if (!targetBloodSugar) {
                    targetBloodSugar = (profile.targetRangeLow + profile.targetRangeHigh) / 2;
                }

                // Calculate carb dose
                const carbDose = carbsInGrams / profile.insulinToCarbRatio;

                // Calculate correction dose
                const bloodSugarDifference = currentBloodSugar - targetBloodSugar;
                let correctionDose = 0;

                if (bloodSugarDifference > 0) {
                    correctionDose = bloodSugarDifference / profile.correctionFactor;
                }

                // Adjust for insulin on board
                const adjustedCorrectionDose = Math.max(0, correctionDose - insulinOnBoard);

                // Calculate total dose
                const totalDose = carbDose + adjustedCorrectionDose;
                const roundedTotalDose = Math.round(totalDose * 10) / 10; // Round to nearest 0.1

                // Format the response
                let response = `Insulin Dose Calculation:\n\n`;
                response += `- Carbs: ${carbsInGrams}g ÷ ${profile.insulinToCarbRatio} = ${carbDose.toFixed(1)} units\n`;

                if (bloodSugarDifference > 0) {
                    response += `- Correction: (${currentBloodSugar} - ${targetBloodSugar}) ÷ ${profile.correctionFactor} = ${correctionDose.toFixed(1)} units\n`;
                } else {
                    response += `- No correction needed (blood sugar is at or below target)\n`;
                }

                if (insulinOnBoard > 0) {
                    response += `- Insulin on board: ${insulinOnBoard} units\n`;
                    response += `- Adjusted correction: ${adjustedCorrectionDose.toFixed(1)} units\n`;
                }

                response += `\n**Recommended dose: ${roundedTotalDose} units of ${profile.bolusInsulinType}**\n\n`;

                // Add warnings or notes
                if (totalDose > 10) {
                    response += `⚠️ Warning: This is a large insulin dose. Consider double-checking your carb count.\n`;
                }

                if (currentBloodSugar < 70) {
                    response += `⚠️ Warning: Your blood sugar is below 70 mg/dL. Consider treating the low blood sugar before taking insulin.\n`;
                }

                response += `\nNote: This calculation is based on your personal settings (1:${profile.insulinToCarbRatio} insulin-to-carb ratio, 1:${profile.correctionFactor} correction factor).\n`;

                return response;
            } catch (error) {
                console.error("Error calculating insulin dose:", error);
                return "Failed to calculate insulin dose. Please try again later.";
            }
        },
    });
} 