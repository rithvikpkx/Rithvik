-- Tighten content-table RLS. (CRITICAL fix — see docs/audit notes.)
--
-- WHY: projects / experience / site_content each carried an "admin write"
-- policy of the form `FOR ALL USING (auth.role() = 'authenticated')`. That
-- predicate is true for ANY signed-in Supabase user, not just Rithvik — and
-- the project had open email signups, so anyone could self-register, confirm
-- their own address, and then PATCH/DELETE these tables straight through
-- PostgREST using the public anon key that ships in the browser bundle. That
-- path bypasses requireAuth(), the NEXT_PUBLIC_ADMIN_EMAIL allow-list, and the
-- OTP flow entirely, because all three guard the app's server actions rather
-- than PostgREST.
--
-- FIX: drop the write policies outright. Every write in this codebase goes
-- through app/admin/actions.ts or rag-actions.ts via adminClient() (service
-- role), and the service role bypasses RLS — so no application code changes.
-- This leaves the tables read-public / write-nobody, exactly matching what
-- `education` and `themes` already do.
--
-- Idempotent: safe to re-run.

drop policy if exists "admin write" on public.projects;
drop policy if exists "admin write" on public.experience;
drop policy if exists "admin write" on public.site_content;

-- Belt-and-suspenders: RLS must stay ON, or the absence of a policy would mean
-- "no restriction" rather than "deny" for the anon/authenticated roles, which
-- hold default table grants in a stock Supabase project.
alter table public.projects     enable row level security;
alter table public.experience   enable row level security;
alter table public.site_content enable row level security;
