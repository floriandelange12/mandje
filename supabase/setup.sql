-- Mandje — Supabase setup
-- Reconstructie op basis van src/cloud.js (origineel niet bewaard).
-- Run via Management API of in SQL editor van Supabase dashboard.
-- Idempotent: kan veilig opnieuw uitgevoerd worden.

create extension if not exists pgcrypto;

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
