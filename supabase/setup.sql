-- Mandje — Supabase setup
-- Reconstructie op basis van src/cloud.js (origineel niet bewaard).
-- Run via Management API of in SQL editor van Supabase dashboard.
-- Idempotent: kan veilig opnieuw uitgevoerd worden.

create extension if not exists pgcrypto;

-- ==========================================================
-- gen_random_bytes vindbaar maken vanuit anon/authenticated
-- (Supabase's auth-service zoekt op deze functie zonder schema-
-- qualifier; in nieuwe projecten zit pgcrypto alleen in
-- 'extensions' en is hij niet bereikbaar voor de auth-rol.
-- Wrapper in public + execute-grants lossen dat op.)
-- ==========================================================

grant usage on schema extensions to anon, authenticated, service_role;
grant execute on function extensions.gen_random_bytes(integer) to anon, authenticated, service_role;
grant execute on function extensions.gen_random_uuid() to anon, authenticated, service_role;

create or replace function public.gen_random_bytes(integer)
  returns bytea
  language sql
  immutable
as $$
  select extensions.gen_random_bytes($1)
$$;

grant execute on function public.gen_random_bytes(integer) to anon, authenticated, service_role;

-- ==========================================================
-- Tabellen
-- ==========================================================

create table if not exists public.lists (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Boodschappen',
  join_code    text not null unique,
  send_token   uuid not null default gen_random_uuid() unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.lists(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Ik',
  color        text not null default '#2F7A4F',
  last_seen    timestamptz,
  created_at   timestamptz not null default now(),
  unique (list_id, user_id)
);

create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references public.lists(id) on delete cascade,
  name          text not null,
  category      text,
  qty           int not null default 1,
  price         numeric,
  note          text default '',
  done          boolean not null default false,
  assigned_to   uuid references public.members(id) on delete set null,
  added_by_name text,
  done_by_name  text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_members_list on public.members(list_id);
create index if not exists idx_members_user on public.members(user_id);
create index if not exists idx_items_list on public.items(list_id);
create index if not exists idx_lists_send_token on public.lists(send_token);
create index if not exists idx_lists_join_code on public.lists(join_code);

-- ==========================================================
-- Helper-functies (security definer — geen RLS-loops)
-- ==========================================================

create or replace function public.is_member(p_list_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where list_id = p_list_id and user_id = p_user_id
  );
$$;

create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- geen I/O/0/1
  code text;
  i int;
  attempt int := 0;
begin
  loop
    attempt := attempt + 1;
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    if not exists (select 1 from public.lists where join_code = code) then
      return code;
    end if;
    if attempt > 50 then
      raise exception 'Kon geen unieke join_code genereren';
    end if;
  end loop;
end;
$$;

-- ==========================================================
-- RPC's (aangeroepen vanuit cloud.js)
-- ==========================================================

create or replace function public.create_list(
  p_name text,
  p_display_name text,
  p_color text
)
returns public.lists
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_list public.lists;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  insert into public.lists (name, join_code, owner_user_id)
  values (
    coalesce(nullif(trim(p_name), ''), 'Boodschappen'),
    public.generate_join_code(),
    auth.uid()
  )
  returning * into v_list;

  insert into public.members (list_id, user_id, display_name, color)
  values (
    v_list.id,
    auth.uid(),
    coalesce(nullif(trim(p_display_name), ''), 'Ik'),
    coalesce(p_color, '#2F7A4F')
  );

  return v_list;
end;
$$;

create or replace function public.join_list(
  p_code text,
  p_display_name text,
  p_color text
)
returns public.lists
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_list public.lists;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  select * into v_list from public.lists
  where upper(join_code) = upper(trim(p_code))
  limit 1;
  if v_list.id is null then
    raise exception 'Lijst niet gevonden';
  end if;
  insert into public.members (list_id, user_id, display_name, color)
  values (
    v_list.id,
    auth.uid(),
    coalesce(nullif(trim(p_display_name), ''), 'Ik'),
    coalesce(p_color, '#2F7A4F')
  )
  on conflict (list_id, user_id) do update
    set display_name = excluded.display_name,
        color = excluded.color;
  return v_list;
end;
$$;

create or replace function public.add_item_via_token(
  p_token uuid,
  p_name text,
  p_qty int,
  p_note text,
  p_from text
)
returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_id uuid;
  v_item public.items;
begin
  select id into v_list_id from public.lists where send_token = p_token limit 1;
  if v_list_id is null then
    raise exception 'Ongeldige stuur-link';
  end if;
  insert into public.items (list_id, name, qty, note, added_by_name)
  values (
    v_list_id,
    p_name,
    greatest(1, coalesce(p_qty, 1)),
    coalesce(p_note, ''),
    nullif(trim(coalesce(p_from, '')), '')
  )
  returning * into v_item;
  return v_item;
end;
$$;

create or replace function public.list_name_by_token(p_token uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select name from public.lists where send_token = p_token limit 1;
$$;

-- Anonieme gebruikers mogen via token toevoegen (publieke stuur-pagina)
grant execute on function public.add_item_via_token(uuid, text, int, text, text) to anon, authenticated;
grant execute on function public.list_name_by_token(uuid) to anon, authenticated;
grant execute on function public.create_list(text, text, text) to authenticated;
grant execute on function public.join_list(text, text, text) to authenticated;

-- ==========================================================
-- RLS
-- ==========================================================

alter table public.lists   enable row level security;
alter table public.members enable row level security;
alter table public.items   enable row level security;

-- lists
drop policy if exists "lists: leden zien hun lijsten" on public.lists;
create policy "lists: leden zien hun lijsten" on public.lists
  for select using (public.is_member(id, auth.uid()));

drop policy if exists "lists: owner mag wijzigen" on public.lists;
create policy "lists: owner mag wijzigen" on public.lists
  for update using (owner_user_id = auth.uid());

drop policy if exists "lists: owner mag verwijderen" on public.lists;
create policy "lists: owner mag verwijderen" on public.lists
  for delete using (owner_user_id = auth.uid());

-- members
drop policy if exists "members: zie leden van mijn lijsten" on public.members;
create policy "members: zie leden van mijn lijsten" on public.members
  for select using (public.is_member(list_id, auth.uid()));

drop policy if exists "members: update eigen rij" on public.members;
create policy "members: update eigen rij" on public.members
  for update using (user_id = auth.uid());

drop policy if exists "members: verlaat lijst (delete eigen rij)" on public.members;
create policy "members: verlaat lijst (delete eigen rij)" on public.members
  for delete using (user_id = auth.uid());

-- Owner mag andere leden uit de lijst kicken
drop policy if exists "members: owner mag andere leden verwijderen" on public.members;
create policy "members: owner mag andere leden verwijderen" on public.members
  for delete using (
    exists (
      select 1 from public.lists
      where lists.id = members.list_id
        and lists.owner_user_id = auth.uid()
    )
  );

-- items
drop policy if exists "items: leden zien items" on public.items;
create policy "items: leden zien items" on public.items
  for select using (public.is_member(list_id, auth.uid()));

drop policy if exists "items: leden mogen toevoegen" on public.items;
create policy "items: leden mogen toevoegen" on public.items
  for insert with check (public.is_member(list_id, auth.uid()));

drop policy if exists "items: leden mogen wijzigen" on public.items;
create policy "items: leden mogen wijzigen" on public.items
  for update using (public.is_member(list_id, auth.uid()));

drop policy if exists "items: leden mogen verwijderen" on public.items;
create policy "items: leden mogen verwijderen" on public.items
  for delete using (public.is_member(list_id, auth.uid()));

-- ==========================================================
-- Realtime publication
-- ==========================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'members'
  ) then
    alter publication supabase_realtime add table public.members;
  end if;
end;
$$;

-- ==========================================================
-- Vrienden-systeem (iteratie 6) — zie supabase/migrations/2026-06-09-friends.sql
-- voor de volledige, becommentarieerde versie. Hier idempotent meegenomen.
-- ==========================================================

create table if not exists public.profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default 'Ik',
  color         text not null default '#2F7A4F',
  emoji         text default '',
  friend_code   text not null unique,
  inbox_list_id uuid references public.lists(id) on delete set null,
  inbox_token   uuid,
  created_at    timestamptz not null default now()
);

