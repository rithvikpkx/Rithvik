-- Links a contact email to the agent conversation it came from (draft_email -> composer).
-- Nullable, no FK cascade: deleting a chat must not delete the contact log. Idempotent.
-- The route tolerates this column being absent, so the order of deploy and migration doesn't matter.
alter table public.contact_submissions add column if not exists agent_session_id uuid;
