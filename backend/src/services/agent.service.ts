import { v4 as uuidv4 } from 'uuid';
import { ChatOpenAI } from '@langchain/openai';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { BloodSugarEmbeddingService } from './blood-sugar-embedding.service';
import { DexcomService } from './dexcom.service';

const prisma = new PrismaClient();

export type Message = {
    id?: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp?: string;
};

export class AgentService {
    private _model: ChatOpenAI;
    private _messageStore: Map<string, Message[]> = new Map();
    private bloodSugarService: BloodSugarEmbeddingService;
    private dexcomService: DexcomService;

    constructor() {
        this._model = new ChatOpenAI({
            modelName: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
            temperature: 0.1, // Slightly higher for more natural conversation while keeping medical accuracy
        });

        this.bloodSugarService = new BloodSugarEmbeddingService();
        this.dexcomService = new DexcomService();
    }

    private async getMessages(userId: string, sessionId: string): Promise<Message[]> {
        const fullSessionId = `${userId}-${sessionId}`;
        return this._messageStore.get(fullSessionId) || [];
    }

    private async addMessage(userId: string, sessionId: string, message: Message): Promise<void> {
        const fullSessionId = `${userId}-${sessionId}`;
        const messages = this._messageStore.get(fullSessionId) || [];
        messages.push(message);
        this._messageStore.set(fullSessionId, messages);
    }

