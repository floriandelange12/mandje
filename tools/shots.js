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
  winkel2:{ seed, run: async p => { await p.click(".shop-enter-btn"); await p.waitForTimeout(450); const rows=await p.$$(".shop-row"); for(const r of rows.slice(0,3)){ await r.click(); await p.waitForTimeout(120); } await p.waitForTimeout(400); } },
  meer:   { seed, run: async p => { await p.click(".topbar .gear"); await p.waitForTimeout(450); } },
  vaste:  { seed, run: async p => { await p.click("text=Vaste"); await p.waitForTimeout(350); } },
  klaar:  { seed, run: async p => { await p.evaluate(() => { const cs=document.querySelectorAll("#open-list .check"); for(let i=0;i<3 && i<cs.length;i++) cs[i].click(); }); await p.waitForTimeout(600); await p.evaluate(() => window.finishShopping()); await p.waitForTimeout(700); } },
  leegqs: { seed: (() => { const o=JSON.parse(seed); o.list=[]; o.history=[{id:"h1",at:new Date().toISOString(),count:3,total:null,paid:null,list:"local",items:[{name:"melk",qty:1,unit:"",price:null,category:"zuivel-eieren"},{name:"brood",qty:1,unit:"",price:null,category:"brood-banket"},{name:"eieren",qty:1,unit:"",price:null,category:"zuivel-eieren"}]}]; o.catalog={melk:{name:"Melk",category:"zuivel-eieren",defaultPrice:null,purchaseDates:[],timesAdded:5,lastAddedAt:new Date().toISOString(),cadenceMode:"auto",manualIntervalDays:null},brood:{name:"Brood",category:"brood-banket",defaultPrice:null,purchaseDates:[],timesAdded:4,lastAddedAt:new Date().toISOString(),cadenceMode:"auto",manualIntervalDays:null},eieren:{name:"Eieren",category:"zuivel-eieren",defaultPrice:null,purchaseDates:[],timesAdded:3,lastAddedAt:new Date().toISOString(),cadenceMode:"auto",manualIntervalDays:null}}; return JSON.stringify(o); })(), run: async () => {} },
  winkels:{ seed: (() => { const o=JSON.parse(seed); const d=(n)=>{ const x=new Date(); x.setDate(x.getDate()-n); return x.toISOString().slice(0,10); }; const dates=[]; for(let i=1;i<=8;i++) dates.push(d(7*i)); o.list=o.list.slice(0,2); o.catalog={melk:{name:"Melk",category:"zuivel-eieren",defaultPrice:null,purchaseDates:dates.sort(),timesAdded:8,lastAddedAt:new Date().toISOString(),cadenceMode:"auto",manualIntervalDays:null},brood:{name:"Brood",category:"brood-banket",defaultPrice:null,purchaseDates:[d(7),d(14)],timesAdded:4,lastAddedAt:new Date().toISOString(),cadenceMode:"auto",manualIntervalDays:null}}; o.history=[{id:"h1",at:new Date().toISOString(),count:3,total:null,paid:null,list:"local",items:[{name:"melk",qty:1,unit:"",price:null,category:"zuivel-eieren"},{name:"brood",qty:1,unit:"",price:null,category:"brood-banket"},{name:"eieren",qty:1,unit:"",price:null,category:"zuivel-eieren"}]}]; o.settings.stores=[{id:"st_ah",name:"AH Stationsstraat",order:[]},{id:"st_lidl",name:"Lidl",order:[]}]; o.settings.activeStoreId="st_ah"; return JSON.stringify(o); })(), run: async () => {} },
  meerwk: { seed: (() => { const o=JSON.parse(seed); const d=(n)=>{ const x=new Date(); x.setDate(x.getDate()-n); return x.toISOString().slice(0,10); }; const dates=[]; for(let i=1;i<=8;i++) dates.push(d(7*i)); o.list=o.list.slice(0,2); o.catalog={melk:{name:"Melk",category:"zuivel-eieren",defaultPrice:null,purchaseDates:dates.sort(),timesAdded:8,lastAddedAt:new Date().toISOString(),cadenceMode:"auto",manualIntervalDays:null},brood:{name:"Brood",category:"brood-banket",defaultPrice:null,purchaseDates:[d(7),d(14)],timesAdded:4,lastAddedAt:new Date().toISOString(),cadenceMode:"auto",manualIntervalDays:null}}; o.history=[{id:"h1",at:new Date().toISOString(),count:3,total:null,paid:null,list:"local",items:[{name:"melk",qty:1,unit:"",price:null,category:"zuivel-eieren"},{name:"brood",qty:1,unit:"",price:null,category:"brood-banket"},{name:"eieren",qty:1,unit:"",price:null,category:"zuivel-eieren"}]}]; o.settings.stores=[{id:"st_ah",name:"AH Stationsstraat",order:[]},{id:"st_lidl",name:"Lidl",order:[]}]; o.settings.activeStoreId="st_ah"; return JSON.stringify(o); })(), run: async p => { await p.click(".topbar .gear"); await p.waitForTimeout(450); await p.evaluate(() => { const s=[...document.querySelectorAll("#meer-content .section")].find(x=>/winkels/i.test(x.textContent)); if(s) s.scrollIntoView(); }); await p.waitForTimeout(200); } },
  catbeheer:{ seed: (() => { const o=JSON.parse(seed); const d=(n)=>{ const x=new Date(); x.setDate(x.getDate()-n); return x.toISOString().slice(0,10); }; const dates=[]; for(let i=1;i<=8;i++) dates.push(d(7*i)); o.list=o.list.slice(0,2); o.catalog={melk:{name:"Melk",category:"zuivel-eieren",defaultPrice:null,purchaseDates:dates.sort(),timesAdded:8,lastAddedAt:new Date().toISOString(),cadenceMode:"auto",manualIntervalDays:null},brood:{name:"Brood",category:"brood-banket",defaultPrice:null,purchaseDates:[d(7),d(14)],timesAdded:4,lastAddedAt:new Date().toISOString(),cadenceMode:"auto",manualIntervalDays:null}}; o.history=[{id:"h1",at:new Date().toISOString(),count:3,total:null,paid:null,list:"local",items:[{name:"melk",qty:1,unit:"",price:null,category:"zuivel-eieren"},{name:"brood",qty:1,unit:"",price:null,category:"brood-banket"},{name:"eieren",qty:1,unit:"",price:null,category:"zuivel-eieren"}]}]; o.settings.stores=[{id:"st_ah",name:"AH Stationsstraat",order:[]},{id:"st_lidl",name:"Lidl",order:[]}]; o.settings.activeStoreId="st_ah"; return JSON.stringify(o); })(), run: async p => { await p.evaluate(() => window.openCatalogSheet()); await p.waitForTimeout(400); await p.click("#sheet .cm-more"); await p.waitForTimeout(250); } }
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
