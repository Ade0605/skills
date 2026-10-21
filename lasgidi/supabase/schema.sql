-- Lasgidi online features on your own site (Supabase). Paste this whole file into the Supabase SQL editor once.
-- Sign-in is anonymous (Auth → Providers → Anonymous sign-ins: on): one id per device, no email or password.
-- Row-level security mirrors the claude.ai artifact's rules: everyone reads; each player writes only the documents
-- whose id is their own user id; a few collections are editor (admin) only.

create table if not exists public.admins (id uuid primary key);

create table if not exists public.docs (
  path text primary key,
  coll text not null,
  owner uuid not null default auth.uid(),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint docs_path_shape check (path ~ '^[a-z]+/[A-Za-z0-9_-]{1,64}(/proof/log)?$' and split_part(path, '/', 1) = coll),
  constraint docs_size check (length(data::text) <= 65536),
  constraint docs_known check (coll in ('fame','weekly','ads','sponsored','residents','plots','adreview','adimg','adpaid','homes','gifts',
    'sea','seaimg','seareview','votes','photo','photoreview','photooff','govrun','govvote','govparty','govprimary','govcab','govconfirm',
    'reports','cvs','clubradio'))
);
create index if not exists docs_coll_time on public.docs (coll, updated_at desc);

create table if not exists public.profiles (
  id uuid primary key default auth.uid(),
  name text not null check (char_length(name) between 1 and 24),
  updated_at timestamptz not null default now()
);

create table if not exists public.msgs (
  id bigserial primary key,
  topic text not null check (topic in ('chat', 'deck', 'wave')),
  sender uuid not null default auth.uid(),
  recipient uuid,
  data jsonb not null check (length(data::text) <= 2048),
  at timestamptz not null default now()
);
create index if not exists msgs_at on public.msgs (at);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where id = auth.uid()) $$;

alter table public.admins enable row level security;
alter table public.docs enable row level security;
alter table public.profiles enable row level security;
alter table public.msgs enable row level security;

-- admins: you can see whether you are one; rows are added by the owner in the SQL editor.
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (id = auth.uid());

-- docs: read
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select using (
  case
    when coll = 'reports' then owner = auth.uid() or public.is_admin() -- your own (an upsert needs it), never anyone else's
    when coll in ('adreview', 'seareview', 'photoreview') then owner = auth.uid() or public.is_admin()
    else true
  end);

-- docs: write your own (the doc id is your user id), except the editor-only collections
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (
  case
    when coll in ('sponsored', 'adimg', 'seaimg', 'photo') then public.is_admin()
    else owner = auth.uid() and split_part(path, '/', 2) = auth.uid()::text
  end);
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
  using (
    case
      when coll in ('sponsored', 'adimg', 'seaimg', 'photo') then public.is_admin()
      when coll in ('adreview', 'seareview', 'photoreview') then owner = auth.uid() or public.is_admin()
      else owner = auth.uid()
    end)
  with check (
    case
      when coll in ('sponsored', 'adimg', 'seaimg', 'photo') then public.is_admin()
      when coll in ('adreview', 'seareview', 'photoreview') then (owner = auth.uid() and split_part(path, '/', 2) = auth.uid()::text) or public.is_admin()
      else owner = auth.uid() and split_part(path, '/', 2) = auth.uid()::text
    end);

-- An editor approving a review must not take the row over: keep the original owner.
create or replace function public.docs_keep_owner() returns trigger language plpgsql as
$$ begin if tg_op = 'UPDATE' then new.owner := old.owner; end if; new.updated_at := now(); return new; end $$;
drop trigger if exists docs_keep_owner on public.docs;
create trigger docs_keep_owner before insert or update on public.docs for each row execute function public.docs_keep_owner();

-- profiles: everyone reads names; you write only your own
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- msgs: the sender is always you (the database sets it); a direct chat is for its two people, deck and wave for all
drop policy if exists msgs_send on public.msgs;
create policy msgs_send on public.msgs for insert to authenticated with check (sender = auth.uid());
drop policy if exists msgs_read on public.msgs;
create policy msgs_read on public.msgs for select using (
  at > now() - interval '10 minutes' and (topic <> 'chat' or sender = auth.uid() or recipient = auth.uid()));

-- Realtime: live updates for docs and msgs (presence uses a Realtime channel and needs no table).
do $$ begin
  begin alter publication supabase_realtime add table public.docs; exception when others then null; end;
  begin alter publication supabase_realtime add table public.msgs; exception when others then null; end;
end $$;

-- Chat is short-lived: delete messages older than 10 minutes, every 5 minutes (pg_cron is on in Supabase projects).
do $$ begin
  begin
    create extension if not exists pg_cron;
    perform cron.schedule('lasgidi-msgs-cleanup', '*/5 * * * *', $q$ delete from public.msgs where at < now() - interval '10 minutes' $q$);
  exception when others then raise notice 'pg_cron not available: old messages are hidden by the read policy but not deleted';
  end;
end $$;
