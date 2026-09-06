/* Mandje — build
   Voegt src/ + assets/ samen tot één self-contained index.html (voor GitHub Pages) en
   schrijft daarnaast twee losse root-bestanden die niet inline kúnnen: sw.js (service worker)
   de PWA-metadata als losse root-bestanden: manifest.webmanifest, icon-180/192/512(-maskable).png, badge-96.png.
   Gebruik:  node build.js     (of: npm run build)
*/
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const root = __dirname;
const read = p => fs.readFileSync(path.join(root, p), "utf8");

/* ---------- Mojibake-guard ----------
   Dubbel gecodeerde UTF-8 (een "é" die als U+00C3 U+00A9 in het bestand staat, een "—" als
   U+00E2 U+20AC U+201D) ontstaat wanneer een editor of tool een UTF-8-bestand als CP1252 inleest en
   opnieuw als UTF-8 opslaat. Marker: CP1252-lead-teken gevolgd door een continuation-teken.
   Bewust als \u-escapes geschreven (geen letterlijke controle-tekens in deze bron).
   Zo'n bestand komt hier niet doorheen: de build stopt hard, met regelnummer en context. */
const CP1252_SPECIALS = "\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178";
const MOJIBAKE = new RegExp("[\u00C2\u00C3\u00E2\u00F0][\u0080-\u00BF" + CP1252_SPECIALS + "]");

function assertClean(text, label) {
  if (text.charCodeAt(0) === 0xFEFF) {
    console.error("✗ " + label + " begint met een BOM (U+FEFF) — sla het op als UTF-8 zónder BOM. Build gestopt.");
    process.exit(1);
  }
  const m = MOJIBAKE.exec(text);
  if (m) {
    const line = text.slice(0, m.index).split("\n").length;
    const ctx  = text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, " ");
    const cps  = Array.from(m[0]).map(c => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" ");
    console.error("✗ Mojibake (dubbel gecodeerde UTF-8) in " + label + ", regel " + line + ": " + JSON.stringify(m[0]) + " (" + cps + ")");
    console.error("  context: …" + ctx + "…");
    console.error("  Het bestand is waarschijnlijk als CP1252 gelezen en als UTF-8 herschreven. Herstel de bron; build gestopt.");
    process.exit(1);
  }
  return text;
}
const readSafe = p => assertClean(read(p), p);

// bronnen (tekst → altijd via de guard; base64-assets en de SDK niet)
const app   = readSafe("src/app.js");
const cloud = readSafe("src/cloud.js");
const shell = readSafe("src/shell.html");

// cloud-module wordt BINNEN de IIFE van app.js gevoegd, vlak vóór de init-aanroep
const MARKER = 'if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);';
if (app.indexOf(MARKER) === -1) {
  console.error("✗ Build-marker niet gevonden in src/app.js — build gestopt.");
  process.exit(1);
}
// Prelude-modules (iconen, overlays/toetsenbord) gaan BINNEN de IIFE vóór de app-code — function-declaraties
// worden gehoist, dus app.js kan ze overal gebruiken; window blijft schoon.
const PRELUDE = ["src/icons.js", "src/overlays.js", "src/qr.js"].filter(p => fs.existsSync(path.join(root, p)));
const prelude = PRELUDE.map(p => "/* ===== " + p + " ===== */\n" + readSafe(p)).join("\n");
const IIFE_OPEN = '"use strict";\n(function(){\n';
if (app.indexOf(IIFE_OPEN) !== 0) { console.error("✗ src/app.js begint niet met de verwachte IIFE-opener — build gestopt."); process.exit(1); }
const combined = (IIFE_OPEN + prelude + "\n" + app.slice(IIFE_OPEN.length)).replace(MARKER, () => "\n/* ===== CLOUD MODULE ===== */\n" + cloud + "\n\n" + MARKER);

