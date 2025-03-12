import { DynamicStructuredTool } from "@langchain/core/tools";
import { getAllTools } from '../tools';

/**
 * Service for managing agent tools
 * This service acts as a facade for all the tools available to the agent
 */
export class AgentToolsService {
    /**
     * Get all available tools for the agent
     * @param userId User ID for personalized tools
     * @returns Array of tools that can be used by the agent
     */
    getTools(userId: string = 'default-user'): DynamicStructuredTool[] {
        return getAllTools(userId);
    }
} 