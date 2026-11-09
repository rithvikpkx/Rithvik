-- Owner chats: the owner's own agent conversations are logged (so the Share link works) but flagged,
-- so dashboards can exclude them. Additive and idempotent. lib/agent/log.ts only sends is_owner for the owner,
-- so visitor chats keep working whether or not this has been applied.
alter table public.agent_sessions add column if not exists is_owner boolean not null default false;
create index if not exists agent_sessions_owner_idx on public.agent_sessions (is_owner) where is_owner;
