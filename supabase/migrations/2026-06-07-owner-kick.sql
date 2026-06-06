-- 2026-06-07 — Owner mag andere leden uit z'n eigen lijst verwijderen.
-- Voer dit eenmalig uit in de Supabase SQL-editor; daarna werkt 'Verwijder'-knop
-- in de Delen-sheet voor lijst-eigenaars.

drop policy if exists "members: owner mag andere leden verwijderen" on public.members;
create policy "members: owner mag andere leden verwijderen" on public.members
  for delete using (
    exists (
      select 1 from public.lists
      where lists.id = members.list_id
        and lists.owner_user_id = auth.uid()
    )
  );
