import { v4 as uuidv4 } from 'uuid';
import { ChatOpenAI } from '@langchain/openai';
import axios from 'axios';

export type Message = {
    id?: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp?: string;
};

export class AgentService {
    private _model: ChatOpenAI;
    private _messageStore: Map<string, Message[]> = new Map();

    constructor() {
        this._model = new ChatOpenAI({
            modelName: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
            temperature: 0,
        });
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

    async ask(
        question: string,
        userId: string,
        sessionId?: string,
        useWebSearch: boolean = false
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

            // If web search is requested, perform search first
            if (useWebSearch) {
                try {
                    const searchResults = await this.performWebSearch(question);

                    // Augment the prompt with search results
                    const augmentedPrompt = `
The user asked: "${question}"

Here are some search results from the web that might be relevant:
${searchResults}

Based on these search results and your knowledge, please provide a helpful response.`;

                    const response = await this._model.invoke(augmentedPrompt);
                    responseText = response.content.toString();

                } catch (searchError) {
                    console.error('Web search error:', searchError);
                    // Fall back to regular response if search fails
                    const response = await this._model.invoke(question);
                    responseText = response.content.toString();
                }
            } else {
                // Regular response without web search
                const response = await this._model.invoke(question);
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