// assets (base64)
const icons = {};
read("assets/icon_b64.txt").split(/\r?\n/).forEach(line => {
  const i = line.indexOf(":");
  if (i > 0) icons[line.slice(0, i)] = line.slice(i + 1).trim();
});
const font = read("assets/font_b64.txt").split(":").slice(1).join(":").trim();
// Iconen worden door tools/make-icons.js gerasterd uit src/icons.js (APP_ICON_SVG / APP_ICON_ANY_SVG / APP_BADGE_SVG)
const ICON_FILES = { ICON180: "icon-180.png", ICON192: "icon-192.png", ICON512: "icon-512.png", ICON512MASK: "icon-512-maskable.png", ICON96BADGE: "badge-96.png" };
Object.keys(ICON_FILES).forEach(k => {
  if (!icons[k]) { console.error("✗ assets/icon_b64.txt mist regel " + k + ":<base64> (draai: node tools/make-icons.js) — build gestopt."); process.exit(1); }
});

// supabase SDK (ingebakken UMD-bundle — voorkomt runtime CDN-fetch)
const supabaseSdkPath = path.join(root, "assets/supabase.js");
const supabaseSdk = fs.existsSync(supabaseSdkPath) ? read("assets/supabase.js") : "";
// De SDK gaat NIET meer inline mee (200 KB in het kritieke pad) maar als los root-bestand ./supabase.js,
// dat cloud.js pas laadt bij het eerste cloud-gebruik en dat de service worker precached.
const sdkScript = "";
if (!supabaseSdk) console.warn("! assets/supabase.js niet gevonden — Cloud valt terug op runtime CDN-fetch");

// Barcode-decoder (html5-qrcode) wordt lazy van CDN geladen bij de eerste scan
// (zie loadBarcodeDecoder in app.js) — niet ingebakken: de Open Food Facts-lookup
// vereist tóch internet, dus offline cachen van de decoder heeft geen nut.

// shell vullen — vervangingen via functie, zodat "$&"/"$'" in de bron niet als patroon wordt gelezen
let html = shell.replace("<!-- __SCRIPT__ -->", () => sdkScript + "<script>\n" + combined + "\n</script>");
html = html.replace("__FONT__", () => font);

/* ---------- BUILD = inhoudshash ----------
   shell.html bevat  BUILD: "__BUILD__".  De hash wordt berekend over de complete HTML mét
   placeholder, dus elke wijziging in src/ of assets/ geeft automatisch een nieuwe cache-naam
   voor de service worker. Nooit meer handmatig ophogen.
   Overgangssituatie: staat er nog een vaste  BUILD: "…"-waarde, dan wordt die genormaliseerd. */
if (!/BUILD:\s*"__BUILD__"/.test(html)) {
  if (/BUILD:\s*"[^"]*"/.test(html)) {
    html = html.replace(/(BUILD:\s*)"[^"]*"/, (_, pre) => pre + '"__BUILD__"');
    console.warn('! src/shell.html heeft nog een vaste BUILD-waarde — vervang die door BUILD: "__BUILD__" (nu automatisch genormaliseerd)');
  } else {
    console.error('✗ Geen BUILD: "__BUILD__"-placeholder (of BUILD: "…"-waarde) gevonden in src/shell.html — build gestopt.');
    process.exit(1);
  }
}
// sw.js zit niet in de HTML maar bepaalt wél de cache-naam → mee in de hash. Geen datum: dezelfde bron = dezelfde BUILD (reproduceerbaar).
const swSrcPath = path.join(root, "src/sw.js");
const swSrc = fs.existsSync(swSrcPath) ? readSafe("src/sw.js") : "";
const hash = crypto.createHash("sha1").update(html).update(swSrc).update(supabaseSdk).digest("hex").slice(0, 8);
const buildId = hash;
html = html.replace(/__BUILD__/g, buildId);

