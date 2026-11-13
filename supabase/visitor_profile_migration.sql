-- What a visitor told the agent about themselves (name/email/company already exist on visitors).
alter table public.visitors add column if not exists role text;          -- e.g. "Technical recruiter"
alter table public.visitors add column if not exists visitor_kind text   -- who they said they are
  check (visitor_kind in ('recruiter', 'engineer', 'student', 'founder', 'other'));
alter table public.visitors add column if not exists job_posting text;   -- a posting link or its text, as they gave it