create table if not exists public.friendships (
  id               uuid primary key default gen_random_uuid(),
  from_user_id     uuid not null references auth.users(id) on delete cascade,
  to_user_id       uuid not null references auth.users(id) on delete cascade,
  to_display_name  text,
  to_color         text,
  to_emoji         text,
  to_friend_code   text,
  to_inbox_token   uuid,
  created_at       timestamptz not null default now(),
  unique (from_user_id, to_user_id)
);

create index if not exists idx_friendships_from on public.friendships(from_user_id);
create index if not exists idx_profiles_friend_code on public.profiles(friend_code);

create or replace function public.generate_friend_code()
returns text language plpgsql as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text; i int; attempt int := 0;
begin
  loop
    attempt := attempt + 1; code := '';
    for i in 1..8 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    if not exists (select 1 from public.profiles where friend_code = code) then return code; end if;
    if attempt > 50 then raise exception 'Kon geen unieke friend_code genereren'; end if;
  end loop;
end; $$;

create or replace function public.ensure_profile(p_name text, p_color text, p_emoji text)
returns public.profiles language plpgsql security definer set search_path = public, auth as $$
declare v_profile public.profiles; v_list public.lists;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  insert into public.profiles (user_id, display_name, color, emoji, friend_code)
  values (auth.uid(), coalesce(nullif(trim(p_name), ''), 'Ik'),
          coalesce(p_color, '#2F7A4F'), coalesce(p_emoji, ''), public.generate_friend_code())
  on conflict (user_id) do update
    set display_name = coalesce(nullif(trim(p_name), ''), public.profiles.display_name),
        color = coalesce(p_color, public.profiles.color),
        emoji = coalesce(p_emoji, public.profiles.emoji)
  returning * into v_profile;
  if v_profile.inbox_list_id is null then
    insert into public.lists (name, join_code, owner_user_id)
    values (coalesce(nullif(trim(p_name), ''), 'Ik') || ' — inbox', public.generate_join_code(), auth.uid())
    returning * into v_list;
    insert into public.members (list_id, user_id, display_name, color)
    values (v_list.id, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Ik'), coalesce(p_color, '#2F7A4F'));
    update public.profiles set inbox_list_id = v_list.id, inbox_token = v_list.send_token
      where user_id = auth.uid() returning * into v_profile;
  end if;
  return v_profile;
end; $$;

create or replace function public.add_friend(p_friend_code text)
returns public.friendships language plpgsql security definer set search_path = public, auth as $$
declare me public.profiles; them public.profiles; v_row public.friendships;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  select * into them from public.profiles where friend_code = upper(trim(p_friend_code)) limit 1;
  if them.user_id is null then raise exception 'Vriendcode niet gevonden'; end if;
  if them.user_id = auth.uid() then raise exception 'Je kunt jezelf niet toevoegen'; end if;
  select * into me from public.profiles where user_id = auth.uid();
  if me.user_id is null then raise exception 'Maak eerst je profiel aan'; end if;
  insert into public.friendships (from_user_id, to_user_id, to_display_name, to_color, to_emoji, to_friend_code, to_inbox_token)
  values (auth.uid(), them.user_id, them.display_name, them.color, them.emoji, them.friend_code, them.inbox_token)
  on conflict (from_user_id, to_user_id) do update set
    to_display_name = excluded.to_display_name, to_color = excluded.to_color, to_emoji = excluded.to_emoji,
    to_friend_code = excluded.to_friend_code, to_inbox_token = excluded.to_inbox_token
  returning * into v_row;
  insert into public.friendships (from_user_id, to_user_id, to_display_name, to_color, to_emoji, to_friend_code, to_inbox_token)
  values (them.user_id, auth.uid(), me.display_name, me.color, me.emoji, me.friend_code, me.inbox_token)
  on conflict (from_user_id, to_user_id) do update set
    to_display_name = excluded.to_display_name, to_color = excluded.to_color, to_emoji = excluded.to_emoji,
    to_friend_code = excluded.to_friend_code, to_inbox_token = excluded.to_inbox_token;
  return v_row;
end; $$;

create or replace function public.list_friends()
returns setof public.friendships language sql security definer set search_path = public, auth as $$
  select * from public.friendships where from_user_id = auth.uid() order by to_display_name asc;
$$;

create or replace function public.add_friend_to_list(p_list_id uuid, p_friend_user_id uuid)
returns public.members language plpgsql security definer set search_path = public, auth as $$
declare v_member public.members; them public.profiles;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if not public.is_member(p_list_id, auth.uid()) then raise exception 'Je hebt geen toegang tot deze lijst'; end if;
  if not exists (select 1 from public.friendships where from_user_id = auth.uid() and to_user_id = p_friend_user_id)
    then raise exception 'Dit is geen vriend'; end if;
  select * into them from public.profiles where user_id = p_friend_user_id;
  insert into public.members (list_id, user_id, display_name, color)
  values (p_list_id, p_friend_user_id, coalesce(them.display_name, 'Vriend'), coalesce(them.color, '#2F7A4F'))
  on conflict (list_id, user_id) do update set display_name = excluded.display_name
  returning * into v_member;
  return v_member;
end; $$;

grant execute on function public.ensure_profile(text, text, text) to authenticated;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.add_friend_to_list(uuid, uuid) to authenticated;

alter table public.profiles    enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "profiles: zie jezelf" on public.profiles;
create policy "profiles: zie jezelf" on public.profiles for select using (user_id = auth.uid());
drop policy if exists "profiles: update jezelf" on public.profiles;
create policy "profiles: update jezelf" on public.profiles for update using (user_id = auth.uid());
drop policy if exists "friendships: zie je eigen vrienden" on public.friendships;
create policy "friendships: zie je eigen vrienden" on public.friendships for select using (from_user_id = auth.uid());
drop policy if exists "friendships: verwijder eigen vriendschap" on public.friendships;
create policy "friendships: verwijder eigen vriendschap" on public.friendships for delete using (from_user_id = auth.uid());
