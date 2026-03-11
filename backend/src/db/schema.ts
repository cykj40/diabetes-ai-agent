import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  boolean,
  doublePrecision,
  jsonb,
  integer,
  customType,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom vector type for pgvector
const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      return value.slice(1, -1).split(',').map(Number);
    },
  })(name);

// User table
export const user = pgTable('User', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Session table
export const session = pgTable(
  'Session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expiresAt').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('Session_userId_idx').on(table.userId),
  })
);

// ChatSession table
export const chatSession = pgTable(
  'ChatSession',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').notNull(),
    title: varchar('title', { length: 255 }).default('New Conversation'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('ChatSession_userId_idx').on(table.userId),
    updatedAtIdx: index('ChatSession_updatedAt_idx').on(table.updatedAt),
  })
);

// ChatMessage table
export const chatMessage = pgTable(
  'ChatMessage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('sessionId').notNull().references(() => chatSession.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(), // 'human' or 'ai'
    content: text('content').notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index('ChatMessage_sessionId_idx').on(table.sessionId),
  })
);

// BloodSugarReading table
export const bloodSugarReading = pgTable(
  'BloodSugarReading',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('sessionId').notNull(),
    userId: uuid('userId').notNull(),
    value: doublePrecision('value').notNull(),
    trend: varchar('trend', { length: 50 }).notNull(),
    timestamp: timestamp('timestamp').notNull(),
    analyzed: boolean('analyzed').notNull().default(false),
    isEmbedded: boolean('isEmbedded').notNull().default(false),
    analysis: jsonb('analysis'),
  },
  (table) => ({
    userTimestampUnique: uniqueIndex('BloodSugarReading_userId_timestamp_key').on(table.userId, table.timestamp),
    sessionIdIdx: index('BloodSugarReading_sessionId_idx').on(table.sessionId),
    timestampIdx: index('BloodSugarReading_timestamp_idx').on(table.timestamp),
    userIdIdx: index('BloodSugarReading_userId_idx').on(table.userId),
  })
);

// DexcomToken table
export const dexcomToken = pgTable(
  'DexcomToken',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').notNull().unique(),
    accessToken: text('accessToken').notNull(),
    refreshToken: text('refreshToken').notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('DexcomToken_userId_idx').on(table.userId),
  })
);

// PelotonIntegration table
export const pelotonIntegration = pgTable(
  'PelotonIntegration',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').notNull().unique(),
    username: varchar('username', { length: 255 }),
    password: varchar('password', { length: 255 }),
    sessionCookie: text('sessionCookie'),
    isActive: boolean('isActive').notNull().default(false),
    lastUpdated: timestamp('lastUpdated').notNull().defaultNow(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('PelotonIntegration_userId_idx').on(table.userId),
  })
);

// BloodWorkRecord table
export const bloodWorkRecord = pgTable(
  'BloodWorkRecord',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    date: timestamp('date').notNull(),
    fileName: varchar('fileName', { length: 255 }),
    fileType: varchar('fileType', { length: 50 }),
    interpretation: text('interpretation'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('BloodWorkRecord_userId_idx').on(table.userId),
    dateIdx: index('BloodWorkRecord_date_idx').on(table.date),
    createdAtIdx: index('BloodWorkRecord_createdAt_idx').on(table.createdAt),
  })
);

// BloodWorkValue table
export const bloodWorkValue = pgTable(
  'BloodWorkValue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordId: uuid('recordId').notNull().references(() => bloodWorkRecord.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    value: varchar('value', { length: 255 }).notNull(),
    numericValue: doublePrecision('numericValue'),
    unit: varchar('unit', { length: 50 }).notNull(),
    normalRange: varchar('normalRange', { length: 255 }),
    isAbnormal: boolean('isAbnormal'),
    category: varchar('category', { length: 100 }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    recordIdIdx: index('BloodWorkValue_recordId_idx').on(table.recordId),
    nameIdx: index('BloodWorkValue_name_idx').on(table.name),
    isAbnormalIdx: index('BloodWorkValue_isAbnormal_idx').on(table.isAbnormal),
    categoryIdx: index('BloodWorkValue_category_idx').on(table.category),
    numericValueIdx: index('BloodWorkValue_numericValue_idx').on(table.numericValue),
  })
);

// UploadedFile table
export const uploadedFile = pgTable(
  'UploadedFile',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').notNull(),
    sessionId: uuid('sessionId').notNull(),
    fileName: varchar('fileName', { length: 255 }).notNull(),
    uniqueName: varchar('uniqueName', { length: 255 }).notNull(),
    fileType: varchar('fileType', { length: 50 }).notNull(),
    filePath: varchar('filePath', { length: 500 }).notNull(),
    fileSize: integer('fileSize').notNull(),
    mimeType: varchar('mimeType', { length: 100 }),
    content: text('content'),
    analysis: text('analysis'),
    tags: varchar('tags', { length: 100 }).array(),
    description: text('description'),
    isProcessed: boolean('isProcessed').notNull().default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('UploadedFile_userId_idx').on(table.userId),
    sessionIdIdx: index('UploadedFile_sessionId_idx').on(table.sessionId),
    fileTypeIdx: index('UploadedFile_fileType_idx').on(table.fileType),
    createdAtIdx: index('UploadedFile_createdAt_idx').on(table.createdAt),
    isProcessedIdx: index('UploadedFile_isProcessed_idx').on(table.isProcessed),
  })
);

// NEW: BloodWorkEmbedding table for pgvector
export const bloodWorkEmbedding = pgTable(
  'BloodWorkEmbedding',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').notNull(),
    recordId: uuid('recordId').notNull().references(() => bloodWorkRecord.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunkIndex').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata'),
    embedding: vector('embedding', 1536).notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('BloodWorkEmbedding_userId_idx').on(table.userId),
    recordIdIdx: index('BloodWorkEmbedding_recordId_idx').on(table.recordId),
  })
);

// NEW: BloodSugarEmbedding table for pgvector
export const bloodSugarEmbedding = pgTable(
  'BloodSugarEmbedding',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').notNull(),
    readingId: uuid('readingId').references(() => bloodSugarReading.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    metadata: jsonb('metadata'),
    embedding: vector('embedding', 1536).notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('BloodSugarEmbedding_userId_idx').on(table.userId),
    readingIdIdx: index('BloodSugarEmbedding_readingId_idx').on(table.readingId),
  })
);

// Relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const chatSessionRelations = relations(chatSession, ({ many }) => ({
  messages: many(chatMessage),
}));

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  session: one(chatSession, {
    fields: [chatMessage.sessionId],
    references: [chatSession.id],
  }),
}));

export const bloodWorkRecordRelations = relations(bloodWorkRecord, ({ many }) => ({
  values: many(bloodWorkValue),
  embeddings: many(bloodWorkEmbedding),
}));

export const bloodWorkValueRelations = relations(bloodWorkValue, ({ one }) => ({
  record: one(bloodWorkRecord, {
    fields: [bloodWorkValue.recordId],
    references: [bloodWorkRecord.id],
  }),
}));

export const bloodWorkEmbeddingRelations = relations(bloodWorkEmbedding, ({ one }) => ({
  record: one(bloodWorkRecord, {
    fields: [bloodWorkEmbedding.recordId],
    references: [bloodWorkRecord.id],
  }),
}));

export const bloodSugarEmbeddingRelations = relations(bloodSugarEmbedding, ({ one }) => ({
  reading: one(bloodSugarReading, {
    fields: [bloodSugarEmbedding.readingId],
    references: [bloodSugarReading.id],
  }),
}));
