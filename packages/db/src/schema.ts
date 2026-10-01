// Drizzle schema. The authoritative description of these tables is docs/ARCHITECTURE.md section 5.
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

/** Postgres `tsvector`. Drizzle has no built-in type for it; queries use raw SQL operators. */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

/** Postgres `bigint[]`, read back as strings by node-postgres. */
const bigintArray = customType<{ data: string[]; driverData: string }>({
  dataType() {
    return 'bigint[]';
  },
});

export const companies = pgTable('companies', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull(),
  /** `lower(trim(name))` with collapsed spaces; the dedupe key for a company. */
  nameNorm: text('name_norm').notNull().unique(),
});

export const jobs = pgTable(
  'jobs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    companyId: bigint('company_id', { mode: 'number' }).references(() => companies.id),
    title: text('title').notNull(),
    /** Plain text; HTML is stripped during ingestion. */
    description: text('description').notNull(),
    location: text('location'),
    /** ISO-3166 alpha-2, when known. */
    country: text('country'),
    isRemote: boolean('is_remote').notNull().default(false),
    /** Annual figures in `salaryCurrency`. */
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: text('salary_currency'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull(),
    url: text('url').notNull(),
    /** sha256 over the normalized content; see ARCHITECTURE section 7.1. */
    contentHash: text('content_hash').notNull().unique(),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title,'')), 'A') || setweight(to_tsvector('english', coalesce(description,'')), 'B')`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('jobs_source_source_id_key').on(t.source, t.sourceId),
    index('jobs_search_tsv_gin').using('gin', t.searchTsv),
    index('jobs_posted_at_idx').on(t.postedAt.desc()),
    index('jobs_filters_idx').on(t.isRemote, t.country),
    check('jobs_source_check', sql`${t.source} IN ('remotive','adzuna')`),
  ],
);

export const jobEmbeddings = pgTable(
  'job_embeddings',
  {
    jobId: bigint('job_id', { mode: 'number' })
      .primaryKey()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    model: text('model').notNull(),
    /** The content hash the vector was computed from; the embedding cache key. */
    contentHash: text('content_hash').notNull(),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('job_embeddings_hnsw')
      .using('hnsw', t.embedding.op('vector_cosine_ops'))
      .with({ m: 16, ef_construction: 64 }),
  ],
);

export const resumes = pgTable('resumes', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  textHash: text('text_hash').notNull().unique(),
  text: text('text').notNull(),
  embedding: vector('embedding', { dimensions: 384 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const matches = pgTable(
  'matches',
  {
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    jobId: bigint('job_id', { mode: 'number' })
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    vectorScore: real('vector_score').notNull(),
    /** 0..100 from the reranking model; null when the rerank failed. */
    fitScore: smallint('fit_score'),
    /** `{ reasons: string[], missingSkills: string[] }`. */
    explanation: jsonb('explanation'),
    model: text('model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.resumeId, t.jobId] })],
);

export const searchLogs = pgTable(
  'search_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    query: text('query').notNull(),
    mode: text('mode').notNull(),
    filters: jsonb('filters').notNull().default({}),
    latencyMs: integer('latency_ms').notNull(),
    resultIds: bigintArray('result_ids').notNull(),
    clickedJobId: bigint('clicked_job_id', { mode: 'number' }).references(() => jobs.id),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('search_logs_mode_check', sql`${t.mode} IN ('keyword','vector','hybrid')`)],
);

export type Company = typeof companies.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobEmbedding = typeof jobEmbeddings.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type SearchLog = typeof searchLogs.$inferSelect;
