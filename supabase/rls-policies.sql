-- ContractIQ — Security Foundation additions
-- Paste directly into the Supabase SQL Editor. Safe to re-run — every
-- statement is idempotent (IF NOT EXISTS / re-enabling RLS that's already
-- enabled is a no-op, not an error).
--
-- This is additive to database.sql (project root), which already created
-- every table below with RLS enabled and policies defined. The
-- ENABLE ROW LEVEL SECURITY statements here are a re-affirming audit trail
-- per the security-foundation skill, not a first-time setup.

-- ============================================================
-- Rate limiting
-- ============================================================
-- Deviation from the security-foundation skill's template: user_id is
-- nullable here, and an `identifier` column is added. The skill's schema
-- assumes every rate-limited action has an authenticated user_id — true for
-- chat/process/upload, but not for the "Authentication" limit itself: a
-- wrong-password login or a signup attempt for an email nobody has used yet
-- has no user_id to key by, and that's exactly the case this limit exists to
-- slow down. Without `identifier` (the attempted email, lowercased),
-- "10 requests/minute" on auth would be unenforceable for the attacks it's
-- meant to stop. See lib/security/rateLimiter.ts.

create table if not exists rate_limit_events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade,
  identifier text,
  action     text        not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_events_user_lookup
  on rate_limit_events (user_id, action, created_at desc);
create index if not exists idx_rate_limit_events_identifier_lookup
  on rate_limit_events (identifier, action, created_at desc);

alter table rate_limit_events enable row level security;
-- No user-facing policies — service role only (lib/supabase/admin.ts).
-- Grants deliberately omitted for `authenticated`/`anon`: this table has no
-- end-user-facing access path at all, only service_role via createAdminClient().
grant select, insert on rate_limit_events to service_role;

-- ============================================================
-- RLS re-affirmation (idempotent) — every table from database.sql
-- ============================================================

alter table contracts enable row level security;
alter table key_terms enable row level security;
alter table custom_key_terms enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table user_feedback enable row level security;
alter table ai_usage_log enable row level security;
alter table term_corrections enable row level security;
