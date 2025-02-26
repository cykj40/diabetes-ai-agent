import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import {
    StructuredOutputParser,
} from '@langchain/core/output_parsers';
import { Document } from 'langchain/document';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseMessage } from '@langchain/core/messages';

export class AIService {
    private readonly openaiApiKey: string;
    private readonly model: ChatOpenAI;
    private readonly embeddings: OpenAIEmbeddings;

    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY || '';
        if (!this.openaiApiKey) {
            throw new Error('OPENAI_API_KEY is required');
        }
        this.model = new ChatOpenAI({
            temperature: 0,
            modelName: 'gpt-3.5-turbo',
            openAIApiKey: this.openaiApiKey
        });
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: this.openaiApiKey
        });
    }

    // Schema for Blood Sugar Analysis
    private parser = StructuredOutputParser.fromZodSchema(
        z.object({
            glucoseTrend: z
                .string()
                .describe('The overall trend of blood glucose levels (e.g., rising, falling, stable).'),
            anomalyDetected: z
                .boolean()
                .describe('Whether an anomaly is detected in the blood sugar data.'),
            anomalyDescription: z
                .string()
                .optional()
                .describe('Description of the anomaly if detected.'),
            recommendations: z
                .string()
                .describe('Actionable recommendations based on the blood sugar data.'),
            summary: z
                .string()
                .describe('Quick summary of the blood sugar patterns.'),
            riskLevel: z
                .number()
                .describe(
                    'Risk level on a scale from 0 to 10, where 0 is no risk and 10 is extremely high risk.'
                ),
        })
    );

    // Prompt for Blood Sugar Analysis
    private async getPrompt(content: string): Promise<BaseMessage[]> {
        const format_instructions = this.parser.getFormatInstructions();

        return [
            new SystemMessage('You are a diabetes management AI assistant. Analyze blood sugar data and provide structured insights.'),
            new HumanMessage(`Analyze the following blood sugar data. Follow the instructions and format your response to match the format instructions, no matter what!

Format Instructions:
${format_instructions}

Data:
${content}`)
        ];
    }

    // Main Function to Analyze Blood Sugar Data
    async analyzeBloodSugar(data: { content: string }) {
        const messages = await this.getPrompt(data.content);
        const response = await this.model.invoke(messages);
        const output = response.content.toString();

        try {
            return this.parser.parse(output);
        } catch (e) {
            // Create a new chain to fix parsing errors
            const fixingChain = RunnableSequence.from([
                async (input: string) => {
                    const result = await this.model.invoke([
                        new SystemMessage('You are a helpful assistant that formats responses according to the specified schema.'),
                        new HumanMessage(`Please format the following response according to the schema: ${this.parser.getFormatInstructions()}\n\nResponse to format: ${input}`)
                    ]);
                    return result.content.toString();
                },
                this.parser
            ]);
            return await fixingChain.invoke(output);
        }
    }

    // QA Function for Blood Sugar Insights
    async qa(question: string, entries: Array<{ id: string; content: string; createdAt: Date }>) {
        const docs = entries.map(
            (entry) =>
                new Document({
                    pageContent: entry.content,
                    metadata: { source: entry.id, date: entry.createdAt },
                })
        );

        const store = await MemoryVectorStore.fromDocuments(docs, this.embeddings);
        const relevantDocs = await store.similaritySearch(question);

        const response = await this.model.invoke([
            new SystemMessage('You are a helpful assistant that answers questions about blood sugar data based on the provided context.'),
            new HumanMessage(`Answer the following question based on the provided context. If you cannot answer the question based on the context, say "I cannot answer this question based on the available information."

Context:
${relevantDocs.map(doc => doc.pageContent).join('\n\n')}

Question: ${question}`)
        ]);

        return response.content.toString();
    }
} 