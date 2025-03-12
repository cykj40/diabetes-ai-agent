import { DynamicStructuredTool } from "@langchain/core/tools";
import { calculateInsulinDoseTool } from './calculate-dose';
import { trackInsulinOnBoardTool } from './track-iob';

/**
 * Get all insulin-related tools
 * @param userId User ID for personalized insulin calculations
 * @returns Array of insulin tools
 */
export function insulinTools(userId: string): DynamicStructuredTool[] {
    return [
        calculateInsulinDoseTool(userId),
        trackInsulinOnBoardTool(userId),
    ];
} 