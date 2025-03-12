import { DynamicStructuredTool } from "@langchain/core/tools";
import { getCurrentReadingTool } from './current-reading';
import { getRecentReadingsTool } from './recent-readings';
import { getPatternsTool } from './patterns';
import { getWeeklyBloodSugarDataTool } from './weekly-data';

/**
 * Get all Dexcom-related tools
 * @param userId User ID for personalized Dexcom data access
 * @returns Array of Dexcom tools
 */
export function dexcomTools(userId: string): DynamicStructuredTool[] {
    return [
        getCurrentReadingTool(userId),
        getRecentReadingsTool(userId),
        getPatternsTool(userId),
        getWeeklyBloodSugarDataTool(userId),
    ];
} 