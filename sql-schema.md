# Supabase schema (reference only)

**Documentation, not a script. Do not paste this into the SQL editor.** It describes the
live `public` schema as it is now, derived from `supabase/*.sql`. To change the database,
apply the idempotent migrations there (`supabase db query --linked -f supabase/<file>.sql`).
`projects`, `experience` and `site_content` predate the migrations folder and have no
create script; their shape below is what the app reads and writes.

All tables have RLS enabled. **No table has a write policy** and none may ever be keyed on
`auth.role() = 'authenticated'` (true for any signed-in user of the project). Writes go through
server actions using the service role, which bypasses RLS.

## Content tables (public read)

| Table | Columns | Public read policy |
|---|---|---|
| `projects` | `id uuid pk`, `slug text unique`, `title`, `badge`, `description` (one bullet per line), `tags text[]`, `links jsonb`, `image_url`, `featured bool`, `published bool`, `sort_order int`, `created_at`, `updated_at` | `published = true` |
| `experience` | `id uuid pk`, `slug text unique`, `org`, `org_url`, `role`, `type` (default `work`), `date_range`, `start_date date`, `end_date date`, `description`, `tags text[]`, `location`, `featured`, `published`, `sort_order`, `created_at`, `updated_at` | `published = true` |
| `education` | `id uuid pk`, `school`, `school_url`, `degree`, `concentrations text[]`, `logo_path`, `sort_order`, `published`, `created_at`, `updated_at` | `published = true` |
| `site_content` | `key text pk`, `value text`, `updated_at` | all rows |
| `themes` | `id uuid pk`, `slug text unique`, `name`, `tokens jsonb`, `sort_order`, `published`, `created_at`, `updated_at` | all rows |

`updated_at` on `projects`, `experience` and `site_content` is maintained by a
`set_updated_at()` before-update trigger.

## RAG tables (service role only; policy `deny all` for anon/authenticated)

| Table | Columns |
|---|---|
| `primary_embeddings` | `id uuid pk`, `source_table` (one of `projects`, `experience`, `education`, `site_content`), `source_id text`, `content`, `metadata jsonb`, `embedding vector(1536)`, `updated_at`; `unique (source_table, source_id)` |
| `secondary_documents` | `id uuid pk`, `filename`, `mime_type`, `storage_path unique`, `byte_size int`, `uploaded_at` |
| `secondary_embeddings` | `id uuid pk`, `document_id uuid` references `secondary_documents` on delete cascade, `chunk_index int`, `content`, `metadata jsonb`, `embedding vector(1536)`, `created_at` |

Both embedding columns have **HNSW** cosine indexes (not IVFFlat). RPCs:
`match_primary(query_embedding vector(1536), match_count int)` and
`match_secondary(...)`, both returning chunks with `similarity`. Originals of uploaded files
live in the private Storage bucket `secondary`.

## Rate-limit and log tables (service role only; RLS on, no policies)

| Table | Columns |
|---|---|
| `contact_submissions` | `id uuid pk`, `created_at`, `ip text`, `from_email`, `subject`, `status` (default `sent`); index on `(ip, created_at)` |
| `chat_requests` | `id uuid pk`, `created_at`, `ip text`; index on `(ip, created_at)`. A counter, not a log. |

## Migrations

See the Migrations list in `CLAUDE.md`. Key security ones: `tighten_content_rls.sql` (removed the
authenticated-write policies) and `chat_rate_limit_migration.sql` (tightened `education` read).
