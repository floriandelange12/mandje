/* Mandje — screenshot-matrix (ontwikkeltool; playwright moet lokaal aanwezig zijn).
   Gebruik: node tools/shots.js [basis-url] [map]   — standaard http://localhost:8765/index.html en qa_shots/f1
   Maakt per viewport × thema × staat een PNG. Seed-data gaat vóór het laden in localStorage. */
const fs = require("fs");
const path = require("path");
const BASE = process.argv[2] || "http://localhost:8765/index.html";
const OUT = process.argv[3] || path.join(__dirname, "..", "qa_shots", "f1");
const VIEWPORTS = [
  ["320x568", 320, 568], ["390x844", 390, 844], ["844x390", 844, 390],
  ["768x1024", 768, 1024], ["1024x768", 1024, 768], ["1366x768", 1366, 768]
];
const ONLY = (process.env.SHOTS_ONLY || "").split(",").filter(Boolean);   // bv. SHOTS_ONLY=1366x768,390x844
const THEMES = ["light", "dark"];
const now = new Date().toISOString();
const items = [
  ["appels", "groente-fruit", 3], ["bananen", "groente-fruit", 1], ["brood", "brood-banket", 1],
  ["melk", "zuivel-eieren", 2], ["eieren", "zuivel-eieren", 1], ["kaas jong belegen", "kaas-vleeswaren", 1],
  ["kipfilet", "vlees-vis", 1], ["pasta", "houdbaar", 2], ["pastasaus", "houdbaar", 1],
  ["chips", "snoep-snacks", 1], ["wc papier", "huishouden", 1], ["afwasmiddel", "huishouden", 1]
].map((r, i) => ({ id: "seed" + i, name: r[0], category: r[1], qty: r[2], unit: "", done: i === 3, note: i === 0 ? "liefst elstar" : "", price: null, assigned_to: null, added_by_name: "", addedAt: now }));
const settings = { theme: "auto", showPrices: false, seenIntro: true, seenBulkHint: true, seenQtyHint: true, seenPriceNudge: true, pushOn: false, collapsedCats: {}, customCategories: [], customCatEmoji: {} };
const seed = JSON.stringify({ version: 2, settings, list: items, catalog: {}, coBuy: {}, meals: [], syncQueue: [] });
const seedEmpty = JSON.stringify({ version: 2, settings, list: [], catalog: {}, coBuy: {}, meals: [], syncQueue: [] });

const STATES = {
  lijst:  { seed, run: async () => {} },
  leeg:   { seed: seedEmpty, run: async () => {} },
  sheet:  { seed, run: async p => { await p.click(".row .nm >> text=appels"); await p.waitForTimeout(450); } },
  winkel: { seed, run: async p => { await p.click(".shop-enter-btn"); await p.waitForTimeout(450); } },
  meer:   { seed, run: async p => { await p.click(".topbar .gear"); await p.waitForTimeout(450); } },
  vaste:  { seed, run: async p => { await p.click("text=Vaste"); await p.waitForTimeout(350); } }
};
const STATE_ONLY = (process.env.SHOTS_STATES || "").split(",").filter(Boolean);

(async function(){
  const pw = require("playwright");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch();
  let n = 0;
  for (const [vname, w, h] of VIEWPORTS) {
    if (ONLY.length && !ONLY.includes(vname)) continue;
    for (const theme of THEMES) {
      for (const [sname, st] of Object.entries(STATES)) {
        if (STATE_ONLY.length && !STATE_ONLY.includes(sname)) continue;
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: 1, serviceWorkers: "block", hasTouch: w < 768, isMobile: w < 768 });
        await ctx.addInitScript(s => { try { localStorage.setItem("mandje.v2", s); localStorage.removeItem("mandje.activeList"); } catch (e) {} }, st.seed);
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push(String(e && e.message || e)));
        await page.goto(BASE, { waitUntil: "load" });
        await page.waitForTimeout(500);
        try { await st.run(page); } catch (e) { errors.push("state " + sname + ": " + e.message); }
        const file = path.join(OUT, `${vname}-${theme}-${sname}.png`);
        await page.screenshot({ path: file, fullPage: false });
        n++;
        if (errors.length) console.log("! " + path.basename(file) + ": " + errors.join(" | "));
        await ctx.close();
      }
    }
  }
  await browser.close();
  console.log("✓ " + n + " screenshots → " + path.relative(process.cwd(), OUT));
})().catch(e => { console.error("✗ " + (e && e.stack || e)); process.exit(1); });
