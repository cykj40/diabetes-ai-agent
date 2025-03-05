import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { DexcomService } from './dexcom.service';
import { AIService } from './ai.service';
import { PersistentMessageHistory } from './message-store';
import { PatternAnalysisService } from './pattern-analysis.service';
import { RunnableWithMessageHistory, Runnable } from "@langchain/core/runnables";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { BufferMemory } from "langchain/memory";

interface AgentInput {
    input: string;
    chat_history?: Array<HumanMessage | AIMessage>;
}

interface ChainValues {
    input: string;
    chat_history: Array<BaseMessage>;
    output: string;
}

export class DiabetesAgent {
    private readonly llm: ChatOpenAI;
    private readonly dexcomService: DexcomService;
    private readonly aiService: AIService;
    private readonly patternAnalysis: PatternAnalysisService;
    private agent: AgentExecutor | null = null;
    private agentWithMemory: Runnable<AgentInput, ChainValues> | null = null;
    private memory: BufferMemory;
    private sessionContexts: Map<string, any> = new Map();

    constructor() {
        // Use GPT-4 for better reasoning capabilities
        this.llm = new ChatOpenAI({
            temperature: 0.2, // Slightly increased for more creative responses
            modelName: 'gpt-4o', // Using GPT-4o for better reasoning
            openAIApiKey: process.env.OPENAI_API_KEY
        });
        this.dexcomService = new DexcomService();
        this.aiService = new AIService();
        this.patternAnalysis = new PatternAnalysisService();
        this.memory = new BufferMemory({
            returnMessages: true,
            memoryKey: "chat_history",
            inputKey: "input",
            outputKey: "output",
        });
        this.initializeAgent();
    }

