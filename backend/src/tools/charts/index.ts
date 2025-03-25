import { DynamicStructuredTool } from "@langchain/core/tools";
import { getChartTool } from './chart.tool';

export function chartTools(userId: string): DynamicStructuredTool[] {
    return [getChartTool(userId)];
} 