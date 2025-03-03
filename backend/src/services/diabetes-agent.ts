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
        // Create tools for the agent
        const getDexcomDataTool = new DynamicStructuredTool({
            name: "get_blood_sugar",
            description: "Get the current blood sugar reading and recent history from Dexcom",
            schema: z.object({
                count: z.number().optional().describe("Number of readings to fetch, defaults to 48")
            }),
            func: async (input) => {
                try {
                    const count = input.count || 48;
                    const readings = await this.dexcomService.getLatestReadings(count);

                    // Store readings for pattern analysis
                    for (const reading of readings) {
                        await this.patternAnalysis.storeReading(reading, 'default');
                    }

                    // Calculate current stats
                    const currentReading = readings[0];
                    const average = readings.reduce((sum, r) => sum + r.value, 0) / readings.length;
                    const min = Math.min(...readings.map(r => r.value));
                    const max = Math.max(...readings.map(r => r.value));

                    return JSON.stringify({
                        current: currentReading,
                        readings: readings,
                        stats: {
                            average,
                            min,
                            max,
                            count: readings.length,
                            timeRange: `${new Date(readings[readings.length - 1].timestamp).toLocaleString()} to ${new Date(readings[0].timestamp).toLocaleString()}`
                        }
                    });
                } catch (error) {
                    console.error("Error fetching blood sugar data:", error);
                    return JSON.stringify({
                        error: "Failed to fetch blood sugar data",
                        message: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            },
        });

        const analyzeBloodSugarTool = new DynamicStructuredTool({
            name: "analyze_blood_sugar",
            description: "Analyze blood sugar data and provide insights",
            schema: z.object({
                data: z.string().describe("Blood sugar data to analyze"),
            }),
            func: async (input) => {
                try {
                    const analysis = await this.aiService.analyzeBloodSugar({ content: input.data });
                    return JSON.stringify(analysis);
                } catch (error) {
                    console.error("Error analyzing blood sugar data:", error);
                    return JSON.stringify({
                        error: "Failed to analyze blood sugar data",
                        message: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            },
        });

        const getPatternsTool = new DynamicStructuredTool({
            name: "get_patterns",
            description: "Get historical blood sugar patterns and trends analysis",
            schema: z.object({
                days: z.number().optional().describe("Number of days to analyze, defaults to 7"),
                sessionId: z.string().optional().describe("Session ID for the user, defaults to 'default'")
            }),
            func: async (input) => {
                try {
                    const sessionId = input.sessionId || 'default';
                    const days = input.days || 7;

                    const timeOfDay = await this.patternAnalysis.getTimeOfDayAnalysis(sessionId, days);
                    const weeklyTrends = await this.patternAnalysis.getWeeklyPatterns(sessionId);
                    const patterns = await this.patternAnalysis.identifyPatterns(sessionId);

                    return JSON.stringify({
                        timeOfDay,
                        weeklyTrends,
                        patterns,
                        analyzedDays: days
                    });
                } catch (error) {
                    console.error("Error fetching patterns:", error);
                    return JSON.stringify({
                        error: "Failed to fetch patterns",
                        message: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            },
        });

        const getDeviceInfoTool = new DynamicStructuredTool({
            name: "get_device_info",
            description: "Get information about the user's Dexcom devices",
            schema: z.object({}),
            func: async () => {
                try {
                    const devices = await this.dexcomService.getDevices();
                    return JSON.stringify(devices);
                } catch (error) {
                    console.error("Error fetching device info:", error);
                    return JSON.stringify({
                        error: "Failed to fetch device info",
                        message: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            },
        });

        const saveContextTool = new DynamicStructuredTool({
            name: "save_context",
            description: "Save important context about the user for future reference",
            schema: z.object({
                sessionId: z.string().describe("Session ID for the user"),
                key: z.string().describe("Key for the context item"),
                value: z.string().describe("Value to store"),
            }),
            func: async (input) => {
                try {
                    if (!this.sessionContexts.has(input.sessionId)) {
                        this.sessionContexts.set(input.sessionId, {});
                    }

                    const context = this.sessionContexts.get(input.sessionId);
                    context[input.key] = input.value;

                    return JSON.stringify({ success: true, message: `Saved ${input.key} to context` });
                } catch (error) {
                    console.error("Error saving context:", error);
                    return JSON.stringify({
                        error: "Failed to save context",
                        message: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            },
        });

        const getContextTool = new DynamicStructuredTool({
            name: "get_context",
            description: "Retrieve important context about the user",
            schema: z.object({
                sessionId: z.string().describe("Session ID for the user"),
                key: z.string().optional().describe("Key for the context item, if omitted returns all context"),
            }),
            func: async (input) => {
                try {
                    if (!this.sessionContexts.has(input.sessionId)) {
                        return JSON.stringify({ message: "No context found for this session" });
                    }

                    const context = this.sessionContexts.get(input.sessionId);

                    if (input.key) {
                        return JSON.stringify({
                            [input.key]: context[input.key] || "Not found"
                        });
                    }

                    return JSON.stringify(context);
                } catch (error) {
                    console.error("Error retrieving context:", error);
                    return JSON.stringify({
                        error: "Failed to retrieve context",
                        message: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            },
        });

        const tools = [
            getDexcomDataTool,
            analyzeBloodSugarTool,
            getPatternsTool,
            getDeviceInfoTool,
            saveContextTool,
            getContextTool
        ];

        // Create the agent prompt with enhanced memory context
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", `You are DiabetesAI, an advanced diabetes management assistant with memory of past interactions and pattern recognition capabilities.

            Your primary goal is to help users manage their diabetes by providing personalized insights, answering questions, and offering actionable recommendations based on their blood sugar data.

            You have access to:
            1. Real-time blood sugar data from Dexcom CGM devices
            2. Historical pattern analysis including:
               - Time of day trends (morning, afternoon, evening, night)
               - Weekly patterns (day-by-day averages and volatility)
               - Risk period identification (high and low glucose events)
               - Stable periods (when glucose is well-controlled)
            3. Previous conversations and known patient history
            4. Device information from connected Dexcom devices

            When analyzing blood sugar:
            - Start with current readings and immediate concerns
            - Compare with historical patterns
            - Consider time of day and day of week trends
            - Look for recurring patterns in high/low periods
            - Account for previous discussions and known patient behaviors
            - Provide personalized recommendations based on historical success/failure patterns
            
            Always maintain context from previous conversations and use it to:
            - Recognize recurring issues
            - Track improvement or deterioration in specific areas
            - Adjust recommendations based on what has/hasn't worked
            - Provide consistent, contextual advice

            If you detect concerning patterns or readings:
            1. Highlight them clearly
            2. Compare with historical data
            3. Suggest specific, actionable improvements
            4. Reference previous similar situations and their outcomes

            Normal blood sugar range is typically 70-180 mg/dL:
            - Below 70 mg/dL: Hypoglycemia (low blood sugar)
            - 70-180 mg/dL: Target range
            - Above 180 mg/dL: Hyperglycemia (high blood sugar)

            Dexcom trend arrows indicate rate of change:
            - ↑↑: Rising rapidly (>3 mg/dL/min)
            - ↑: Rising (2-3 mg/dL/min)
            - ↗: Rising slightly (1-2 mg/dL/min)
            - →: Stable (< 1 mg/dL/min)
            - ↘: Falling slightly (1-2 mg/dL/min)
            - ↓: Falling (2-3 mg/dL/min)
            - ↓↓: Falling rapidly (>3 mg/dL/min)

            Be empathetic, supportive, and educational in your responses. Avoid medical jargon when possible, and explain concepts clearly. Remember that while you can provide insights and suggestions, you should remind users to consult healthcare professionals for medical advice.`],
            ["human", "{input}"],
            ["ai", "I'll help you manage your diabetes with personalized insights based on your data."],
            ["human", "{chat_history}"],
            ["ai", "{agent_scratchpad}"],
        ]);

        // Create the agent
        const agent = await createOpenAIFunctionsAgent({
            llm: this.llm,
            tools,
            prompt,
        });

        this.agent = new AgentExecutor({
            agent,
            tools,
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