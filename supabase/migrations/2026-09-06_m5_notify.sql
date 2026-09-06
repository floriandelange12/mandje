-- M5 — meldingen (Fase 5): "X is op" en "X is in de winkel" als push naar huisgenoten.
-- Draai NA m0, m3 en m4. Idempotent.
--
-- 1. notify_outbox: wachtrij van gebeurtenissen; een trigger op items vult 'op'-rijen, de RPC start_shopping
--    vult 'shopping_started'-rijen (met 2-uurs-throttle per lid per lijst). De Edge Function push-events
--    (pg_cron, elke 2 min) bundelt per lijst/soort en verstuurt naar leden minus de actor.
-- 2. push_subscriptions.prefs: per abonnement welke soorten ({"op":true,"shopping":true}).
-- 3. Geen select-policy voor clients op de outbox: alleen de service-rol (Edge Function) leest.

-- ---------- 1. outbox ----------
create table if not exists public.notify_outbox (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists(id) on delete cascade,
  actor_user  uuid references auth.users(id) on delete set null,
  kind        text not null check (kind in ('op','shopping_started')),
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists notify_outbox_unsent_idx on public.notify_outbox (created_at) where sent_at is null;
create index if not exists notify_outbox_list_kind_idx on public.notify_outbox (list_id, kind, created_at desc);
alter table public.notify_outbox enable row level security;
-- leden mogen zelf een rij toevoegen (actor = zichzelf); lezen/wijzigen alleen via de service-rol
drop policy if exists "outbox: lid voegt eigen gebeurtenis toe" on public.notify_outbox;
create policy "outbox: lid voegt eigen gebeurtenis toe" on public.notify_outbox
  for insert with check (actor_user = auth.uid() and public.is_member(list_id, auth.uid()));
grant insert on public.notify_outbox to authenticated;

-- ---------- 2. 'op'-gebeurtenis via trigger op items ----------
create or replace function public.items_flag_notify()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.flagged_at is not null and (tg_op = 'INSERT' or old.flagged_at is distinct from new.flagged_at) then
    insert into public.notify_outbox (list_id, actor_user, kind, payload)
    values (new.list_id, auth.uid(), 'op', jsonb_build_object('item_id', new.id, 'name', left(coalesce(new.name,''), 80), 'by', left(coalesce(new.flagged_by_name,''), 40)));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_items_flag_notify on public.items;
create trigger trg_items_flag_notify
  after insert or update of flagged_at on public.items
  for each row execute function public.items_flag_notify();

-- ---------- 3. 'in de winkel' via RPC met throttle ----------
create or replace function public.start_shopping(p_list_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_member(p_list_id, v_uid) then return false; end if;
  -- hooguit één melding per lid per lijst per 2 uur
  if exists (select 1 from public.notify_outbox o
              where o.list_id = p_list_id and o.actor_user = v_uid and o.kind = 'shopping_started'
                and o.created_at > now() - interval '2 hours') then
    return false;
  end if;
  insert into public.notify_outbox (list_id, actor_user, kind, payload) values (p_list_id, v_uid, 'shopping_started', '{}'::jsonb);
  return true;
end;
$$;
grant execute on function public.start_shopping(uuid) to authenticated;

-- ---------- 4. voorkeuren per abonnement ----------
alter table public.push_subscriptions add column if not exists prefs jsonb not null default '{"op":true,"shopping":true}'::jsonb;

-- ---------- 5. opruimen: verzonden rijen ouder dan 14 dagen ----------
create or replace function public.purge_notify_outbox()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.notify_outbox where sent_at is not null and sent_at < now() - interval '14 days';
  delete from public.notify_outbox where sent_at is null and created_at < now() - interval '2 days';
$$;

-- ---------- 6. inplannen (pg_cron + pg_net): elke 2 minuten de Edge Function aanroepen ----------
-- De functie verwerkt alleen de eigen wachtrij en is idempotent; deploy hem met "Verify JWT" UIT, dan is
-- geen sleutel nodig (een vreemde aanroep verstuurt hooguit wat toch binnen 2 minuten verstuurd zou worden).
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  perform cron.unschedule('mandje-push-events');
exception when others then null;
end $$;
select cron.schedule(
  'mandje-push-events', '*/2 * * * *',
  $$ select net.http_post(
       url:='https://yctcpxgjpmhyohbsrygy.supabase.co/functions/v1/push-events',
       headers:='{"Content-Type":"application/json"}'::jsonb,
       body:='{}'::jsonb
     ); $$
);
do $$
begin
  perform cron.unschedule('mandje-purge-outbox');
exception when others then null;
end $$;
select cron.schedule('mandje-purge-outbox', '13 4 * * *', $$ select public.purge_notify_outbox(); $$);
