# Push-meldingen aanzetten (Fase 5)

Push staat in de app **dormant**: pas als je hieronder een VAPID-public-key invult
verschijnt de "Herinneringen"-toggle (Meer-tab) en gaat de service worker meldingen tonen.
Let op (iOS): meldingen werken **alleen** als Mandje op het **beginscherm** is gezet.

## 1. VAPID-sleutels genereren
```bash
npx web-push generate-vapid-keys
# → Public Key (base64url) en Private Key
```

## 2. Database
Draai `supabase/migrations/2026-06-21_push.sql` in de Supabase SQL-editor
(maakt tabel `push_subscriptions` + RLS).

## 3. Edge Function deployen
```bash
supabase functions deploy push-due-items
supabase secrets set VAPID_PUBLIC_KEY="<public>" VAPID_PRIVATE_KEY="<private>" VAPID_SUBJECT="mailto:floriandelange12@gmail.com"
```
(`SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` zitten al in de runtime.)

Test handmatig:
```bash
curl -i -X POST "https://<project>.functions.supabase.co/push-due-items" \
  -H "Authorization: Bearer <anon-of-service-key>"
```

## 4. Inplannen (dagelijks/wekelijks) met pg_cron
In de SQL-editor (vervang `<project>` en `<service-role-key>`):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'mandje-push-daily', '0 17 * * *',  -- elke dag 17:00 UTC; gebruik '0 17 * * 1' voor wekelijks (ma)
  $$ select net.http_post(
       url:='https://<project>.functions.supabase.co/push-due-items',
       headers:='{"Authorization":"Bearer <service-role-key>","Content-Type":"application/json"}'::jsonb
     ); $$
);
```

## 5. App aanzetten
Zet in `src/shell.html` → `window.MANDJE_CONFIG.VAPID_PUBLIC_KEY` je **public** key,
draai `npm run build` en deploy. De "Herinneringen"-toggle verschijnt nu in Meer.

## Opmerkingen
- **MVP** stuurt een generieke nudge naar iedereen die meldingen aanzette. Per-item
  "bijna op" kan later: dan moet de cadans-data (catalog/koopgeschiedenis) eerst naar
  Supabase syncen, zodat de Edge Function per gebruiker kan bepalen wat bijna op is.
- iOS: geen stille/achtergrond-push; abonnementen kunnen verlopen → de app her-abonneert
  bij openen (`Cloud.checkPushSubscription`). 404/410 ruimt de Edge Function zelf op.
- Privésleutel **nooit** in de frontend — alleen als function-secret.
