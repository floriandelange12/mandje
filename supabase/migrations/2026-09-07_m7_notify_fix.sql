-- M7 — meldingen rechtzetten (Package D). Draai NA m5. Idempotent; M5 is al gedraaid in productie.
--
-- 1. push_subscriptions: een rij mag door een nieuwe eigenaar worden overgenomen op endpoint.
--    Het endpoint hoort bij het TOESTEL, niet bij het account: na uitloggen/wissen schrijft dezelfde
--    browser dezelfde rij, maar met een andere user_id. Met de oude policy (using user_id = auth.uid())
--    raakte die upsert 0 rijen en bleef het toestel bij het vorige huishouden horen.
-- 2. notify_outbox.attempts: pogingenteller, zodat de Edge Function een tijdelijk mislukte melding
--    opnieuw kan proberen zonder eeuwig te blijven hangen.
-- 3. notify_outbox: het insert-recht voor clients weg. Niets in de app gebruikt dat pad, terwijl het
--    de 2-uurs-throttle in start_shopping en de lengtelimieten in de trigger omzeilde.
-- 4. delete_my_account: gedeelde lijsten die ik bezat overdragen aan het oudste overgebleven lid,
--    anders blijft de lijst achter zonder eigenaar (niemand kan hem hernoemen, verwijderen of de
--    deelcode vernieuwen).

-- ---------- 1. overname van een abonnement op endpoint ----------
drop policy if exists "push: wijzig eigen" on public.push_subscriptions;
create policy "push: wijzig eigen" on public.push_subscriptions
  for update using (true) with check (user_id = auth.uid());
-- verwijderen blijft strikt bij de eigenaar
drop policy if exists "push: verwijder eigen" on public.push_subscriptions;
create policy "push: verwijder eigen" on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- ---------- 2. pogingenteller op de wachtrij ----------
alter table public.notify_outbox add column if not exists attempts int default 0;

-- ---------- 3. clients mogen niet rechtstreeks in de wachtrij schrijven ----------
drop policy if exists "outbox: lid voegt eigen gebeurtenis toe" on public.notify_outbox;
revoke insert on public.notify_outbox from authenticated;
revoke insert on public.notify_outbox from anon;
-- de trigger items_flag_notify en de RPC start_shopping zijn security definer en blijven werken

-- ---------- 4. eigendom overdragen bij het verwijderen van een account ----------
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
  -- lijsten die ik bezat maar waar anderen op zitten: eigendom naar het oudste overgebleven lid
  update public.lists l
     set owner_user_id = (select m.user_id from public.members m
                           where m.list_id = l.id and m.user_id <> v_uid
                           order by m.created_at limit 1)
   where l.owner_user_id = v_uid
     and exists (select 1 from public.members m3 where m3.list_id = l.id and m3.user_id <> v_uid);
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
