-- Mandje — maaltijden/bundels (Fase 2)
-- Eigenaar-gebonden tabel zodat bundels over je eigen toestellen syncen.
-- Bundels worden lokaal aangemaakt (client-side id), dus id is text (geen uuid-default).
-- Draai dit in de Supabase SQL-editor om cross-device-sync aan te zetten.
-- De app werkt ook zónder deze tabel: bundels blijven dan lokaal op het toestel.

create table if not exists public.meals (
  id          text primary key,                                   -- client-side id (meal_xxx)
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  emoji       text default '🍽️',
  items       jsonb not null default '[]'::jsonb,                 -- [{name, qty, unit}]
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists idx_meals_user on public.meals(user_id);

alter table public.meals enable row level security;

create policy "meals: zie eigen"        on public.meals for select using (user_id = auth.uid());
create policy "meals: voeg eigen toe"   on public.meals for insert with check (user_id = auth.uid());
create policy "meals: wijzig eigen"     on public.meals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "meals: verwijder eigen"  on public.meals for delete using (user_id = auth.uid());
