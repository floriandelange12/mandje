// Mandje — Edge Function: push-due-items (Fase 5)
// Stuurt een herinnering naar alle push-abonnementen. Plan 'm via pg_cron of de
// Supabase-scheduler (zie supabase/PUSH_SETUP.md). MVP = generieke nudge; de cadans-data
// staat (nog) lokaal in de app, dus per-item "bijna op" volgt pas na cadans-sync.
//
// Vereiste function-secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn standaard beschikbaar in de runtime.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

Deno.serve(async (_req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:floriandelange12@gmail.com";

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: subs, error } = await sb.from("push_subscriptions").select("*");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const payload = JSON.stringify({
    title: "Mandje 🧺",
    body: "Tijd om je vaste boodschappen te checken?",
    url: "/mandje/",
    tag: "mandje-due",
  });

  let sent = 0, removed = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (e) {
      // 404/410 = abonnement verlopen → opruimen zodat de tabel schoon blijft
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        removed++;
      }
    }
  }
  return new Response(JSON.stringify({ sent, removed }), {
    headers: { "Content-Type": "application/json" },
  });
});
