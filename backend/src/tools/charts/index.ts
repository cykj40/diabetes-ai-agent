import { DynamicStructuredTool } from "@langchain/core/tools";
import { getLineChartTool } from './line-chart';
import { getPieChartTool } from './pie-chart';

/**
 * Get all chart generation tools
 * @param userId User ID for personalized chart generation
 * @returns Array of chart generation tools
 */
export function chartTools(userId: string): DynamicStructuredTool[] {
    return [
        getLineChartTool(userId),
        getPieChartTool(userId),
    ];
} 