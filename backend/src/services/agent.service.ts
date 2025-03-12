import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AgentToolsService } from './agent-tools.service';
import { PersistentMessageHistory } from './message-store';
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

export class DiabetesAgentService {
    private readonly llm: ChatOpenAI;
    private readonly toolsService: AgentToolsService;
    private agent: AgentExecutor | null = null;
    private agentWithMemory: Runnable<AgentInput, ChainValues> | null = null;
    private memory: BufferMemory;

    constructor() {
        // Use GPT-4o for better reasoning capabilities
        this.llm = new ChatOpenAI({
            temperature: 0.2, // Slightly increased for more creative responses
            modelName: 'gpt-4o', // Using GPT-4o for better reasoning
            openAIApiKey: process.env.OPENAI_API_KEY
        });
        this.toolsService = new AgentToolsService();
        this.memory = new BufferMemory({
            returnMessages: true,
            memoryKey: "chat_history",
            inputKey: "input",
            outputKey: "output",
        });
    }

    async initializeAgent(userId: string = 'default-user') {
        // Create the agent with a more specific system prompt
        const systemPrompt = `You are a diabetes management assistant that helps users understand their blood sugar data.

IMPORTANT INSTRUCTIONS:
1. When the user asks about their current blood sugar, use the dexcom_data tool with action="current_reading".
2. When the user asks about recent readings, use the dexcom_data tool with action="recent_readings".
3. When the user asks about daily patterns (morning vs evening), use the dexcom_data tool with action="daily_patterns".
4. When the user asks about weekly patterns (which days are better/worse), use the dexcom_data tool with action="weekly_patterns".
5. When the user asks for comprehensive analysis over a time period, use the dexcom_data tool with action="time_period_analysis".
6. When the user asks for charts or visualizations, use the generate_chart tool with the appropriate chart type.
7. Be concise but informative in your responses.
8. Always interpret the blood sugar values in mg/dL.
9. Normal range for blood sugar is typically 70-180 mg/dL.
10. For current readings, mention the current value, trend, and time.
11. For pattern analysis, highlight notable trends, potential issues, and improvements.

Remember to be supportive and helpful, focusing on providing actionable insights about the user's diabetes management.`;

        const prompt = ChatPromptTemplate.fromMessages([
            ["system", systemPrompt],
            ["human", "{input}"],
            ["ai", "{agent_scratchpad}"]
        ]);

        // Get tools for this user
        const tools = this.toolsService.getTools(userId);

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
        return this.agent;
    }

    async ask(question: string, userId: string = 'default-user', sessionId: string = 'default'): Promise<ChainValues> {
        if (!this.agentWithMemory) {
            await this.initializeAgent(userId);
            if (!this.agentWithMemory) {
                throw new Error('Failed to initialize agent');
            }
        }

        try {
            console.log(`Processing question for user ${userId}, session ${sessionId}: ${question}`);

            // Get chat history
            const fullSessionId = `${userId}-${sessionId}`;
            const chatHistory = await this.getChatHistory(fullSessionId);

            // Invoke the agent
            const result = await this.agentWithMemory.invoke(
                {
                    input: question,
                    chat_history: chatHistory
                },
                {
                    configurable: {
                        sessionId: fullSessionId,
                    },
                }
            );

            // Store the interaction in history
            const history = new PersistentMessageHistory(fullSessionId);
            await history.addUserMessage(question);
            await history.addAIMessage(result.output);

            console.log(`Successfully processed question for session ${fullSessionId}`);
            return result;
        } catch (error) {
            console.error(`Error processing question for session ${userId}-${sessionId}:`, error);

            // Store the error interaction in history
            const fullSessionId = `${userId}-${sessionId}`;
            const history = new PersistentMessageHistory(fullSessionId);
            await history.addUserMessage(question);
            await history.addAIMessage("I'm sorry, I encountered an error while processing your question. Please try again later or contact support if the issue persists.");

            return {
                input: question,
                chat_history: await this.getChatHistory(fullSessionId),
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
} 