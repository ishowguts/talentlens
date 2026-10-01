CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "companies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_norm" text NOT NULL,
	CONSTRAINT "companies_name_norm_unique" UNIQUE("name_norm")
);
--> statement-breakpoint
CREATE TABLE "job_embeddings" (
	"job_id" bigint PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" bigint,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"location" text,
	"country" text,
	"is_remote" boolean DEFAULT false NOT NULL,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" text,
	"posted_at" timestamp with time zone,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"url" text NOT NULL,
	"content_hash" text NOT NULL,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title,'')), 'A') || setweight(to_tsvector('english', coalesce(description,'')), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_content_hash_unique" UNIQUE("content_hash"),
	CONSTRAINT "jobs_source_check" CHECK ("jobs"."source" IN ('remotive','adzuna'))
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"resume_id" uuid NOT NULL,
	"job_id" bigint NOT NULL,
	"vector_score" real NOT NULL,
	"fit_score" smallint,
	"explanation" jsonb,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_resume_id_job_id_pk" PRIMARY KEY("resume_id","job_id")
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text_hash" text NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resumes_text_hash_unique" UNIQUE("text_hash")
);
--> statement-breakpoint
CREATE TABLE "search_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"mode" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"latency_ms" integer NOT NULL,
	"result_ids" bigint[] NOT NULL,
	"clicked_job_id" bigint,
	"clicked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_logs_mode_check" CHECK ("search_logs"."mode" IN ('keyword','vector','hybrid'))
);
--> statement-breakpoint
ALTER TABLE "job_embeddings" ADD CONSTRAINT "job_embeddings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_clicked_job_id_jobs_id_fk" FOREIGN KEY ("clicked_job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_embeddings_hnsw" ON "job_embeddings" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_source_id_key" ON "jobs" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "jobs_search_tsv_gin" ON "jobs" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "jobs_posted_at_idx" ON "jobs" USING btree ("posted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_filters_idx" ON "jobs" USING btree ("is_remote","country");