-- M3 — sync, account en offline-first (Fase 3). Draai NA m0 (en m6 mag ervoor of erna). Idempotent.
--
-- 1. user_state: per gebruiker de catalogus (koopritme), vaak-samen, instellingen, bundels, geschiedenis en
--    de lokale lijsten (paklijst/to-do), zodat een nieuwe telefoon of een iPad dezelfde slimme app is.
-- 2. Afronden = soft-delete: items.bought_at / done_at i.p.v. delete → undo, gedeelde koopgeschiedenis
--    (huishoud-cadans) en later de bron voor meldingen.
-- 3. RPC's: item_bump_qty (tegen lost-update), member_heartbeat, auto_add_slot (één toestel voegt toe),
--    delete_my_account (alles van deze gebruiker weg).

-- ---------- 1. user_state ----------
create table if not exists public.user_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  catalog     jsonb not null default '{}'::jsonb,
  co_buy      jsonb not null default '{}'::jsonb,
  settings    jsonb not null default '{}'::jsonb,
  meals       jsonb not null default '{}'::jsonb,
  history     jsonb not null default '[]'::jsonb,
  local_lists jsonb not null default '[]'::jsonb,
  device      text,
  updated_at  timestamptz not null default now()
);
alter table public.user_state enable row level security;
drop policy if exists "user_state: eigen rij lezen" on public.user_state;
create policy "user_state: eigen rij lezen" on public.user_state for select using (user_id = auth.uid());
drop policy if exists "user_state: eigen rij aanmaken" on public.user_state;
create policy "user_state: eigen rij aanmaken" on public.user_state for insert with check (user_id = auth.uid());
drop policy if exists "user_state: eigen rij wijzigen" on public.user_state;
create policy "user_state: eigen rij wijzigen" on public.user_state for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.user_state to authenticated;

-- ---------- 2. soft-delete op items ----------
alter table public.items add column if not exists bought_at timestamptz;
alter table public.items add column if not exists done_at  timestamptz;
create index if not exists items_list_open_idx   on public.items (list_id) where bought_at is null;
create index if not exists items_list_bought_idx on public.items (list_id, bought_at desc) where bought_at is not null;

-- ---------- 3. RPC's ----------
create or replace function public.item_bump_qty(p_id uuid, p_delta int)
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_qty int;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  update public.items i
     set qty = greatest(1, least(999, i.qty + coalesce(p_delta, 0)))
   where i.id = p_id and public.is_member(i.list_id, auth.uid())
   returning i.qty into v_qty;
  return v_qty;
end;
$$;
grant execute on function public.item_bump_qty(uuid, int) to authenticated;

create or replace function public.member_heartbeat(p_list_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then return false; end if;
  update public.members set last_seen = now() where list_id = p_list_id and user_id = auth.uid();
  return found;
end;
$$;
grant execute on function public.member_heartbeat(uuid) to authenticated;

-- Automatisch toevoegen van vaste boodschappen op een gedeelde lijst: precies één toestel per product per dag
create table if not exists public.auto_add_slots (
  list_id  uuid not null references public.lists(id) on delete cascade,
  item_key text not null,
  day      date not null,
  by_user  uuid,
  primary key (list_id, item_key, day)
);
alter table public.auto_add_slots enable row level security;
-- geen directe policies: alleen via de RPC hieronder

create or replace function public.auto_add_slot(p_list_id uuid, p_key text, p_day date)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.is_member(p_list_id, auth.uid()) then return false; end if;
  insert into public.auto_add_slots (list_id, item_key, day, by_user)
  values (p_list_id, left(coalesce(p_key, ''), 120), coalesce(p_day, current_date), auth.uid())
  on conflict do nothing;
  return found;
end;
$$;
grant execute on function public.auto_add_slot(uuid, text, date) to authenticated;

-- Opruimen: slots ouder dan 30 dagen mogen weg (aan te roepen door de push-cron of handmatig)
create or replace function public.purge_auto_add_slots()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auto_add_slots where day < current_date - 30;
$$;

-- Alles van deze gebruiker verwijderen: lijsten waar hij de enige is, lidmaatschappen, profiel, staat, push, bundels
-- en het auth-account zelf (cascades ruimen de rest op).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Niet ingelogd'; end if;
  -- lijsten waarvan ik het enige lid ben
  delete from public.lists l
   where exists (select 1 from public.members m where m.list_id = l.id and m.user_id = v_uid)
     and not exists (select 1 from public.members m2 where m2.list_id = l.id and m2.user_id <> v_uid);
  -- eigen lidmaatschappen (andere leden houden de lijst)
  delete from public.members where user_id = v_uid;
  delete from public.user_state where user_id = v_uid;
  delete from public.profiles where user_id = v_uid;
  delete from public.friendships where from_user_id = v_uid or to_user_id = v_uid;
  delete from public.meals where user_id = v_uid;
  delete from public.push_subscriptions where user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- 4. realtime: items zit al in de publicatie; user_state hoeft niet realtime ----------
