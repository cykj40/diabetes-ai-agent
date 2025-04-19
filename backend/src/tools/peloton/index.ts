import { DynamicStructuredTool } from "@langchain/core/tools";
import { getFetchPelotonWorkoutDataTool } from "./fetchPelotonWorkoutDataTool";
import { getTestPelotonConnectionTool } from "./testConnectionTool";
import { getMuscleImpactTool } from "./muscleImpactTool";
import { getPelotonMuscleChartTool } from "./pelotonMuscleChartTool";

/**
 * Get all Peloton-related tools for the agent
 * @param userId User ID for personalized tools
 * @returns Array of tools that can be used by the agent for Peloton data
 */
export function pelotonTools(userId: string = 'default-user'): DynamicStructuredTool[] {
    try {
        return [
            getTestPelotonConnectionTool(userId),
            getFetchPelotonWorkoutDataTool(userId),
            getMuscleImpactTool(userId),
            getPelotonMuscleChartTool(userId)
        ];
    } catch (error) {
        console.error("Error initializing Peloton tools:", error);
        return [];
    }
} 