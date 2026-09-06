-- M6 — lijsttypes in de cloud (Fase 6): lists.type ('grocery' | 'plain'), items.sort_order (handmatige volgorde),
-- create_list met p_type (oude 3-argumenten-signatuur wordt gedropt zodat PostgREST niet twee overloads ziet).
-- Draai dit in de Supabase SQL-editor NA 2026-09-06_m0_security.sql. Idempotent.

alter table public.lists
  add column if not exists type text not null default 'grocery';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lists_type_check') then
    alter table public.lists add constraint lists_type_check check (type in ('grocery', 'plain'));
  end if;
end $$;

alter table public.items
  add column if not exists sort_order double precision;

create index if not exists items_list_sort_idx on public.items (list_id, sort_order nulls last, created_at);

-- Oude overload weg (anders kiest PostgREST willekeurig of weigert hij de aanroep)
drop function if exists public.create_list(text, text, text);

create or replace function public.create_list(
  p_name text,
  p_display_name text,
  p_color text,
  p_type text default 'grocery'
)
returns public.lists
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_list public.lists;
  v_type text;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  v_type := case when p_type in ('grocery', 'plain') then p_type else 'grocery' end;
  insert into public.lists (name, join_code, owner_user_id, type)
  values (
    coalesce(nullif(trim(left(p_name, 40)), ''), 'Boodschappen'),
    public.generate_join_code(),
    auth.uid(),
    v_type
  )
  returning * into v_list;

  insert into public.members (list_id, user_id, display_name, color)
  values (
    v_list.id,
    auth.uid(),
    coalesce(nullif(trim(left(p_display_name, 40)), ''), 'Ik'),
    coalesce(p_color, '#24593F')
  );

  return v_list;
end;
$$;

grant execute on function public.create_list(text, text, text, text) to authenticated;

-- Realtime blijft werken: 'type' zit in dezelfde publicatie als de rest van lists/items.
