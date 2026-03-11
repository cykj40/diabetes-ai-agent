import { neon } from '@neondatabase/serverless';
import { sql as drizzleSql } from 'drizzle-orm';
import { db } from '../db';

const sql = neon(process.env.DATABASE_URL!);

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: Record<string, any>;
  content: string;
}

export interface QueryMatch {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

export interface QueryResult {
  matches: QueryMatch[];
}

export class PgVectorService {
  /**
   * Upsert vectors into the specified table
   */
  static async upsert(
    table: 'blood_work' | 'blood_sugar',
    vectors: VectorRecord[]
  ): Promise<void> {
    const tableName =
      table === 'blood_work' ? 'BloodWorkEmbedding' : 'BloodSugarEmbedding';

    try {
      for (const vector of vectors) {
        const vectorString = `[${vector.values.join(',')}]`;
        const metadata = vector.metadata || {};

        if (table === 'blood_work') {
          // For blood work embeddings
          await sql`
            INSERT INTO "${drizzleSql.raw(tableName)}" (id, "userId", "recordId", "chunkIndex", content, metadata, embedding, "createdAt")
            VALUES (
              ${vector.id},
              ${metadata.userId || ''},
              ${metadata.recordId || ''},
              ${metadata.chunkIndex || 0},
              ${vector.content},
              ${JSON.stringify(metadata)}::jsonb,
              ${vectorString}::vector,
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              "userId" = EXCLUDED."userId",
              "recordId" = EXCLUDED."recordId",
              "chunkIndex" = EXCLUDED."chunkIndex",
              content = EXCLUDED.content,
              metadata = EXCLUDED.metadata,
              embedding = EXCLUDED.embedding
          `;
        } else {
          // For blood sugar embeddings
          await sql`
            INSERT INTO "${drizzleSql.raw(tableName)}" (id, "userId", "readingId", content, metadata, embedding, "createdAt")
            VALUES (
              ${vector.id},
              ${metadata.userId || ''},
              ${metadata.readingId || null},
              ${vector.content},
              ${JSON.stringify(metadata)}::jsonb,
              ${vectorString}::vector,
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              "userId" = EXCLUDED."userId",
              "readingId" = EXCLUDED."readingId",
              content = EXCLUDED.content,
              metadata = EXCLUDED.metadata,
              embedding = EXCLUDED.embedding
          `;
        }
      }
    } catch (error) {
      console.error(`Error upserting vectors to ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Query vectors using cosine similarity
   */
  static async query(
    table: 'blood_work' | 'blood_sugar',
    queryVector: number[],
    topK: number,
    filter?: { userId: string }
  ): Promise<QueryResult> {
    const tableName =
      table === 'blood_work' ? 'BloodWorkEmbedding' : 'BloodSugarEmbedding';
    const vectorString = `[${queryVector.join(',')}]`;

    try {
      let results;

      if (filter?.userId) {
        results = await sql`
          SELECT
            id,
            1 - (embedding <=> ${vectorString}::vector) as score,
            metadata
          FROM "${drizzleSql.raw(tableName)}"
          WHERE "userId" = ${filter.userId}
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT ${topK}
        `;
      } else {
        results = await sql`
          SELECT
            id,
            1 - (embedding <=> ${vectorString}::vector) as score,
            metadata
          FROM "${drizzleSql.raw(tableName)}"
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT ${topK}
        `;
      }

      const matches: QueryMatch[] = results.map((row: any) => ({
        id: row.id,
        score: parseFloat(row.score),
        metadata: row.metadata || {},
      }));

      return { matches };
    } catch (error) {
      console.error(`Error querying vectors from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete vectors by IDs
   */
  static async delete(
    table: 'blood_work' | 'blood_sugar',
    ids: string[]
  ): Promise<void> {
    const tableName =
      table === 'blood_work' ? 'BloodWorkEmbedding' : 'BloodSugarEmbedding';

    try {
      if (ids.length === 0) return;

      await sql`
        DELETE FROM "${drizzleSql.raw(tableName)}"
        WHERE id = ANY(${ids})
      `;
    } catch (error) {
      console.error(`Error deleting vectors from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Initialize pgvector extension (should be called once)
   */
  static async initialize(): Promise<void> {
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;
      console.log('pgvector extension enabled');
    } catch (error) {
      console.error('Error initializing pgvector:', error);
      throw error;
    }
  }
}

export default PgVectorService;
