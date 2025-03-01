import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

export class PineconeService {
    private static client: Pinecone;
    private static readonly HEALTH_INDEX = 'health-data-embeddings';

    static async initialize() {
        if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT) {
            throw new Error('Missing Pinecone configuration');
        }

        this.client = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
            environment: process.env.PINECONE_ENVIRONMENT
        });
    }

    // ... rest of the code
    static async createIndex(indexName: string, dimension: number) {
        const index = this.client.Index(indexName);
        await index.create({
            dimension,
            metric: 'cosine'
        });
    }

    static async deleteIndex(indexName: string) {
        const index = this.client.Index(indexName);
        await index.delete();
    }

    static async listIndexes() {
        const indexes = await this.client.listIndexes();
        return indexes;
    }

    static async describeIndex(indexName: string) {
        const index = this.client.Index(indexName);
        return index.describe();
    }

    static async upsert(indexName: string, vectors: any[]) {
        const index = this.client.Index(indexName);
        await index.upsert(vectors);
    }

    static async query(indexName: string, queryVector: number[], topK: number = 10) {
        const index = this.client.Index(indexName);
        return index.query({ vector: queryVector, topK });
    }

    static async delete(indexName: string, ids: string[]) {
        const index = this.client.Index(indexName);
        await index.delete(ids);
    }

    static async describeIndexStats(indexName: string) {
        const index = this.client.Index(indexName);
        return index.describeIndexStats();
    }

    static async listNamespaces(indexName: string) {
        const index = this.client.Index(indexName);
        return index.listNamespaces();
    }

    static async describeNamespace(indexName: string, namespace: string) {
        const index = this.client.Index(indexName);
        return index.describeNamespace(namespace);
    }

    static async deleteNamespace(indexName: string, namespace: string) {
        const index = this.client.Index(indexName);
        await index.deleteNamespace(namespace);
    }

    static async listAllVectors(indexName: string) {
        const index = this.client.Index(indexName);
        return index.listAllVectors();
    }

    static async describeVector(indexName: string, vectorId: string) {
        const index = this.client.Index(indexName);
        return index.describeVector(vectorId);
    }

    static async deleteVector(indexName: string, vectorId: string) {
        const index = this.client.Index(indexName);
        await index.deleteVector(vectorId);
    }

    static async listAllNamespaces(indexName: string) {
        const index = this.client.Index(indexName);
        return index.listAllNamespaces();
    }

    static async describeNamespaceStats(indexName: string, namespace: string) {
        const index = this.client.Index(indexName);
        return index.describeNamespaceStats(namespace);
    }

    static async listAllVectorsWithNamespace(indexName: string, namespace: string) {
        const index = this.client.Index(indexName);
        return index.listAllVectorsWithNamespace(namespace);
    }

    static async describeVectorWithNamespace(indexName: string, namespace: string, vectorId: string) {
        const index = this.client.Index(indexName);
        return index.describeVectorWithNamespace(namespace, vectorId);
    }

    static async deleteVectorWithNamespace(indexName: string, namespace: string, vectorId: string) {
        const index = this.client.Index(indexName);
        await index.deleteVectorWithNamespace(namespace, vectorId);
    }

    static async listAllNamespacesWithIndex(indexName: string) {
        const index = this.client.Index(indexName);
        return index.listAllNamespaces();
    }

    static async describeNamespaceWithIndex(indexName: string, namespace: string) {
        const index = this.client.Index(indexName);
        return index.describeNamespace(namespace);
    }

    static async deleteNamespaceWithIndex(indexName: string, namespace: string) {
        const index = this.client.Index(indexName);
        await index.deleteNamespace(namespace);
    }

    static async listAllVectorsWithIndex(indexName: string) {
        const index = this.client.Index(indexName);
        return index.listAllVectors();
    }

    static async describeVectorWithIndex(indexName: string, vectorId: string) {
        const index = this.client.Index(indexName);
        return index.describeVector(vectorId);
    }

    static async deleteVectorWithIndex(indexName: string, vectorId: string) {
        const index = this.client.Index(indexName);
        await index.deleteVector(vectorId);
    }

    static async listAllVectorsWithIndexAndNamespace(indexName: string, namespace: string) {
        const index = this.client.Index(indexName);
        return index.listAllVectorsWithNamespace(namespace);
    }


} 