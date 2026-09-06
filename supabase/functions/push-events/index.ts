// push-events — verstuurt "X is op" en "X is in de winkel" naar huisgenoten (Fase 5).
// Aangeroepen door pg_cron (elke 2 min) of handmatig. Leest notify_outbox (onverzonden, ≥ 45 s oud zodat
// meerdere vlaggen gebundeld worden), groepeert per (lijst, soort), stuurt naar leden minus de actor die een
// push-abonnement hebben met de bijbehorende voorkeur aan, en zet sent_at. 404/410 → abonnement weg.
// Env (runtime): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

type OutboxRow = { id: string; list_id: string; actor_user: string | null; kind: "op" | "shopping_started"; payload: Record<string, unknown>; created_at: string };
type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string; prefs: Record<string, boolean> | null };

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return names.slice(0, -1).join(", ") + " en " + names[names.length - 1];
}

Deno.serve(async (_req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:floriandelange12@gmail.com";
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: "VAPID-sleutels ontbreken (secrets)" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // 1. onverzonden gebeurtenissen, minstens 45 s oud (bundelvenster), oudste eerst, max 200
  const cutoff = new Date(Date.now() - 45_000).toISOString();
  const { data: rows, error } = await sb.from("notify_outbox").select("*").is("sent_at", null).lte("created_at", cutoff).order("created_at", { ascending: true }).limit(200);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  const outbox = (rows ?? []) as OutboxRow[];
  if (!outbox.length) return new Response(JSON.stringify({ sent: 0, events: 0 }), { headers: { "Content-Type": "application/json" } });

  // 2. groeperen per lijst + soort + actor
  const groups = new Map<string, OutboxRow[]>();
  for (const r of outbox) {
    const key = `${r.list_id}|${r.kind}|${r.actor_user ?? ""}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const listIds = [...new Set(outbox.map((r) => r.list_id))];
  const { data: lists } = await sb.from("lists").select("id,name").in("id", listIds);
  const listName = new Map((lists ?? []).map((l: { id: string; name: string }) => [l.id, l.name]));
  const { data: members } = await sb.from("members").select("list_id,user_id,display_name").in("list_id", listIds);
  const memberRows = (members ?? []) as { list_id: string; user_id: string; display_name: string }[];
  const userIds = [...new Set(memberRows.map((m) => m.user_id))];
  const { data: subsRaw } = userIds.length ? await sb.from("push_subscriptions").select("endpoint,user_id,p256dh,auth,prefs").in("user_id", userIds) : { data: [] };
  const subs = (subsRaw ?? []) as Sub[];

  let sent = 0, removed = 0, events = 0;
  const dead = new Set<string>();
  for (const [key, evs] of groups) {
    const [listId, kind, actor] = key.split("|");
    events += evs.length;
    const actorName = memberRows.find((m) => m.list_id === listId && m.user_id === actor)?.display_name
      || (evs[0].payload?.by as string) || "Iemand";
    const title = listName.get(listId) ?? "Mandje";
    let body: string, tag: string, prefKey: string;
    if (kind === "op") {
      const names = [...new Set(evs.map((e) => String(e.payload?.name ?? "")).filter(Boolean))];
      body = `${actorName}: ${joinNames(names)} ${names.length === 1 ? "is" : "zijn"} op`;
      tag = `mandje-op-${listId}`; prefKey = "op";
    } else {
      body = `${actorName} is in de winkel — nog iets nodig?`;
      tag = `mandje-shop-${listId}`; prefKey = "shopping";
    }
    const payload = JSON.stringify({ title, body, tag, url: `./?list=${listId}`, icon: "./icon-192.png", badge: "./badge-96.png", renotify: true });
    const recipients = memberRows.filter((m) => m.list_id === listId && m.user_id !== actor).map((m) => m.user_id);
    for (const s of subs) {
      if (!recipients.includes(s.user_id) || dead.has(s.endpoint)) continue;
      const prefs = s.prefs ?? {};
      if (prefs[prefKey] === false) continue;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) { dead.add(s.endpoint); }
      }
    }
    const ids = evs.map((e) => e.id);
    await sb.from("notify_outbox").update({ sent_at: new Date().toISOString() }).in("id", ids);
  }
  if (dead.size) {
    await sb.from("push_subscriptions").delete().in("endpoint", [...dead]);
    removed = dead.size;
  }
  return new Response(JSON.stringify({ sent, removed, events }), { headers: { "Content-Type": "application/json" } });
});
