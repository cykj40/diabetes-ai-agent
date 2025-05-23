import { DynamicStructuredTool } from "@langchain/core/tools";
import { dexcomTools } from './dexcom';
import { nutritionTools } from './nutrition';
import { insulinTools } from './insulin';
import { chartTools } from './charts';
import { pelotonTools } from './peloton';
import { webSearchTools } from './web-search';
import { bloodWorkTools } from './blood-work';

/**
 * Get all available tools for the agent
 * @param userId User ID for personalized tools
 * @returns Array of tools that can be used by the agent
 */
export function getAllTools(userId: string = 'default-user'): DynamicStructuredTool[] {
    console.debug(`Registering tools for user: ${userId}`);

    // Get tools from each category
    const tools = [
        ...dexcomTools(userId),
        ...nutritionTools(userId),
        ...insulinTools(userId),
        ...chartTools(userId),
    ];

    // Add blood work tools
    try {
        const bloodWorkToolsArray = bloodWorkTools(userId);
        console.debug(`Registering ${bloodWorkToolsArray.length} blood work tools`);
        tools.push(...bloodWorkToolsArray);
    } catch (error) {
        console.error("Error registering blood work tools:", error);
    }

    // Try to add Peloton tools if available
    try {
        const pelotonToolsArray = pelotonTools(userId);
        console.debug(`Registering ${pelotonToolsArray.length} Peloton tools`);
        tools.push(...pelotonToolsArray);
    } catch (error) {
        console.error("Error registering Peloton tools:", error);
    }

    // Add web search tools
    try {
        const webSearchToolsArray = webSearchTools(userId);
        console.debug(`Registering ${webSearchToolsArray.length} web search tools`);
        tools.push(...webSearchToolsArray);
    } catch (error) {
        console.error("Error registering web search tools:", error);
    }

    console.debug(`Total tools registered: ${tools.length}`);
    return tools;
} 