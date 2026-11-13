-- The Play deck's record crate: one row per uploaded song, the audio in the public `music` bucket.
-- Rows are written by server actions (service role) only; the site reads them server-side, so no policies.
create table if not exists public.songs (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title      text not null check (char_length(title) between 1 and 120),
  artist     text check (char_length(artist) <= 120),
  path       text not null unique,
  sort       int not null default 0
);
alter table public.songs enable row level security;

-- Public read (the deck fetches the mp3 directly); uploads only through server-issued signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music', 'music', true, 52428800, array['audio/mpeg', 'audio/mp3'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
