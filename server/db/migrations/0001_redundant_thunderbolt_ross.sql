ALTER TABLE "documents" ADD COLUMN "size_bytes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "mime_type" text;