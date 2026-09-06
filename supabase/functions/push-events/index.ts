// push-events — verstuurt "X is op" en "X is in de winkel" naar huisgenoten (Fase 5).
// Aangeroepen door pg_cron (elke 2 min) of handmatig. Werkwijze:
//  1. onverzonden rijen uit notify_outbox, minstens 45 s oud (bundelvenster), oudste eerst;
//  2. CLAIMEN (sent_at=now) vóór het versturen — twee gelijktijdige aanroepen sturen anders dubbel;
//  3. 'op'-rijen opnieuw toetsen tegen items (flagged_at gezet, bought_at leeg): "Ongedaan" haalt de vlag
//     weg nádat de trigger de rij al schreef, en dan hoort er niets meer uit te gaan;
//  4. groeperen per (lijst, soort, actor) en sturen naar de leden minus de actor die een abonnement met
//     de bijbehorende voorkeur aan hebben. Elke bundel krijgt een eigen tag, anders vervangt een latere
//     melding de vorige en zijn die namen weg;
//  5. 404/410 → abonnement weg. Andere fouten (429/5xx/netwerk) worden gelogd en de claim gaat terug,
//     zodat de volgende run het opnieuw probeert — na MAX_ATTEMPTS pogingen geven we de rij op.
// Env (runtime): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

type OutboxRow = { id: string; list_id: string; actor_user: string | null; kind: "op" | "shopping_started"; payload: Record<string, unknown>; created_at: string; attempts?: number | null };
type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string; prefs: Record<string, boolean> | null };
type ItemRow = { id: string; flagged_at: string | null; bought_at: string | null };

const MAX_ATTEMPTS = 5;   // daarna opgeven: de rij blijft geclaimd en wordt door purge_notify_outbox opgeruimd

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return names.slice(0, -1).join(", ") + " en " + names[names.length - 1];
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (_req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:floriandelange12@gmail.com";
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error("push-events: VAPID-sleutels ontbreken (secrets)");
    return json({ error: "VAPID-sleutels ontbreken (secrets)" }, 500);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // 1. kandidaten
  const cutoff = new Date(Date.now() - 45_000).toISOString();
  const { data: rows, error } = await sb.from("notify_outbox").select("*").is("sent_at", null).lte("created_at", cutoff).order("created_at", { ascending: true }).limit(200);
  if (error) { console.error("push-events: lezen faalde", error.message); return json({ error: error.message }, 500); }
  const candidates = (rows ?? []) as OutboxRow[];
  if (!candidates.length) return json({ sent: 0, events: 0 });

  // 2. claimen vóór versturen (dubbele meldingen bij gelijktijdige aanroepen voorkomen)
  const claimAt = new Date().toISOString();
  const { data: claimedRaw, error: claimErr } = await sb.from("notify_outbox")
    .update({ sent_at: claimAt })
    .in("id", candidates.map((r) => r.id))
    .is("sent_at", null)
    .select("*");
  if (claimErr) { console.error("push-events: claimen faalde", claimErr.message); return json({ error: claimErr.message }, 500); }
  const outbox = (claimedRaw ?? []) as OutboxRow[];
  if (!outbox.length) return json({ sent: 0, events: 0, claimed: 0 });

  // Claim terugdraaien na een tijdelijke fout; na MAX_ATTEMPTS pogingen laten we de rij staan.
  const release = async (evs: OutboxRow[]) => {
    for (const r of evs) {
      const attempts = (r.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        console.error(`push-events: rij ${r.id} opgegeven na ${attempts} pogingen`);
        await sb.from("notify_outbox").update({ attempts }).eq("id", r.id);
      } else {
        await sb.from("notify_outbox").update({ sent_at: null, attempts }).eq("id", r.id);
      }
    }
  };

  // 3. 'op'-rijen opnieuw toetsen: alleen items die nog gevlagd én niet afgerond zijn tellen mee
  const opItemIds = [...new Set(outbox.filter((r) => r.kind === "op").map((r) => String(r.payload?.item_id ?? "")).filter(Boolean))];
  const stillFlagged = new Set<string>();
  if (opItemIds.length) {
    const { data: its, error: itemErr } = await sb.from("items").select("id,flagged_at,bought_at").in("id", opItemIds);
    if (itemErr) console.error("push-events: items opnieuw toetsen faalde", itemErr.message);
    for (const it of ((its ?? []) as ItemRow[])) if (it.flagged_at && !it.bought_at) stillFlagged.add(it.id);
  }

  // 4. groeperen per lijst + soort + actor
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

  let sent = 0, removed = 0, events = 0, retracted = 0;
  const dead = new Set<string>();
  for (const [key, evs] of groups) {
    const [listId, kind, actor] = key.split("|");
    events += evs.length;
    const actorName = memberRows.find((m) => m.list_id === listId && m.user_id === actor)?.display_name
      || (evs[0].payload?.by as string) || "Iemand";
    const title = listName.get(listId) ?? "Mandje";
    let body: string, tag: string, prefKey: string;
    if (kind === "op") {
      // rijen zonder item_id (oude vorm) laten we staan; de rest moet nog echt gevlagd zijn
      const live = evs.filter((e) => { const id = String(e.payload?.item_id ?? ""); return !id || stillFlagged.has(id); });
      if (!live.length) { retracted += evs.length; continue; }   // alles weer ongedaan gemaakt: niets sturen, claim blijft staan
      const names = [...new Set(live.map((e) => String(e.payload?.name ?? "")).filter(Boolean))];
      if (!names.length) { retracted += evs.length; continue; }
      body = `${actorName}: ${joinNames(names)} ${names.length === 1 ? "is" : "zijn"} op`;
      tag = `mandje-op-${listId}-${evs[0].id}`;             // eigen tag per bundel, anders overschrijft een latere melding deze
      prefKey = "op";
    } else {
      body = `${actorName} is in de winkel — nog iets nodig?`;
      tag = `mandje-shop-${listId}-${evs[0].id}`;
      prefKey = "shopping";
    }
    const payload = JSON.stringify({ title, body, tag, url: `./?list=${listId}`, icon: "./icon-192.png", badge: "./badge-96.png", renotify: true });
    const recipients = memberRows.filter((m) => m.list_id === listId && m.user_id !== actor).map((m) => m.user_id);
    let retryable = false;
    for (const s of subs) {
      if (!recipients.includes(s.user_id) || dead.has(s.endpoint)) continue;
      const prefs = s.prefs ?? {};
      if (prefs[prefKey] === false) continue;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        console.error(`push-events: versturen faalde (status ${code ?? "?"}) voor ${s.endpoint.slice(0, 60)}`);
        if (code === 404 || code === 410) dead.add(s.endpoint);
        else retryable = true;                                  // 429/5xx/netwerk: opnieuw proberen
      }
    }
    if (retryable) await release(evs);
  }
  if (dead.size) {
    await sb.from("push_subscriptions").delete().in("endpoint", [...dead]);
    removed = dead.size;
  }
  return json({ sent, removed, events, retracted, claimed: outbox.length });
});
