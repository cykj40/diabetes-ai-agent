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
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
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

    constructor() {
        this.llm = new ChatOpenAI({
            temperature: 0,
            modelName: 'gpt-3.5-turbo',
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
            schema: z.object({}),
            func: async () => {
                const readings = await this.dexcomService.getLatestReadings();
                // Store readings for pattern analysis
                for (const reading of readings) {
                    await this.patternAnalysis.storeReading(reading, 'default');
                }
                return JSON.stringify(readings);
            },
        });

        const analyzeBloodSugarTool = new DynamicStructuredTool({
            name: "analyze_blood_sugar",
            description: "Analyze blood sugar data and provide insights",
            schema: z.object({
                data: z.string().describe("Blood sugar data to analyze"),
            }),
            func: async (input) => {
                const analysis = await this.aiService.analyzeBloodSugar({ content: input.data });
                return JSON.stringify(analysis);
            },
        });

        const getPatternsTool = new DynamicStructuredTool({
            name: "get_patterns",
            description: "Get historical blood sugar patterns and trends analysis",
            schema: z.object({
                days: z.number().optional().describe("Number of days to analyze, defaults to 7"),
            }),
            func: async (input) => {
                const timeOfDay = await this.patternAnalysis.getTimeOfDayAnalysis('default', input.days);
                const weeklyTrends = await this.patternAnalysis.getWeeklyPatterns('default');
                const patterns = await this.patternAnalysis.identifyPatterns('default');
                return JSON.stringify({
                    timeOfDay,
                    weeklyTrends,
                    patterns,
                });
            },
        });

        const tools = [getDexcomDataTool, analyzeBloodSugarTool, getPatternsTool];

        // Create the agent prompt with enhanced memory context
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", `You are an advanced diabetes management assistant with memory of past interactions and pattern recognition capabilities. 
            You have access to:
            1. Real-time blood sugar data from Dexcom
            2. Historical pattern analysis including:
               - Time of day trends
               - Weekly patterns
               - Volatility analysis
               - Risk period identification
            3. Previous conversations and known patient history

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
            4. Reference previous similar situations and their outcomes`],
            ["human", "{input}"],
            ["ai", "I'll analyze your diabetes data and provide personalized insights."],
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
        });

        this.agentWithMemory = this.agent as unknown as Runnable<AgentInput, ChainValues>;
    }

    async monitor(sessionId: string = 'default'): Promise<ChainValues> {
        if (!this.agentWithMemory) {
            throw new Error('Agent not initialized');
        }
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
    }

    async ask(question: string, sessionId: string = 'default'): Promise<ChainValues> {
        if (!this.agentWithMemory) {
            throw new Error('Agent not initialized');
        }
        return await this.agentWithMemory.invoke(
            {
                input: question,
                chat_history: await this.getChatHistory(sessionId)
            },
            {
                configurable: {
                    sessionId,
                },
            }
        );
    }

    // Helper method to get chat history
    async getChatHistory(sessionId: string = 'default'): Promise<Array<HumanMessage | AIMessage>> {
        const history = new PersistentMessageHistory(sessionId);
        return await history.getMessages() as Array<HumanMessage | AIMessage>;
    }

    // Helper method to clear chat history
    async clearChatHistory(sessionId: string = 'default'): Promise<void> {
        const history = new PersistentMessageHistory(sessionId);
        await history.clear();
    }
} 