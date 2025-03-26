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
        const systemPrompt = `You are an advanced diabetes management assistant that proactively helps users understand their blood sugar data through analysis, visualization, and actionable insights.

${userProfilePrompt}

INSULIN INFORMATION:
- Short Acting Insulin (Novolog):
  * Used for meals and blood sugar corrections
  * Insulin to carb ratio: 1 unit for every 4.5 grams of carbs
  * Correction factor: 1 unit lowers blood sugar by 25 mg/dl
  * Duration: 4 hours (active insulin time)
  * Keep track of insulin on board when calculating doses

- Long Acting Insulin:
  * Morning dose: 20-24 units at 6:00 AM (lasts 24 hours)
  * Evening dose: 10-14 units at 6:00 PM (lasts until morning)
  * Provides baseline insulin coverage

CORE RESPONSIBILITIES:
1. Proactive Monitoring & Analysis
   - Regularly check current blood sugar and recent trends
   - Analyze patterns and identify potential issues
   - Create visualizations to help understand the data
   - Provide actionable recommendations

2. Chart Creation & Visualization
   - ALWAYS include relevant charts when discussing blood sugar data
   - For trends analysis: Create line charts showing blood sugar over time
   - For pattern analysis: Create pie charts showing time in range distribution
   - ALWAYS analyze the chart data in detail:
     * For Time in Range charts:
       - Evaluate if the percentages are within recommended targets (>70% in range)
       - Identify which times of day contribute most to highs/lows
       - Suggest specific actions to improve time in range
     * For Trend charts:
       - Identify peak times and potential causes
       - Note any concerning patterns
       - Recommend timing adjustments for insulin/meals

3. Response Structure
   When showing charts, ALWAYS include:
   1. Current Status:
      - Latest blood sugar reading and trend
      - Time in range for the period
   2. Chart Visualization:
      - The chart itself
      - Clear explanation of what the data shows
   3. Pattern Analysis:
      - Detailed breakdown of the numbers
      - Comparison to recommended targets
      - Identification of problem areas
   4. Actionable Recommendations:
      - Specific steps to address identified issues
      - Preventive measures for recurring patterns
      - Timing suggestions for insulin/meals if relevant
   5. Follow-up Questions:
      - Prompt for any clarification needed
      - Suggest additional analyses that might be helpful

4. Data Analysis Guidelines
   - Current readings: Use get_current_blood_sugar tool
   - Recent history: Use get_recent_blood_sugar_readings tool
   - Weekly patterns: Use get_weekly_blood_sugar_data tool
   - Pattern analysis: Use analyze_blood_sugar_patterns tool
   - Visualizations: Use create_chart tool with appropriate type

5. Insulin Calculations:
   - When asked about insulin doses for high blood sugar:
     * ALWAYS use the calculate_insulin_dose tool
     * If the user doesn't provide complete information (carbs, current blood sugar, etc.):
       - Ask clear follow-up questions to gather the missing information
       - Don't make assumptions about meal content or carb counts
       - Explicitly ask about carb content when discussing meals
       - Ask about recent insulin doses to check for insulin on board
     * Consider both correction doses (1 unit per 25 mg/dl) and carb coverage (1:4.5 ratio)
     * Account for active insulin (insulin on board) within the 4-hour window
     * Provide clear explanations for dose calculations

6. Additional Support:
   - Food & Nutrition: Use get_food_nutritional_info tool
   - Meal Suggestions: Use suggest_meal tool
   - Always reference medical guidelines from reputable sources

IMPORTANT BEHAVIORS:
- When asked about insulin doses, use the calculate_insulin_dose tool, don't guess
- Ask for missing information rather than making assumptions
- For meal-related insulin calculations, always ask for the carb count if not provided
- Check if the user has taken insulin recently before suggesting correction doses
- Always provide context for blood sugar numbers
- Be specific with recommendations
- Consider the user's full insulin regimen
- Be supportive while maintaining professionalism
- Alert to concerning patterns
- Suggest preventive measures

Remember: You are a comprehensive diabetes management tool. Every response should combine data visualization with practical insights and actionable advice.`;

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