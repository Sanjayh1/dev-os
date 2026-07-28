-- ContractIQ — Database Schema
-- Paste directly into the Supabase SQL Editor and run on a fresh project.
-- Source: docs/engineering/engineering-doc.md §7, implementation-specs.md Cross-Feature Notes

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- Tables (dependency order)
-- ============================================================

create table contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contract_type text not null check (contract_type in ('NDA', 'MSA')),
  file_name text not null,
  file_path text,
  contract_text text,
  page_count int,
  token_count int,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'completed', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);

create index idx_contracts_user_id on contracts (user_id);
create index idx_contracts_user_created on contracts (user_id, created_at desc);

create table key_terms (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  term_name text not null,
  value text,
  original_ai_value text,
  page_number int,
  confidence_score numeric(5, 2) check (confidence_score >= 0 and confidence_score <= 100),
  source_sentence text,
  is_custom boolean not null default false,
  is_edited boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_key_terms_contract_id on key_terms (contract_id);
create index idx_key_terms_user_id on key_terms (user_id);

create table custom_key_terms (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  term_name text not null check (char_length(term_name) <= 100),
  is_manual boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_custom_key_terms_contract_id on custom_key_terms (contract_id);

-- Defense-in-depth: cap custom terms at 5 per contract (also enforced in API route)
create or replace function enforce_max_custom_terms()
returns trigger as $$
begin
  if (select count(*) from custom_key_terms where contract_id = new.contract_id) >= 5 then
    raise exception 'max_custom_terms_exceeded: a contract may have at most 5 custom key terms';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_enforce_max_custom_terms
  before insert on custom_key_terms
  for each row execute function enforce_max_custom_terms();

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null unique references contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_chat_sessions_user_id on chat_sessions (user_id);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 2000),
  -- Which context the response was classified/answered from — assistant
  -- rows only, null for user rows. Persisted so the UI's source attribution
  -- survives a page reload, not just the live turn. See lib/openai/prompts/chat.ts.
  context_type text check (context_type in ('contract', 'history', 'both')),
  created_at timestamptz not null default now()
);

create index idx_chat_messages_session_created on chat_messages (session_id, created_at asc);

create table user_feedback (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create index idx_user_feedback_contract_id on user_feedback (contract_id);

create table term_corrections (
  id uuid primary key default gen_random_uuid(),
  key_term_id uuid not null references key_terms(id) on delete cascade,
  contract_type text not null check (contract_type in ('NDA', 'MSA')),
  term_name text not null,
  ai_value text,
  corrected_value text,
  created_at timestamptz not null default now()
);

create index idx_term_corrections_key_term_id on term_corrections (key_term_id);
create index idx_term_corrections_type_name on term_corrections (contract_type, term_name);

-- Cost monitoring log (engineering-doc.md §8) — not user-facing, feeds monthly cost alerting
create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  created_at timestamptz not null default now()
);

create index idx_ai_usage_log_created_at on ai_usage_log (created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table contracts enable row level security;
alter table key_terms enable row level security;
alter table custom_key_terms enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table user_feedback enable row level security;
alter table ai_usage_log enable row level security;
-- term_corrections is written server-side only (service role) for aggregate drift analysis;
-- no end-user RLS policies are defined so it is inaccessible via the anon/authenticated client roles.
alter table term_corrections enable row level security;

create policy "select_own" on contracts for select using (user_id = auth.uid());
create policy "insert_own" on contracts for insert with check (user_id = auth.uid());
create policy "update_own" on contracts for update using (user_id = auth.uid());
create policy "delete_own" on contracts for delete using (user_id = auth.uid());

create policy "select_own" on key_terms for select using (user_id = auth.uid());
create policy "insert_own" on key_terms for insert with check (user_id = auth.uid());
create policy "update_own" on key_terms for update using (user_id = auth.uid());
create policy "delete_own" on key_terms for delete using (user_id = auth.uid());

create policy "select_own" on custom_key_terms for select using (user_id = auth.uid());
create policy "insert_own" on custom_key_terms for insert with check (user_id = auth.uid());
create policy "update_own" on custom_key_terms for update using (user_id = auth.uid());
create policy "delete_own" on custom_key_terms for delete using (user_id = auth.uid());

create policy "select_own" on chat_sessions for select using (user_id = auth.uid());
create policy "insert_own" on chat_sessions for insert with check (user_id = auth.uid());
create policy "update_own" on chat_sessions for update using (user_id = auth.uid());
create policy "delete_own" on chat_sessions for delete using (user_id = auth.uid());

create policy "select_own" on chat_messages for select using (user_id = auth.uid());
create policy "insert_own" on chat_messages for insert with check (user_id = auth.uid());
create policy "update_own" on chat_messages for update using (user_id = auth.uid());
create policy "delete_own" on chat_messages for delete using (user_id = auth.uid());

create policy "select_own" on user_feedback for select using (user_id = auth.uid());
create policy "insert_own" on user_feedback for insert with check (user_id = auth.uid());

create policy "select_own" on ai_usage_log for select using (user_id = auth.uid());

-- ============================================================
-- Grants
-- ============================================================
-- RLS policies only govern row-level access — Postgres still requires
-- table-level privileges before a policy is ever evaluated. Grants below
-- mirror the policies above exactly; no role gets a privilege with no
-- matching policy.

grant usage on schema public to authenticated, service_role;

-- authenticated: end-user client (anon key + JWT), scoped by RLS above
grant select, insert, update, delete on contracts, key_terms, custom_key_terms, chat_sessions, chat_messages to authenticated;
grant select, insert on user_feedback to authenticated;
grant select on ai_usage_log to authenticated;
-- term_corrections: no authenticated policies defined above — service_role only

-- service_role: bypasses RLS, used server-side (upload/extraction/chat routes, cron retention, cost logging)
grant select, insert, update, delete on contracts, key_terms, custom_key_terms, chat_sessions, chat_messages, user_feedback, ai_usage_log, term_corrections to service_role;

-- anon: no table access — every route requires an authenticated session (see specs, "Auth: required")
revoke all on contracts, key_terms, custom_key_terms, chat_sessions, chat_messages, user_feedback, ai_usage_log, term_corrections from anon;

-- ============================================================
-- Storage bucket + policies
-- ============================================================

insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

create policy "contracts_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "contracts_select_own"
  on storage.objects for select
  using (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "contracts_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'contracts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
