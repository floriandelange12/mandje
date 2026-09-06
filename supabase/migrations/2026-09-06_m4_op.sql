-- M4 — "wat is op" (Fase 4): een lid meldt thuis dat iets op is; in de winkel zie je wie en wanneer.
-- Draai NA m0. Idempotent. RLS ongewijzigd: leden mogen items van hun lijst wijzigen (bestaande policy).

alter table public.items add column if not exists flagged_at      timestamptz;
alter table public.items add column if not exists flagged_by_name text;
create index if not exists items_list_flagged_idx on public.items (list_id, flagged_at desc) where flagged_at is not null;
