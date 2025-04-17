import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getRecentWorkoutsTool } from "./recent-workouts";
import { getWorkoutDetailsTool } from "./workout-details";
import { getExerciseImpactTool } from "./exercise-impact";

/**
 * Get all Peloton-related tools for the agent
 * @param userId User ID for personalized tools
 * @returns Array of tools that can be used by the agent for Peloton data
 */
export function pelotonTools(userId: string = 'default-user'): DynamicStructuredTool[] {
    try {
        return [
            getRecentWorkoutsTool(userId),
            getWorkoutDetailsTool(userId),
            getExerciseImpactTool(userId)
        ];
    } catch (error) {
        console.error("Error initializing Peloton tools:", error);
        return [];
    }
} 