    private async getUserDiabetesContext(userId: string): Promise<string> {
        try {
            console.log(`Fetching diabetes context for user: ${userId}`);

            // Get recent blood sugar insights - with timeout and error handling
            const insights = await Promise.race([
                this.bloodSugarService.generateBloodSugarInsights(userId, 'week'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            ]) as any;

            // Get recent readings - with timeout
            const recentReadings = await Promise.race([
                this.bloodSugarService.querySimilarReadings('recent blood sugar readings', userId, 5),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]) as any;

            let context = '';

            if (insights && insights.summary && insights.summary !== "No blood sugar data available for the selected timeframe.") {
                context += `\n[Your Recent Diabetes Data]\n`;
                context += `Weekly Summary: ${insights.summary}\n`;

                if (insights.patterns && insights.patterns.length > 0) {
                    context += `Key Patterns: ${insights.patterns.map((p: any) => p.description).join(', ')}\n`;
                }
            }

            if (recentReadings && recentReadings.length > 0) {
                const lastReading = recentReadings[0];
                if (lastReading.metadata) {
                    context += `Latest Blood Sugar: ${lastReading.metadata.value} mg/dL (${lastReading.metadata.trend})\n`;
                }
            }

            return context || '';

        } catch (error) {
            console.log('No diabetes data available or service unavailable');
            return '';
        }
    }

    async ask(
        question: string,
        userId: string,
        sessionId?: string,
        useWebSearch: boolean = false,
        attachments?: any[]
    ): Promise<{ message: string; sessionId: string; chatHistory: Message[] }> {
        try {
            // Initialize or retrieve session
            const currentSessionId = sessionId || uuidv4();
            console.log(`Processing question for user ${userId} in session ${currentSessionId}`);

            // Get chat history for this session
            const chatHistory = await this.getMessages(userId, currentSessionId);

            // Add user message to history
            const userMessageId = uuidv4();
            const userMessage: Message = {
                id: userMessageId,
                text: question,
                sender: 'user',
                timestamp: new Date().toISOString(),
            };

            await this.addMessage(userId, currentSessionId, userMessage);

            let responseText = '';

            // Prepare the context with file information
            let contextualPrompt = question;
            let hasFiles = false;

            // Check for uploaded files in the current session
            let sessionFiles: any[] = [];
            try {
                sessionFiles = await prisma.uploadedFile.findMany({
                    where: {
                        userId: userId,
                        sessionId: currentSessionId
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10 // Limit to recent files
                });
            } catch (error) {
                console.error('Error fetching session files:', error);
            }

            // Combine uploaded attachments with existing session files
            const allFiles = [...sessionFiles];
            if (attachments && attachments.length > 0) {
                allFiles.push(...attachments.map(att => att.fileInfo || att));
            }

            hasFiles = allFiles.length > 0;

            if (hasFiles) {
                const fileContext = allFiles.map(file => {
                    // Handle both database file objects and attachment objects
                    const fileName = file.fileName || file.name || file.originalName;
                    const fileType = file.fileType || file.type;
                    const fileSize = file.fileSize || file.size;
                    const content = file.content || '';

                    return `
File: ${fileName} (${fileType?.toUpperCase()})
Size: ${fileSize ? (fileSize / 1024).toFixed(1) + ' KB' : 'Unknown'}
Content preview: ${content.substring(0, 5000)}
`;
                }).join('\n');

                contextualPrompt = `${question}

I have access to the following uploaded file(s) from this session:
${fileContext}

Please analyze this data and provide insights. If this appears to be medical data such as lab results or blood work, please:
1. Identify key values and their normal ranges
2. Point out any abnormal values with potential significance
3. Provide general health insights (noting this is not medical advice)
4. Look for patterns, trends, or correlations
5. Suggest areas that might warrant discussion with healthcare providers
6. If blood sugar/glucose related, provide diabetes management insights

Please be thorough and specific in your analysis, referencing the actual values from the uploaded data.`;
            } else {
                // For general questions without files, include user diabetes context when available
                const diabetesContext = await this.getUserDiabetesContext(userId);

                contextualPrompt = `You are an AI assistant for a diabetes management system. While you specialize in diabetes and health, you can help with any topic or question.

${diabetesContext}

You can answer questions about weather, current events, general knowledge, and anything else naturally. When diabetes-related topics come up, reference the user's data above if relevant.

Always provide accurate, helpful responses. For medical advice, note that you're not a replacement for professional medical care.

User question: ${question}`;
            }

            // Auto-enable web search for general knowledge questions when no files are present
            let shouldUseWebSearch = useWebSearch;
            if (!hasFiles && !useWebSearch) {
                // Check if this seems like a question that would benefit from web search
                const webSearchKeywords = ['weather', 'current', 'today', 'now', 'latest', 'recent', 'news', 'price', 'stock', 'when', 'where', 'what time', 'temperature'];
                const questionLower = question.toLowerCase();
                const needsWebSearch = webSearchKeywords.some(keyword => questionLower.includes(keyword));

                if (needsWebSearch) {
                    shouldUseWebSearch = true;
                    console.log('Auto-enabling web search for general knowledge question');
                }
            }

            // If web search is requested or auto-enabled, perform search first
            if (shouldUseWebSearch) {
                try {
                    const searchResults = await this.performWebSearch(question);

                    // Augment the prompt with search results
                    const augmentedPrompt = `${contextualPrompt}

Here are some current search results from the web that might be relevant:
${searchResults}

Based on these search results and your knowledge, please provide a helpful response.`;

                    const response = await this._model.invoke(augmentedPrompt);
                    responseText = response.content.toString();

                } catch (searchError) {
                    console.error('Web search error:', searchError);
                    // Fall back to regular response if search fails
                    const response = await this._model.invoke(contextualPrompt);
                    responseText = response.content.toString();
                }
            } else {
                // Regular response without web search
                const response = await this._model.invoke(contextualPrompt);
                responseText = response.content.toString();
            }

            // Save AI response to message store
            const aiMessageId = uuidv4();
            const aiMessage: Message = {
                id: aiMessageId,
                text: responseText,
                sender: 'ai',
                timestamp: new Date().toISOString(),
            };

            await this.addMessage(userId, currentSessionId, aiMessage);

            // Get updated chat history
            const updatedChatHistory = await this.getMessages(userId, currentSessionId);

            return {
                message: responseText,
                sessionId: currentSessionId,
                chatHistory: updatedChatHistory,
            };
        } catch (error: any) {
            console.error('Error in agent service:', error);
            throw new Error(`Failed to process your question: ${error.message}`);
        }
    }

    /**
     * Performs a web search and returns formatted results
     */
    private async performWebSearch(query: string): Promise<string> {
        try {
            // Use the search API (fallbacks included)
            const searchUrl = `https://serpapi.com/search?engine=google&q=${encodeURIComponent(query)}&api_key=${process.env.SERP_API_KEY}&num=3`;
            const fallbackUrl = `https://ddg-api.herokuapp.com/search?query=${encodeURIComponent(query)}&limit=3`;

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

            let results = [];

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
                return "No search results found.";
            }

            // Format the results as a clear, readable text
            let formattedResponse = "";

            results.forEach((result: any, index: number) => {
                formattedResponse += `[${index + 1}] "${result.title}"\n`;
                formattedResponse += `URL: ${result.link}\n`;
                formattedResponse += `${result.snippet}\n\n`;
            });

            return formattedResponse;
        } catch (error) {
            console.error("Error performing web search:", error);
            throw new Error("Failed to perform web search");
        }
    }
} 