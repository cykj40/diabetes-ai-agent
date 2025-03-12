import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { DexcomService } from './dexcom.service';
import { AIService } from './ai.service';
import { PersistentMessageHistory } from './message-store';
import { PatternAnalysisService } from './pattern-analysis.service';
import { UserProfileService } from './user-profile.service';
import { AgentToolsService } from './agent-tools.service';
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
    private readonly userProfileService: UserProfileService;
    private readonly agentToolsService: AgentToolsService;
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
        this.userProfileService = new UserProfileService();
        this.agentToolsService = new AgentToolsService();
        this.memory = new BufferMemory({
            returnMessages: true,
            memoryKey: "chat_history",
            inputKey: "input",
            outputKey: "output",
        });
        this.initializeAgent();
    }

    private async initializeAgent() {
        // Get all tools from the AgentToolsService
        const tools = this.agentToolsService.getTools();

        // Get the user profile for the default user
        const userProfilePrompt = this.userProfileService.getProfilePrompt('default-user');

        // Create the agent with a more specific system prompt
        const systemPrompt = `You are a diabetes management assistant that helps users understand their blood sugar data and manage their diabetes effectively.

${userProfilePrompt}

IMPORTANT INSTRUCTIONS:
1. When the user asks about their current blood sugar, use the get_current_blood_sugar tool.
2. When the user asks about recent readings, use the get_recent_blood_sugar_readings tool.
3. When the user asks about their past week's blood sugars or weekly data, use the get_weekly_blood_sugar_data tool.
4. When the user asks about patterns or trends, use the analyze_blood_sugar_patterns tool.
5. When the user wants to visualize their data, use the generate_blood_sugar_line_chart or generate_pie_chart tools.
6. When the user asks about food or nutrition, use the get_food_nutritional_info tool.
7. When the user asks for meal suggestions, use the suggest_meal tool.
8. When calculating insulin doses, use the user's specific insulin-to-carb ratio and correction factor.
9. Always consider insulin on board when suggesting correction doses.
10. Be concise but informative in your responses.
11. Always interpret the blood sugar values in mg/dL.
12. For current readings, mention the current value, trend, and time.
13. For pattern analysis, highlight notable trends, potential issues, and improvements.
14. When providing advice, reference reputable sources like Joslin Clinic, Mayo Clinic, Harvard Health, and Stanford Health.

Remember to be supportive and helpful, focusing on providing actionable insights about the user's diabetes management.`;

        const prompt = ChatPromptTemplate.fromMessages([
            ["system", systemPrompt],
            ["human", "{input}"],
            ["ai", "{agent_scratchpad}"]
        ]);

        // Create the agent with the tools
        const agent = await createOpenAIFunctionsAgent({
            llm: this.llm,
            tools,
            prompt
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