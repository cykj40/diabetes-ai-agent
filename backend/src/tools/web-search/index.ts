import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import axios from 'axios';

interface SearchResult {
    title: string;
    link: string;
    snippet: string;
}

/**
 * Creates a tool for searching the web for real-time information
 * @param userId User ID for tracking search history
 * @returns A tool that can be used by the agent to search the web
 */
export function webSearchTool(userId: string = 'default-user'): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "web_search",
        description: "Search the web for current information about any topic. Use this tool when you need to find up-to-date information that you might not know about, like current events, new medical research, or recent developments.",
        schema: z.object({
            query: z.string().describe("The search query to look up on the web"),
            num_results: z.number().optional().describe("Number of search results to return, defaults to 4"),
        }) as any, // Type assertion to fix compatibility issue
        func: async ({ query, num_results = 4 }) => {
            try {
                console.log(`Performing web search for user ${userId}: "${query}"`);

                // Use a search API (replace with actual API key and endpoint)
                // This example uses a hypothetical search API - you'll need to replace with a real one
                const searchUrl = `https://serpapi.com/search?engine=google&q=${encodeURIComponent(query)}&api_key=${process.env.SERP_API_KEY}&num=${num_results}`;

                // Fallback to a simpler API if SERP API is not configured
                const fallbackUrl = `https://ddg-api.herokuapp.com/search?query=${encodeURIComponent(query)}&limit=${num_results}`;

                let response;
                try {
                    // Try primary search API first
                    if (process.env.SERP_API_KEY) {
                        response = await axios.get(searchUrl);
                    } else {
                        throw new Error("No SERP API key configured");
                    }
                } catch (error) {
                    // Fall back to alternative API
                    console.log("Falling back to alternative search API");
                    response = await axios.get(fallbackUrl);
                }

                let results: SearchResult[] = [];

                // Process the results based on the API response format
                if (response.data.organic_results) {
                    // SERP API format
                    results = response.data.organic_results.map((result: any) => ({
                        title: result.title,
                        link: result.link,
                        snippet: result.snippet
                    }));
                } else if (Array.isArray(response.data)) {
                    // Alternative API format
                    results = response.data.map((result: any) => ({
                        title: result.title,
                        link: result.url || result.link,
                        snippet: result.body || result.snippet
                    }));
                }

                if (results.length === 0) {
                    return "No search results found for your query.";
                }

                // Format the results as a clear, readable response
                let formattedResponse = `Here are the search results for "${query}":\n\n`;

                results.forEach((result: SearchResult, index: number) => {
                    formattedResponse += `${index + 1}. ${result.title}\n`;
                    formattedResponse += `   Link: ${result.link}\n`;
                    formattedResponse += `   ${result.snippet}\n\n`;
                });

                formattedResponse += "Based on these search results, I can now provide you with up-to-date information on this topic.";

                return formattedResponse;
            } catch (error) {
                console.error("Error performing web search:", error);
                return "I wasn't able to perform a web search at this time. Let me try to answer based on my existing knowledge, but please note that I might not have the most current information.";
            }
        },
    });
}

/**
 * Exports all web search tools for the agent
 * @param userId User ID for personalizing the tools
 * @returns Array of web search tools
 */
export function webSearchTools(userId: string = 'default-user'): DynamicStructuredTool[] {
    return [
        webSearchTool(userId)
    ];
} 