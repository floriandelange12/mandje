/* Mandje — build
   Voegt src/ + assets/ samen tot één self-contained index.html (voor GitHub Pages) en
   schrijft daarnaast twee losse root-bestanden die niet inline kúnnen: sw.js (service worker)
   en icon-512.png (icoon voor meldingen).
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
const combined = app.replace(MARKER, () => "\n/* ===== CLOUD MODULE ===== */\n" + cloud + "\n\n" + MARKER);

// assets (base64)
const icons = {};
read("assets/icon_b64.txt").split(/\r?\n/).forEach(line => {
  const i = line.indexOf(":");
  if (i > 0) icons[line.slice(0, i)] = line.slice(i + 1).trim();
});
const font = read("assets/font_b64.txt").split(":").slice(1).join(":").trim();
["ICON180", "ICON512"].forEach(k => {
  if (!icons[k]) { console.error("✗ assets/icon_b64.txt mist regel " + k + ":<base64> — build gestopt."); process.exit(1); }
});

// supabase SDK (ingebakken UMD-bundle — voorkomt runtime CDN-fetch)
const supabaseSdkPath = path.join(root, "assets/supabase.js");
const supabaseSdk = fs.existsSync(supabaseSdkPath) ? read("assets/supabase.js") : "";
const sdkScript = supabaseSdk ? "<script>\n" + supabaseSdk + "\n</script>\n" : "";
if (!supabaseSdk) console.warn("! assets/supabase.js niet gevonden — Cloud valt terug op runtime CDN-fetch");

// Barcode-decoder (html5-qrcode) wordt lazy van CDN geladen bij de eerste scan
// (zie loadBarcodeDecoder in app.js) — niet ingebakken: de Open Food Facts-lookup
// vereist tóch internet, dus offline cachen van de decoder heeft geen nut.

// shell vullen — vervangingen via functie, zodat "$&"/"$'" in de bron niet als patroon wordt gelezen
let html = shell.replace("<!-- __SCRIPT__ -->", () => sdkScript + "<script>\n" + combined + "\n</script>");
html = html.replace("__ICON180__", () => icons.ICON180)
           .replace("__ICON512__", () => icons.ICON512)
           .replace("__FONT__", () => font);

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
const hash = crypto.createHash("sha1").update(html).update(swSrc).digest("hex").slice(0, 8);
const buildId = hash;
html = html.replace(/__BUILD__/g, buildId);

["__ICON180__", "__ICON512__", "__FONT__", "__SCRIPT__", "__BUILD__"].forEach(t => {
  if (html.indexOf(t) !== -1) { console.error("✗ Token niet vervangen: " + t); process.exit(1); }
});
// Guard alleen over de eigen bronnen (shell + app + cloud), niet over de vendor-SDK/base64-assets
assertClean(shell + combined, "index.html (eigen bronnen)");

// Alle harde controles vóór het eerste weggeschreven artefact, zodat index.html/sw.js/icoon nooit uit fase lopen
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const icon512 = Buffer.from(icons.ICON512, "base64");
if (icon512.length < 8 || !icon512.subarray(0, 8).equals(PNG_SIG)) {
  console.error("✗ ICON512 in assets/icon_b64.txt is geen geldige PNG — build gestopt.");
  process.exit(1);
}

fs.writeFileSync(path.join(root, "index.html"), html);
console.log("✓ index.html gebouwd (" + Buffer.byteLength(html) + " bytes, BUILD " + buildId + ")");

// Icoon als los PNG (voor push-meldingen: een notification-icon kan geen data-URI uit de shell zijn)
fs.writeFileSync(path.join(root, "icon-512.png"), icon512);
console.log("✓ icon-512.png geschreven (" + icon512.length + " bytes)");

// Service worker: BUILD-waarde injecteren + naar repo-root schrijven (scope = /mandje/ op GitHub Pages)
if (swSrc) {
  const sw = swSrc.replace(/__BUILD__/g, buildId);
  fs.writeFileSync(path.join(root, "sw.js"), sw);
  console.log("✓ sw.js gebouwd (cache mandje-" + buildId + ")");
} else {
  console.warn("! src/sw.js niet gevonden — service worker overgeslagen");
}