["__ICON180__", "__ICON512__", "__FONT__", "__SCRIPT__", "__BUILD__"].forEach(t => {   // oude icoon-tokens mogen ook nergens meer staan
  if (html.indexOf(t) !== -1) { console.error("✗ Token niet vervangen: " + t); process.exit(1); }
});
// Guard alleen over de eigen bronnen (shell + app + cloud), niet over de vendor-SDK/base64-assets
assertClean(shell + combined, "index.html (eigen bronnen)");

// Alle harde controles vóór het eerste weggeschreven artefact, zodat index.html/sw.js/icoon nooit uit fase lopen
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const iconBufs = {};
Object.keys(ICON_FILES).forEach(k => {
  const b = Buffer.from(icons[k], "base64");
  if (b.length < 8 || !b.subarray(0, 8).equals(PNG_SIG)) { console.error("✗ " + k + " in assets/icon_b64.txt is geen geldige PNG — build gestopt."); process.exit(1); }
  iconBufs[k] = b;
});

/* ---------- Web App Manifest (los bestand: als data-URI zijn start_url/scope onoplosbaar en installeert Android/desktop niet) */
const manifest = {
  id: "./",
  name: "Mandje",
  short_name: "Mandje",
  description: "Boodschappenlijst die je samen bijhoudt — offline, met winkelmodus en meldingen.",
  lang: "nl",
  dir: "ltr",
  start_url: "./?source=pwa",
  scope: "./",
  display: "standalone",
  display_override: ["standalone", "minimal-ui"],
  orientation: "any",
  background_color: "#F3EDE3",
  theme_color: "#24593F",
  categories: ["shopping", "productivity", "lifestyle"],
  prefer_related_applications: false,
  icons: [
    { src: "./icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "./icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "./icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ],
  shortcuts: [
    { name: "Nieuw item", short_name: "Nieuw", description: "Open Mandje met de cursor in het invoerveld", url: "./?focus=add", icons: [{ src: "./icon-192.png", sizes: "192x192", type: "image/png" }] },
    { name: "Winkelen", short_name: "Winkelen", description: "Open direct de winkelmodus", url: "./?mode=shop", icons: [{ src: "./icon-192.png", sizes: "192x192", type: "image/png" }] }
  ],
  share_target: { action: "./", method: "GET", enctype: "application/x-www-form-urlencoded", params: { title: "title", text: "text", url: "url" } }
};
const manifestJson = JSON.stringify(manifest, null, 2) + "\n";

fs.writeFileSync(path.join(root, "index.html"), html);
console.log("✓ index.html gebouwd (" + Buffer.byteLength(html) + " bytes, BUILD " + buildId + ")");

// Iconen als losse PNG's (manifest, apple-touch-icon, push-icoon/badge kunnen geen data-URI uit de shell zijn)
Object.keys(ICON_FILES).forEach(k => { fs.writeFileSync(path.join(root, ICON_FILES[k]), iconBufs[k]); });
console.log("✓ iconen geschreven: " + Object.keys(ICON_FILES).map(k => ICON_FILES[k] + " (" + Math.round(iconBufs[k].length / 1024) + " KB)").join(", "));
fs.writeFileSync(path.join(root, "manifest.webmanifest"), manifestJson);
console.log("✓ manifest.webmanifest geschreven");
if (supabaseSdk) {
  fs.writeFileSync(path.join(root, "supabase.js"), supabaseSdk);
  console.log("✓ supabase.js geschreven (" + Math.round(supabaseSdk.length / 1024) + " KB — los geladen bij het eerste cloud-gebruik)");
}

// Service worker: BUILD-waarde injecteren + naar repo-root schrijven (scope = /mandje/ op GitHub Pages)
if (swSrc) {
  const sw = swSrc.replace(/__BUILD__/g, buildId);
  fs.writeFileSync(path.join(root, "sw.js"), sw);
  console.log("✓ sw.js gebouwd (cache mandje-" + buildId + ")");
} else {
  console.warn("! src/sw.js niet gevonden — service worker overgeslagen");
}
