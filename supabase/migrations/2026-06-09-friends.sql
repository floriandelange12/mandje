-- 2026-06-09 — Vrienden-systeem: globale profielen + vriendschappen.
-- Eenmalig draaien in de Supabase SQL-editor.
--
-- Model:
--   profiles    = globale identiteitskaart per user (naam, kleur, emoji, deelbare friend_code,
--                 + een automatisch aangemaakte "inbox"-lijst waar vrienden naartoe sturen)
--   friendships = wie kent wie (bidirectioneel opgeslagen door add_friend, met gecachte velden
--                 zodat de UI snel is en een vriend zichtbaar blijft ook als die z'n sessie verliest)
-- Idempotent: kan veilig opnieuw gedraaid worden.

-- ==========================================================
-- Tabellen
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

-- ==========================================================
-- Friend-code generator (8 leesbare tekens, geen I/O/0/1)
-- ==========================================================

create or replace function public.generate_friend_code()
returns text
language plpgsql
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
  attempt int := 0;
begin
  loop
    attempt := attempt + 1;
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    if not exists (select 1 from public.profiles where friend_code = code) then
      return code;
    end if;
    if attempt > 50 then
      raise exception 'Kon geen unieke friend_code genereren';
    end if;
  end loop;
end;
$$;

-- ==========================================================
-- RPC: profiel aanmaken/bijwerken (+ auto-inbox-lijst bij eerste keer)
-- ==========================================================

create or replace function public.ensure_profile(
  p_name text,
  p_color text,
  p_emoji text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles;
  v_list public.lists;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;

  insert into public.profiles (user_id, display_name, color, emoji, friend_code)
  values (
    auth.uid(),
    coalesce(nullif(trim(p_name), ''), 'Ik'),
    coalesce(p_color, '#2F7A4F'),
    coalesce(p_emoji, ''),
    public.generate_friend_code()
  )
  on conflict (user_id) do update
    set display_name = coalesce(nullif(trim(p_name), ''), public.profiles.display_name),
        color        = coalesce(p_color, public.profiles.color),
        emoji        = coalesce(p_emoji, public.profiles.emoji)
  returning * into v_profile;

  -- Eerste keer: maak een "inbox"-lijst zodat vrienden naar jou kunnen sturen
  if v_profile.inbox_list_id is null then
    insert into public.lists (name, join_code, owner_user_id)
    values (
      coalesce(nullif(trim(p_name), ''), 'Ik') || ' — inbox',
      public.generate_join_code(),
      auth.uid()
    )
    returning * into v_list;

    insert into public.members (list_id, user_id, display_name, color)
    values (v_list.id, auth.uid(),
            coalesce(nullif(trim(p_name), ''), 'Ik'),
            coalesce(p_color, '#2F7A4F'));

    update public.profiles
      set inbox_list_id = v_list.id, inbox_token = v_list.send_token
      where user_id = auth.uid()
      returning * into v_profile;
  end if;

  return v_profile;
end;
$$;

-- ==========================================================
-- RPC: vriend toevoegen via code (wederzijds, met caches)
-- ==========================================================

create or replace function public.add_friend(p_friend_code text)
returns public.friendships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me public.profiles;
  them public.profiles;
  v_row public.friendships;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;

  select * into them from public.profiles
    where friend_code = upper(trim(p_friend_code)) limit 1;
  if them.user_id is null then
    raise exception 'Vriendcode niet gevonden';
  end if;
  if them.user_id = auth.uid() then
    raise exception 'Je kunt jezelf niet toevoegen';
  end if;

  select * into me from public.profiles where user_id = auth.uid();
  if me.user_id is null then
    raise exception 'Maak eerst je profiel aan';
  end if;

  -- mij -> hen
  insert into public.friendships
    (from_user_id, to_user_id, to_display_name, to_color, to_emoji, to_friend_code, to_inbox_token)
  values
    (auth.uid(), them.user_id, them.display_name, them.color, them.emoji, them.friend_code, them.inbox_token)
  on conflict (from_user_id, to_user_id) do update
    set to_display_name = excluded.to_display_name,
        to_color        = excluded.to_color,
        to_emoji        = excluded.to_emoji,
        to_friend_code  = excluded.to_friend_code,
        to_inbox_token  = excluded.to_inbox_token
  returning * into v_row;

  -- hen -> mij (zodat de ander jou ook meteen heeft)
  insert into public.friendships
    (from_user_id, to_user_id, to_display_name, to_color, to_emoji, to_friend_code, to_inbox_token)
  values
    (them.user_id, auth.uid(), me.display_name, me.color, me.emoji, me.friend_code, me.inbox_token)
  on conflict (from_user_id, to_user_id) do update
    set to_display_name = excluded.to_display_name,
        to_color        = excluded.to_color,
        to_emoji        = excluded.to_emoji,
        to_friend_code  = excluded.to_friend_code,
        to_inbox_token  = excluded.to_inbox_token;

  return v_row;
end;
$$;

-- ==========================================================
-- RPC: mijn vrienden ophalen
-- ==========================================================

create or replace function public.list_friends()
returns setof public.friendships
language sql
security definer
set search_path = public, auth
as $$
  select * from public.friendships
    where from_user_id = auth.uid()
    order by to_display_name asc;
$$;

-- ==========================================================
-- RPC: een vriend aan een gedeelde lijst toevoegen (geen code-plakken nodig)
-- ==========================================================

create or replace function public.add_friend_to_list(
  p_list_id uuid,
  p_friend_user_id uuid
)
returns public.members
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_member public.members;
  them public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  -- caller moet lid zijn van de lijst
  if not public.is_member(p_list_id, auth.uid()) then
    raise exception 'Je hebt geen toegang tot deze lijst';
  end if;
  -- moet een vriend zijn
  if not exists (select 1 from public.friendships
                 where from_user_id = auth.uid() and to_user_id = p_friend_user_id) then
    raise exception 'Dit is geen vriend';
  end if;

  select * into them from public.profiles where user_id = p_friend_user_id;

  insert into public.members (list_id, user_id, display_name, color)
  values (p_list_id, p_friend_user_id,
          coalesce(them.display_name, 'Vriend'),
          coalesce(them.color, '#2F7A4F'))
  on conflict (list_id, user_id) do update
    set display_name = excluded.display_name
  returning * into v_member;

  return v_member;
end;
$$;

-- ==========================================================
-- Grants
-- ==========================================================

grant execute on function public.ensure_profile(text, text, text) to authenticated;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.add_friend_to_list(uuid, uuid) to authenticated;

-- ==========================================================
-- RLS
-- ==========================================================

alter table public.profiles    enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "profiles: zie jezelf" on public.profiles;
create policy "profiles: zie jezelf" on public.profiles
  for select using (user_id = auth.uid());

drop policy if exists "profiles: update jezelf" on public.profiles;
create policy "profiles: update jezelf" on public.profiles
  for update using (user_id = auth.uid());

drop policy if exists "friendships: zie je eigen vrienden" on public.friendships;
create policy "friendships: zie je eigen vrienden" on public.friendships
  for select using (from_user_id = auth.uid());

drop policy if exists "friendships: verwijder eigen vriendschap" on public.friendships;
create policy "friendships: verwijder eigen vriendschap" on public.friendships
  for delete using (from_user_id = auth.uid());
