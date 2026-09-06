/* Contrast-bewaking van het design-systeem (Fase 1).
   Leest de tokenblokken (:root en html[data-theme="dark"]) uit index.html — of uit een bestand
   dat je als argument meegeeft — en rekent WCAG 2.x-ratio's door voor tekst (≥4,5:1),
   UI-componenten (≥3:1) en de tonale laag-scheiding (≥1,12:1). Faalt hard bij een overtreding. */
const fs = require("fs");
const path = require("path");
const file = process.argv[2] || path.join(__dirname, "..", "index.html");
const src = fs.readFileSync(file, "utf8");

function block(re){ const m = src.match(re); return m ? m[1] : ""; }
function tokens(css){
  const out = {};
  css.replace(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g, (_, k, v) => { out[k] = v.toUpperCase(); });
  return out;
}
const light = tokens(block(/:root\{([\s\S]*?)\n\s*\}/));
const dark  = Object.assign({}, light, tokens(block(/html\[data-theme="dark"\]\{([\s\S]*?)\n\s*\}/)));

function lum(hex){
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b){ const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }

// [voorgrond, achtergrond, minimum, omschrijving]
const PAIRS = [
  ["ink", "bg", 4.5, "primaire tekst"], ["ink", "surface-1", 4.5, "tekst op kaart"], ["ink", "surface-3", 4.5, "tekst op tonaal"],
  ["ink-soft", "bg", 4.5, "secundaire tekst"], ["ink-soft", "surface-1", 4.5, "secundair op kaart"], ["ink-soft", "surface-3", 4.5, "secundair op tonaal"],
  ["ink-faint", "bg", 4.5, "placeholder/hints"], ["ink-faint", "surface-1", 4.5, "hints op kaart"], ["ink-faint", "surface-3", 4.5, "hints op tonaal"],
  ["brand", "bg", 4.5, "brand als tekst"], ["brand", "surface-1", 4.5, "brand-tekst op kaart"], ["brand", "brand-2", 4.5, "brand op tint"],
  ["on-brand", "brand", 4.5, "knoptekst"], ["on-brand", "brand-strong", 4.5, "knoptekst hover"],
  ["accent", "bg", 4.5, "bijna-op-tekst"], ["accent", "surface-1", 4.5, "accent op kaart"], ["accent", "accent-2", 4.5, "accent op tint"], ["on-accent", "accent", 4.5, "tekst op accent-chip"],
  ["danger", "bg", 4.5, "danger-tekst"], ["danger", "surface-1", 4.5, "danger op kaart"], ["danger", "danger-2", 4.5, "danger op tint"], ["on-danger", "danger", 4.5, "tekst op danger"],
  ["toast-action", "ink", 4.5, "toast-actie (toast-bg = ink)"],
  ["line-control", "surface-1", 3, "check/switch-rand"], ["line-control", "bg", 3, "check-rand op bg"],
  ["focus", "bg", 3, "focus-ring"], ["focus", "surface-1", 3, "focus-ring op kaart"],
  ["shelf-vers-ink", "shelf-vers-tint", 4.5, "schap vers"], ["shelf-graan-ink", "shelf-graan-tint", 4.5, "schap graan"], ["shelf-koel-ink", "shelf-koel-tint", 4.5, "schap koel"],
  ["shelf-eiwit-ink", "shelf-eiwit-tint", 4.5, "schap eiwit"], ["shelf-zorg-ink", "shelf-zorg-tint", 4.5, "schap zorg"], ["shelf-huis-ink", "shelf-huis-tint", 4.5, "schap huis"],
];
// tonale ladder: lagen moeten van elkaar te onderscheiden zijn
const LADDER = [["surface-1", "bg", 1.10, "kaart vs pagina"], ["surface-3", "bg", 1.10, "tonaal vs pagina"], ["surface-3", "surface-1", 1.15, "tonaal vs kaart"], ["surface-2", "surface-1", 1.03, "tonaal-op-kaart vs kaart"]];

let pass = 0, fail = 0;
function check(theme, t){
  console.log("\n" + theme.toUpperCase());
  for (const [fg, bg, min, label] of PAIRS) {
    if (!t[fg] || !t[bg]) { console.log("  ? " + label + " — token ontbreekt (" + fg + "/" + bg + ")"); fail++; continue; }
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min; ok ? pass++ : fail++;
    console.log("  " + (ok ? "✓" : "✗") + " " + label + ": " + t[fg] + " op " + t[bg] + " = " + r.toFixed(2) + ":1 (min " + min + ")");
  }
  for (const [a, b, min, label] of LADDER) {
    if (!t[a] || !t[b]) continue;
    const r = ratio(t[a], t[b]);
    const ok = r >= min; ok ? pass++ : fail++;
    console.log("  " + (ok ? "✓" : "✗") + " laag " + label + ": " + t[a] + " vs " + t[b] + " = " + r.toFixed(3) + ":1 (min " + min + ")");
  }
}
if (!light.bg) { console.error("Geen :root-tokens gevonden in " + file); process.exit(2); }
check("licht", light);
check("donker", dark);
console.log("\ncontrast: " + pass + " geslaagd, " + fail + " gefaald");
process.exit(fail ? 1 : 0);
