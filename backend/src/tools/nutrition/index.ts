import { DynamicStructuredTool } from "@langchain/core/tools";
import { getFoodInfoTool } from './food-info';
import { getMealSuggestionTool } from './meal-suggestion';

/**
 * Get all nutrition-related tools
 * @param userId User ID for personalized nutrition recommendations
 * @returns Array of nutrition tools
 */
export function nutritionTools(userId: string): DynamicStructuredTool[] {
    return [
        getFoodInfoTool(userId),
        getMealSuggestionTool(userId),
    ];
} 