    private async initializeAgent() {
        // Create a unified Dexcom tool with multiple functions
        const dexcomTool = new DynamicStructuredTool({
            name: "dexcom_api",
            description: "Interact with Dexcom API to get blood sugar data, analyze patterns, and provide insights. This tool can handle various types of queries related to blood sugar data.",
            schema: z.object({
                action: z.enum([
                    "get_current_reading",
                    "get_recent_readings",
                    "get_daily_patterns",
                    "get_weekly_patterns",
                    "analyze_time_period"
                ]).describe("The specific action to perform with the Dexcom API"),
                count: z.number().optional().describe("Number of readings to fetch, defaults to 48"),
                days: z.number().optional().describe("Number of days to analyze, defaults to 7"),
                period: z.enum(["day", "week", "month"]).optional().describe("Time period to analyze"),
                sessionId: z.string().optional().describe("Session ID for the user, defaults to 'default'")
            }),
            func: async (input) => {
                try {
                    const sessionId = input.sessionId || 'default';

                    switch (input.action) {
                        case "get_current_reading": {
                            // Get just the latest reading
                            const readings = await this.dexcomService.getLatestReadings(1);
                            if (readings.length === 0) {
                                return JSON.stringify({
                                    error: "No readings available"
                                });
                            }
                            return JSON.stringify({
                                current: readings[0],
                                timestamp: new Date(readings[0].timestamp).toLocaleString()
                            });
                        }

                        case "get_recent_readings": {
                            // Get multiple recent readings
                            const count = input.count || 48;
                            const readings = await this.dexcomService.getLatestReadings(count);

                            // Store readings for pattern analysis
                            for (const reading of readings) {
                                await this.patternAnalysis.storeReading(reading, sessionId);
                            }

                            // Calculate stats
                            const average = readings.reduce((sum, r) => sum + r.value, 0) / readings.length;
                            const min = Math.min(...readings.map(r => r.value));
                            const max = Math.max(...readings.map(r => r.value));

                            return JSON.stringify({
                                readings: readings,
                                stats: {
                                    average,
                                    min,
                                    max,
                                    count: readings.length,
                                    timeRange: `${new Date(readings[readings.length - 1].timestamp).toLocaleString()} to ${new Date(readings[0].timestamp).toLocaleString()}`
                                }
                            });
                        }

                        case "get_daily_patterns": {
                            // Get time-of-day patterns
                            const days = input.days || 7;
                            const timeOfDay = await this.patternAnalysis.getTimeOfDayAnalysis(sessionId, days);

                            return JSON.stringify({
                                timeOfDay,
                                analyzedDays: days
                            });
                        }

                        case "get_weekly_patterns": {
                            // Get day-of-week patterns
                            const weeklyTrends = await this.patternAnalysis.getWeeklyPatterns(sessionId);

                            return JSON.stringify({
                                weeklyTrends
                            });
                        }

                        case "analyze_time_period": {
                            // Comprehensive analysis for a time period
                            const days = input.days || (input.period === "day" ? 1 : input.period === "week" ? 7 : 30);

                            // Get readings
                            const readings = await this.dexcomService.getLatestReadings(days * 48); // ~48 readings per day

                            // Store readings for pattern analysis
                            for (const reading of readings) {
                                await this.patternAnalysis.storeReading(reading, sessionId);
                            }

                            // Get patterns
                            const timeOfDay = await this.patternAnalysis.getTimeOfDayAnalysis(sessionId, days);
                            const weeklyTrends = await this.patternAnalysis.getWeeklyPatterns(sessionId);
                            const patterns = await this.patternAnalysis.identifyPatterns(sessionId);

                            // Get AI analysis
                            const readingsData = JSON.stringify(readings);
                            const analysis = await this.aiService.analyzeBloodSugar({ content: readingsData });

                            return JSON.stringify({
                                readings: readings.slice(0, 10), // Just include the most recent 10 readings
                                timeOfDay,
                                weeklyTrends,
                                patterns,
                                analysis,
                                analyzedDays: days,
                                period: input.period || (days === 1 ? "day" : days === 7 ? "week" : "month")
                            });
                        }

                        default:
                            return JSON.stringify({
                                error: "Invalid action specified"
                            });
                    }
                } catch (error) {
                    console.error("Error in dexcom_api tool:", error);
                    return JSON.stringify({
                        error: "Failed to process Dexcom data",
                        message: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            },
        });

        // Create the agent with a more specific system prompt
        const systemPrompt = `You are a diabetes management assistant that helps users understand their blood sugar data.

IMPORTANT INSTRUCTIONS:
1. When the user asks about their current blood sugar, use dexcom_api with action="get_current_reading".
2. When the user asks about recent readings, use dexcom_api with action="get_recent_readings".
3. When the user asks about daily patterns (morning vs evening), use dexcom_api with action="get_daily_patterns".
4. When the user asks about weekly patterns (which days are better/worse), use dexcom_api with action="get_weekly_patterns".
5. When the user asks for comprehensive analysis over a time period, use dexcom_api with action="analyze_time_period".
6. Be concise but informative in your responses.
7. Always interpret the blood sugar values in mg/dL.
8. Normal range for blood sugar is typically 70-180 mg/dL.
9. For current readings, mention the current value, trend, and time.
10. For pattern analysis, highlight notable trends, potential issues, and improvements.

Remember to be supportive and helpful, focusing on providing actionable insights about the user's diabetes management.`;

        const prompt = ChatPromptTemplate.fromMessages([
            ["system", systemPrompt],
            ["human", "{input}"],
            ["ai", "{agent_scratchpad}"]
        ]);

        // Create the agent with the tools
        const agent = await createOpenAIFunctionsAgent({
            llm: this.llm,
            tools: [dexcomTool],
            prompt
        });

        this.agent = new AgentExecutor({
            agent,
            tools: [dexcomTool],
            memory: this.memory,
            returnIntermediateSteps: true,
            maxIterations: 5,
            verbose: true, // Enable verbose mode for debugging
        });

        this.agentWithMemory = this.agent as unknown as Runnable<AgentInput, ChainValues>;
    }

    async monitor(sessionId: string = 'default'): Promise<ChainValues> {
        if (!this.agentWithMemory) {
            await this.initializeAgent();
            if (!this.agentWithMemory) {
                throw new Error('Failed to initialize agent');
            }
        }

        try {
            return await this.agentWithMemory.invoke(
                {
                    input: "Please check my current blood sugar levels and provide an analysis with any necessary recommendations.",
                    chat_history: await this.getChatHistory(sessionId)
                },
                {
                    configurable: {
                        sessionId,
                    },
                }
            );
        } catch (error) {
            console.error("Error in monitor method:", error);
            return {
                input: "Please check my current blood sugar levels and provide an analysis with any necessary recommendations.",
                chat_history: await this.getChatHistory(sessionId),
                output: "I'm sorry, I encountered an error while analyzing your blood sugar data. Please try again later or contact support if the issue persists."
            };
        }
    }

    async ask(question: string, sessionId: string = 'default'): Promise<ChainValues> {
        if (!this.agentWithMemory) {
            await this.initializeAgent();
            if (!this.agentWithMemory) {
                throw new Error('Failed to initialize agent');
            }
        }

        try {
            console.log(`Processing question for session ${sessionId}: ${question}`);

            // Get chat history
            const chatHistory = await this.getChatHistory(sessionId);

            // Invoke the agent
            const result = await this.agentWithMemory.invoke(
                {
                    input: question,
                    chat_history: chatHistory
                },
                {
                    configurable: {
                        sessionId,
                    },
                }
            );

            // Store the interaction in history
            const history = new PersistentMessageHistory(sessionId);
            await history.addUserMessage(question);
            await history.addAIMessage(result.output);

            console.log(`Successfully processed question for session ${sessionId}`);
            return result;
        } catch (error) {
            console.error(`Error processing question for session ${sessionId}:`, error);

            // Store the error interaction in history
            const history = new PersistentMessageHistory(sessionId);
            await history.addUserMessage(question);
            await history.addAIMessage("I'm sorry, I encountered an error while processing your question. Please try again later or contact support if the issue persists.");

            return {
                input: question,
                chat_history: await this.getChatHistory(sessionId),
                output: "I'm sorry, I encountered an error while processing your question. Please try again later or contact support if the issue persists."
            };
        }
    }

    // Helper method to get chat history
    async getChatHistory(sessionId: string = 'default'): Promise<Array<HumanMessage | AIMessage>> {
        try {
            const history = new PersistentMessageHistory(sessionId);
            return await history.getMessages() as Array<HumanMessage | AIMessage>;
        } catch (error) {
            console.error(`Error retrieving chat history for session ${sessionId}:`, error);
            return [];
        }
    }

    // Helper method to clear chat history
    async clearChatHistory(sessionId: string = 'default'): Promise<void> {
        try {
            const history = new PersistentMessageHistory(sessionId);
            await history.clear();
            console.log(`Chat history cleared for session ${sessionId}`);
        } catch (error) {
            console.error(`Error clearing chat history for session ${sessionId}:`, error);
            throw new Error(`Failed to clear chat history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Helper method to summarize chat history
    async summarizeChatHistory(sessionId: string = 'default'): Promise<string> {
        try {
            const chatHistory = await this.getChatHistory(sessionId);

            if (chatHistory.length === 0) {
                return "No chat history available.";
            }

            const historyText = chatHistory.map(msg => {
                const role = msg instanceof HumanMessage ? "User" : "AI";
                return `${role}: ${msg.content}`;
            }).join("\n\n");

            const summaryPrompt = `Summarize the following conversation between a user and an AI diabetes assistant, focusing on key information about the user's diabetes management, important patterns, and any personal details that would be helpful for future interactions:\n\n${historyText}`;

            const summary = await this.llm.invoke(summaryPrompt);
            return summary.content as string;
        } catch (error) {
            console.error(`Error summarizing chat history for session ${sessionId}:`, error);
            return "Failed to summarize chat history.";
        }
    }
} 