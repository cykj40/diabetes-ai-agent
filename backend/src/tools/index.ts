import { DynamicStructuredTool } from "@langchain/core/tools";
import { dexcomTools } from './dexcom';
import { chartTools } from './charts';
import { nutritionTools } from './nutrition';

/**
 * Get all available tools for the agent
 * @param userId User ID for personalized tools
 * @returns Array of tools that can be used by the agent
 */
export function getAllTools(userId: string = 'default-user'): DynamicStructuredTool[] {
    return [
        ...dexcomTools(userId),
        ...chartTools(userId),
        ...nutritionTools(userId),
    ];
} 