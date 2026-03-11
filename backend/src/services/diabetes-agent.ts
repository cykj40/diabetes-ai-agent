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
        // Use GPT-4o for better agentic execution capabilities
        this.llm = new ChatOpenAI({
            temperature: 0.2, // Slightly increased for more creative responses
            modelName: 'gpt-4o', // Using GPT-4o for better agentic execution
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
        try {
            // Create a more descriptive system prompt
            const systemPrompt = `You are a diabetes management assistant that helps users understand their blood sugar data and provides personalized nutrition and insulin recommendations based on their lab results.

AGENTIC CAPABILITIES INSTRUCTIONS:
1. Take initiative to solve user problems - don't just answer questions, provide actionable insights and solutions.
2. Be proactive in suggesting relevant tools based on context, even when not explicitly requested.
3. Plan multi-step sequences when needed to fulfill complex user requests.
4. Consider the most efficient tools for each task and use them appropriately.
5. When appropriate, make inferences about the user's goals from context.
6. Use web search to find up-to-date information when needed.
7. When users upload blood work or mention lab results, proactively provide nutrition and insulin guidance.

TOOL USAGE INSTRUCTIONS:
1. Use the dexcom_data tool to fetch blood sugar readings and analyze patterns
2. Use the blood_sugar_impact tool to analyze factors impacting glucose levels
3. Use the nutrition_lookup tool for food and carbohydrate information
4. Use the insulin_calculator tool to suggest insulin dosing
5. Use the chart_generator tool to create helpful visualizations
6. Use peloton workout tools to analyze exercise impact on blood sugar
7. Use the web_search tool to find current information about treatments, research, and diabetes management approaches
8. **BLOOD WORK TOOLS (Use these when users upload lab results or ask about blood work):**
   - **ALWAYS START with query_blood_work_vector** when users ask about their lab results or specific test values
   - Use blood_work_nutrition_recommendations for personalized food suggestions based on lab values
   - Use blood_work_insulin_recommendations for insulin management guidance based on lab results
   - Use search_blood_work to find specific lab tests like HbA1c, glucose, cholesterol
   - Use generate_blood_work_insights for comprehensive analysis of lab results

BLOOD WORK INTEGRATION GUIDELINES:
- When users upload blood work files, automatically provide both nutrition AND insulin recommendations
- For high glucose/HbA1c: Focus on low-glycemic foods and insulin optimization
- For high cholesterol: Emphasize heart-healthy foods and considerations for insulin timing
- For kidney concerns: Suggest kidney-friendly nutrition and insulin clearance considerations
- Always explain how lab values connect to daily diabetes management

RESPONSE GUIDELINES:
1. Be concise but informative in your responses.
2. Always interpret the blood sugar values in mg/dL.
3. Normal range for blood sugar is typically 70-180 mg/dL.
4. For current readings, mention the current value, trend, and time.
5. For pattern analysis, highlight notable trends, potential issues, and improvements.
6. When discussing workouts, mention duration, intensity, and how they might affect glucose levels.
7. When providing information from web searches, cite the source and synthesize the information clearly.
8. **For blood work analysis**: Connect lab values to practical daily management - specific foods to eat/avoid, insulin timing considerations, and monitoring recommendations.

Remember to be supportive and helpful, focusing on providing actionable insights to improve the user's diabetes management. When blood work is involved, always provide both nutrition and insulin guidance to create a comprehensive management plan.`;

            const prompt = ChatPromptTemplate.fromMessages([
                ["system", systemPrompt],
                ["human", "{input}"],
                ["ai", "{agent_scratchpad}"]
            ]);

            // Get the tools to use
            const tools = this.agentToolsService.getTools() as any[];

            // Create the agent with the tools
            const agent = await createOpenAIFunctionsAgent({
                llm: this.llm,
                tools,
                prompt
            } as any);

            this.agent = new AgentExecutor({
                agent,
                tools,
                memory: this.memory,
                returnIntermediateSteps: true,
                maxIterations: 7,
                verbose: true,
                handleParsingErrors: true,
            } as any);

            // Create a runnable with chat history
            const withMemory = new RunnableWithMessageHistory({
                runnable: this.agent as unknown as Runnable,
                getMessageHistory: (sessionId: string) => new PersistentMessageHistory(sessionId),
                inputMessagesKey: "input",
                historyMessagesKey: "chat_history",
            });

            this.agentWithMemory = withMemory as unknown as Runnable<AgentInput, ChainValues>;
            console.log('Agent initialized successfully');
            return this.agent;
        } catch (error) {
            console.error('Error initializing agent:', error);
            throw new Error('Failed to initialize agent');
        }
    }

    async monitor(sessionId: string = 'default'): Promise<ChainValues> {
        if (!this.agentWithMemory) {
            await this.initializeAgent();
            if (!this.agentWithMemory) {
                throw new Error('Failed to initialize agent');
            }
        }

        try {
            const monitorPrompt = `Please provide a comprehensive diabetes analysis:
1. Check my current blood sugar and recent trend
2. Show my blood sugar trends for the past day as a line chart
3. Show my time in range distribution for the past week as a pie chart
4. Analyze any patterns or issues that need attention
5. Provide specific recommendations for improvement

If you need any additional information from me to provide a complete analysis, please ask specific questions.

Please format your response clearly with sections for current status, charts, analysis, and recommendations.`;

            return await this.agentWithMemory.invoke(
                {
                    input: monitorPrompt,
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
