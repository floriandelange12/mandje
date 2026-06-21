-- Mandje — web push abonnementen (Fase 5)
-- Eigenaar-gebonden tabel met RLS. Draai dit + zet de Edge Function + cron op
-- (zie supabase/PUSH_SETUP.md). Tot dan blijft push in de app dormant.

create table if not exists public.push_subscriptions (
  endpoint    text primary key,                                  -- uniek per browser/abonnement
  user_id     uuid not null references auth.users(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists idx_push_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "push: zie eigen"       on public.push_subscriptions for select using (user_id = auth.uid());
create policy "push: voeg eigen toe"  on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy "push: wijzig eigen"    on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push: verwijder eigen" on public.push_subscriptions for delete using (user_id = auth.uid());
