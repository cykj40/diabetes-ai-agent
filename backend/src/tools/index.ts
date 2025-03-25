import { DynamicStructuredTool } from "@langchain/core/tools";
import { dexcomTools } from './dexcom';
import { nutritionTools } from './nutrition';
import { insulinTools } from './insulin';
import { chartTools } from './charts';

/**
 * Get all available tools for the agent
 * @param userId User ID for personalized tools
 * @returns Array of tools that can be used by the agent
 */
export function getAllTools(userId: string = 'default-user'): DynamicStructuredTool[] {
    return [
        ...dexcomTools(userId),
        ...nutritionTools(userId),
        ...insulinTools(userId),
        ...chartTools(userId),
    ];
} 