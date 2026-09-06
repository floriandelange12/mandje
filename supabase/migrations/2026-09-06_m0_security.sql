-- 2026-09-06 — M0: beveiligingsronde.
-- Eenmalig draaien in de Supabase SQL-editor. Idempotent: kan veilig
-- meerdere keren uitgevoerd worden (drop/create policy, create or replace,
-- add column if not exists, drop/create trigger, grant).
--
-- Onderdelen:
--   1. RLS-gat dichten: list_id (en user_id) van een lidmaatschap bevriezen
--   2. rotate_list_codes(): eigenaar vernieuwt join_code + send_token
--   3. add_item_via_token() harden: invoer begrenzen + throttle (anon-endpoint)
--   4. items.unit: hoeveelheid/eenheid-kolom ("500 g")
--
-- setup.sql is gelijktijdig bijgewerkt, zodat een verse installatie
-- hetzelfde schema oplevert.

-- ==========================================================
-- 1. RLS-gat: members-UPDATE
-- ==========================================================
-- De oude policy "members: update eigen rij" had alleen USING
-- (user_id = auth.uid()) en geen WITH CHECK. Zonder WITH CHECK past
-- Postgres de USING-expressie ook toe op de nieuwe rij, dus user_id
-- kon niet veranderen — maar list_id wél. Een lid kon zijn eigen rij
-- daardoor naar een willekeurige andere lijst "verhuizen" en zo lid
-- worden van elke lijst waarvan hij de id kent. Die id lekt makkelijk:
-- add_item_via_token geeft het aangemaakte item (incl. list_id) terug
-- aan iedereen met een stuur-link.
--
-- Fix in twee lagen:
--   a) de policy krijgt een expliciete WITH CHECK op user_id;
--   b) een BEFORE UPDATE-trigger weigert elke wijziging van list_id
--      of user_id.
-- Waarom een trigger en niet een WITH CHECK met een subquery op
-- members zelf? Zo'n zelfverwijzende subquery werkt vandaag, maar is
-- gevoelig voor Postgres' recursie-detectie in policies: zodra de
-- SELECT-policy op members ooit een subquery bevat, faalt élke update
-- met "infinite recursion detected in policy". Bovendien dekt een
-- policy alleen het RLS-pad; de trigger geldt voor iedereen, ook voor
-- security-definer-RPC's en service_role.
-- Geen enkele bestaande RPC of client-call wijzigt list_id/user_id van
-- een lidmaatschap (join_list en add_friend_to_list updaten alleen
-- display_name/color; de app zet alleen last_seen), dus dit breekt niets.

drop policy if exists "members: update eigen rij" on public.members;
create policy "members: update eigen rij" on public.members
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.members_block_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.list_id is distinct from old.list_id then
    raise exception 'Een lidmaatschap kan niet naar een andere lijst verplaatst worden';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'Een lidmaatschap kan niet aan een andere gebruiker overgedragen worden';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_members_block_identity_change on public.members;
create trigger trg_members_block_identity_change
  before update on public.members
  for each row execute function public.members_block_identity_change();

-- ==========================================================
-- 2. RPC: rotate_list_codes — eigenaar vernieuwt join_code + send_token
-- ==========================================================
-- Voor als een deel- of stuur-link is gelekt. Oude links werken daarna
-- niet meer; bestaande leden blijven gewoon lid. Is de lijst de
-- inbox-lijst van de eigenaar (vrienden-systeem), dan worden de gecachte
-- inbox-tokens in profiles/friendships meegenomen, zodat vrienden naar
-- je kunnen blijven sturen — alleen het gelekte oude token vervalt.

create or replace function public.rotate_list_codes(p_list_id uuid)
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

  update public.lists
     set join_code  = public.generate_join_code(),
         send_token = gen_random_uuid()
   where id = p_list_id
     and owner_user_id = auth.uid()
  returning * into v_list;

  -- Geen rij geraakt = lijst bestaat niet óf caller is niet de eigenaar.
  -- Eén melding voor beide gevallen, zodat het bestaan van lijsten niet lekt.
  if not found then
    raise exception 'Alleen de eigenaar kan de codes vernieuwen';
  end if;

  -- Inbox-lijst van de eigenaar? Dan de gecachte tokens bij vrienden bijwerken.
  if exists (
    select 1 from public.profiles
    where user_id = auth.uid() and inbox_list_id = v_list.id
  ) then
    update public.profiles
       set inbox_token = v_list.send_token
     where user_id = auth.uid();
    update public.friendships
       set to_inbox_token = v_list.send_token
     where to_user_id = auth.uid();
  end if;

  return v_list;
end;
$$;

grant execute on function public.rotate_list_codes(uuid) to authenticated;

-- ==========================================================
-- 3. add_item_via_token harden (anon mag dit aanroepen)
-- ==========================================================
-- Zelfde signatuur en returnwaarde als voorheen (de client verwacht het
-- volledige item terug). Nieuw:
--   - p_name: trimmen, afkappen op 80 tekens, leeg -> 'Geen naam'
--   - p_qty:  begrensd op 1..99
--   - p_note: afgekapt op 200 tekens
--   - p_from: trimmen, afgekapt op 60 tekens (was al nullif-getrimd)
--   - throttle: >= 30 items op de lijst in de laatste minuut -> weigeren
-- Let op: create or replace met exact dezelfde parameterlijst, zodat er
-- géén tweede overload ontstaat.

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
  v_name text;
  v_recent int;
begin
  select id into v_list_id from public.lists where send_token = p_token limit 1;
  if v_list_id is null then
    raise exception 'Ongeldige stuur-link';
  end if;

  -- Invoer normaliseren en begrenzen
  v_name := left(btrim(coalesce(p_name, ''), E' \t\r\n'), 80);
  if v_name = '' then
    raise exception 'Geen naam';
  end if;

  -- Throttle: max 30 nieuwe items per minuut per lijst
  select count(*) into v_recent
    from public.items
   where list_id = v_list_id
     and created_at > now() - interval '1 minute';
  if v_recent >= 30 then
    raise exception 'Even rustig aan — probeer het zo nog eens';
  end if;

  insert into public.items (list_id, name, qty, note, added_by_name)
  values (
    v_list_id,
    v_name,
    least(99, greatest(1, coalesce(p_qty, 1))),
    left(coalesce(p_note, ''), 200),
    nullif(left(btrim(coalesce(p_from, ''), E' \t\r\n'), 60), '')
  )
  returning * into v_item;
  return v_item;
end;
$$;

-- Bestaande grant blijft behouden bij create or replace; voor de zekerheid herhaald.
grant execute on function public.add_item_via_token(uuid, text, int, text, text) to anon, authenticated;

-- ==========================================================
-- 4. items.unit — hoeveelheid/eenheid, bv. "500 g"
-- ==========================================================
-- RLS op items is rij-gebaseerd (lidmaatschap van de lijst), dus geen
-- policy-wijziging nodig. Realtime-publicatie dekt de hele tabel, dus
-- de kolom komt automatisch mee in de events.

alter table public.items add column if not exists unit text not null default '';
