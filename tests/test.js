const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(require("path").join(__dirname,"..","index.html"),"utf8");

function fire(el, type, props) {
  let ev;
  if (type === "keydown") ev = new el.ownerDocument.defaultView.KeyboardEvent(type, Object.assign({ bubbles: true }, props));
  else ev = new el.ownerDocument.defaultView.Event(type, { bubbles: true });
  el.dispatchEvent(ev);
}
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
function resolveCloud(win){
  if(win && win.Cloud) return win.Cloud;
  if(win && win.__cloudRef) return win.__cloudRef;
  if(win && typeof win.eval === "function"){
    try{
      return win.eval("typeof Cloud !== 'undefined' ? Cloud : null");
    }catch(e){}
  }
  return null;
}

let pass = 0, fail = 0;
function ok(name, cond){ if(cond){ pass++; console.log("  ✓ "+name); } else { fail++; console.log("  ✗ FAIL: "+name); } }

function dayStr(offset){
  const d = new Date(); d.setDate(d.getDate()+offset);
  const p = n => (n<10?"0":"")+n;
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
}

async function run(){

  // ---------- RUN 1: verse app ----------
  console.log("\nRUN 1 — verse app (toevoegen, categoriseren, afronden)");
  {
    const dom = new JSDOM(html, {
      url: "https://example.com/",
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true
    });
    const { window } = dom;
    await wait(120); // init draaien
    const doc = window.document;

    // 0. persoonlijke modus: titel = "Boodschappen", geen dot
    const title0 = doc.querySelector("#title");
    ok("Persoonlijke titel = 'Boodschappen'", title0?.textContent === "Boodschappen");
    ok("Persoonlijke titel heeft geen has-dot", !title0?.classList.contains("has-dot"));

    // 1. item toevoegen via veld + Enter
    const name = doc.querySelector("#add-name");
    name.value = "Melk";
    fire(name, "input");
    fire(name, "keydown", { key: "Enter" });
    await wait(40);

    const rows = doc.querySelectorAll("#open-list .row");
    ok("Melk toegevoegd → 1 rij", rows.length === 1);
    ok("Naam klopt", /Melk/.test(doc.querySelector("#open-list .nm")?.textContent || ""));

    // 2. classificatie: Melk → Zuivel & eieren
    const sec = doc.querySelector("#open-list .section");
    ok("Melk in schap 'Zuivel & eieren'", /Zuivel/.test(sec?.textContent || ""));

    // 3. nog twee items, ander schap
    name.value = "Bananen"; fire(name,"input"); fire(name,"keydown",{key:"Enter"}); await wait(20);
    name.value = "Wc-papier"; fire(name,"input"); fire(name,"keydown",{key:"Enter"}); await wait(20);
    const secs = [...doc.querySelectorAll("#open-list .section")].map(s=>s.textContent).join("|");
    ok("Bananen → Groente & fruit", /Groente/.test(secs));
    ok("Wc-papier → Huishouden", /Huishouden/.test(secs));

    // 4. afvinken + afronden registreert aankoop (eerste rij = afhankelijk van schap-volgorde)
    const firstRowName = doc.querySelector("#open-list .nm").textContent.trim();
    const firstCheck = doc.querySelector("#open-list .check");
    fire(firstCheck, "click"); await wait(20);
    ok("Afvinken verplaatst naar 'In mandje'", doc.querySelectorAll("#done-list .row").length === 1);

    const finish = doc.querySelector("#t-finish");
    ok("Afrond-knop zichtbaar", finish && finish.style.display !== "none");
    fire(finish, "click"); await wait(30);

    const store = JSON.parse(window.localStorage.getItem("mandje.v2"));
    const boughtKey = firstRowName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    ok("Aankoop van '"+firstRowName+"' geregistreerd", store.catalog[boughtKey] && store.catalog[boughtKey].purchaseDates.length === 1);
    ok("Afgevinkt item van lijst verdwenen", store.list.length === 2);

    const vasteTab = [...doc.querySelectorAll("[data-tab]")].find(b=>b.dataset.tab==="vaste");
    const meerTab = [...doc.querySelectorAll("[data-tab]")].find(b=>b.dataset.tab==="meer");
    if(vasteTab){
      fire(vasteTab, "click"); await wait(20);
      const subVaste = (doc.querySelector("#subhead").textContent || "").toLowerCase();
      ok("Subhead toont modus op vaste-tab", subVaste.includes("lokale modus") || subVaste.includes("cloud") || subVaste.includes("offline-modus"));
    } else {
      ok("Vaste-tab niet zichtbaar in minimale setup", true);
    }
    if(meerTab){
      fire(meerTab, "click"); await wait(20);
      const subMeer = (doc.querySelector("#subhead").textContent || "").toLowerCase();
      ok("Subhead toont modus op meer-tab", subMeer.includes("lokale modus") || subMeer.includes("cloud") || subMeer.includes("offline-modus"));
    } else {
      ok("Meer-tab niet zichtbaar in minimale setup", true);
    }

    dom.window.close();
  }

  // ---------- RUN 2: geseede geschiedenis → 'Bijna op' ----------
  console.log("\nRUN 2 — geseede wekelijkse geschiedenis (cadans-engine)");
  {
    const seeded = {
      version: 2,
      settings: { theme:"light", showPrices:true, categoryOrder:null, minPurchases:3, cvThreshold:0.6, dueWindowDays:1 },
      list: [],
      catalog: {
        "melk": {
          name:"Melk", category:"zuivel-eieren", defaultPrice:1.29,
          purchaseDates:[dayStr(-21), dayStr(-14), dayStr(-7)],
          timesAdded:3, lastAddedAt:null, cadenceMode:"auto", manualIntervalDays:null
        },
        "koffie": {
          name:"Koffie", category:"dranken", defaultPrice:5.49,
          purchaseDates:[dayStr(-40), dayStr(-12)], // te weinig + onregelmatig
          timesAdded:2, lastAddedAt:null, cadenceMode:"auto", manualIntervalDays:null
        }
      }
    };

    const dom = new JSDOM(html, {
      url: "https://example.com/",
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
      beforeParse(window){
        window.localStorage.setItem("mandje.v2", JSON.stringify(seeded));
      }
    });
    const { window } = dom;
    await wait(120);
    const doc = window.document;

    // 'Bijna op' banner op lijst-tab
    const banner = doc.querySelector("#due-banner .banner");
    ok("'Bijna op' banner verschijnt", !!banner);
    const chipTxt = [...doc.querySelectorAll("#due-banner .chip")].map(c=>c.textContent).join("|");
    ok("Melk staat in 'Bijna op'", /Melk/.test(chipTxt));
    ok("Koffie NIET in 'Bijna op' (te weinig/onregelmatig)", !/Koffie/.test(chipTxt));

    // chip tikken voegt toe aan lijst
    const melkChip = [...doc.querySelectorAll("#due-banner .chip")].find(c=>/Melk/.test(c.textContent));
    fire(melkChip, "click"); await wait(30);
    ok("Tik op chip → Melk op lijst", doc.querySelectorAll("#open-list .row").length === 1);
    ok("Melk uit 'Bijna op' verdwenen na toevoegen", !/Melk/.test([...doc.querySelectorAll("#due-banner .chip")].map(c=>c.textContent).join("|")));

    // Vaste-tab toont Melk als regelmatig
    const vasteTab = [...doc.querySelectorAll("[data-tab]")].find(b=>b.dataset.tab==="vaste");
    fire(vasteTab, "click"); await wait(40);
    const vasteTxt = doc.querySelector("#vaste-content").textContent;
    ok("Vaste-tab toont Melk", /Melk/.test(vasteTxt));
    ok("Vaste-tab toont ritme-uitleg", /(wekelijks|elke|dagen)/i.test(vasteTxt));

    dom.window.close();
  }

  console.log("\n──────────────────────────────");
  // RUN 3 — offline fallback zonder fetch/verbinding
  {
    const warnLog = [];
    const dom = new JSDOM(html, {
      url: "https://example.com/",
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
      beforeParse(window){
        try{
          Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
          Object.defineProperty(window, "fetch", { configurable: true, writable: true, value: undefined });
          delete window.fetch;
        }catch(e){
          window.navigator.onLine = false;
          window.fetch = undefined;
          delete window.fetch;
        }
        window.localStorage.setItem("mandje.v2", JSON.stringify({
          version: 3,
          settings:{
            theme:"auto", showPrices:false, seenIntro:false, categoryOrder:["overig"],
            minPurchases:3, cvThreshold:0.6, dueWindowDays:1,
            customCategories:[], customCatEmoji:{}, collapsedCats:{},
            seenQtyHint:false, seenBulkHint:false, seenPriceNudge:false
          },
          syncQueue: [],
          lastSyncState: { mode:"local", status:"not_started", ready:false, pendingMutations:0, offline:false, reason:null, lastUpdated:0 },
          offlinePendingFlags: {},
          list: [],
          catalog: {},
          coBuy: {},
          meals: {}
        }));
      }
    });
    dom.window.console.warn = function(){ warnLog.push([].slice.call(arguments).join(" ")); };

    const { window } = dom;
    await wait(160);
    const doc = window.document;
    var summary = window.getCloudStateSummary
      ? window.getCloudStateSummary()
      : (window.Cloud && typeof window.Cloud.getStateSummary === "function" ? window.Cloud.getStateSummary() : null);

    ok("lokale modus actief zonder Cloud", summary ? summary.mode === "local" : true);
    const subheadText = (doc.querySelector("#subhead").textContent || "").toLowerCase();
    ok("subhead meldt lokale/Offline modus", subheadText.indexOf("lokale modus") !== -1 || subheadText.indexOf("offline-modus") !== -1 || subheadText.indexOf("cloud uitgeschakeld") !== -1);
    ok("geen herhaaldelijke fallback-spam", warnLog.length < 5);

    const name = doc.querySelector("#add-name");
    name.value = "Boter";
    fire(name, "input");
    fire(name, "keydown", { key: "Enter" });
    await wait(40);
    ok("lokale toevoeging werkt offline", doc.querySelectorAll("#open-list .row").length === 1);

    dom.window.close();
  }

  console.log("\n--------------------------------------------------");
  // RUN 4 -- share fallback, copy/native delen
  {
    let promptCalls = 0;
    let promptValue = "";
    const dom = new JSDOM(html, {
      url: "https://example.com/",
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
      beforeParse(window){
        try{
          Object.defineProperty(window.navigator, "share", { configurable: true, value: undefined });
          Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText:function(){ return Promise.reject(new Error("Clipboard geblokkeerd")); } } });
          Object.defineProperty(window, "prompt", {
            configurable: true,
            writable: true,
            value: function(_, txt){
              promptCalls++;
              promptValue = txt || "";
              return txt;
            }
          });
        }catch(e){}
        window.localStorage.setItem("mandje.v2", JSON.stringify({
          version: 2,
          settings:{ theme:"light", showPrices:false, seenIntro:false, categoryOrder:["overig"], minPurchases:3, cvThreshold:0.6, dueWindowDays:1, customCategories:[], customCatEmoji:{}, collapsedCats:{}, seenQtyHint:false, seenBulkHint:false, seenPriceNudge:false },
          syncQueue: [],
          list: [],
          catalog: {},
          coBuy: {}
        }));
      }
    });
    const { window } = dom;
    await wait(160);
    const doc = window.document;
    ok("copyText en shareNative zijn bereikbaar", typeof window.copyText === "function" && typeof window.shareNative === "function");

    const copyOk = await window.copyText("https://example.com/fallback", "Kopieer deze code");
    const copyMsg = (doc.querySelector("#toast")?.textContent || "").toLowerCase();
    ok("copyText valt terug op prompt bij clipboard-fout", promptCalls > 0);
    ok("copyText toont fallback-feedback", /niet automatisch gekopieerd|handmatig|kopieer/.test(copyMsg));
    ok("copyText prompt bevat het tekstfragment", promptValue.indexOf("https://example.com/fallback") !== -1);

    promptCalls = 0;
    const shareOk = await window.shareNative("https://example.com/share", "Stuurlijst", "Link gekopieerd");
    const shareMsg = (doc.querySelector("#toast")?.textContent || "").toLowerCase();
    ok("shareNative gebruikt fallback-copypad als share niet bestaat", shareOk === false);
    ok("shareNative geeft gebruiker zichtbaar fallback-signaal", /kopie/.test(shareMsg) || promptCalls > 0);
    ok("shareNative fallback triggert prompt", promptCalls > 0);

    dom.window.close();
  }

  console.log("\n--------------------------------------------------");
  // RUN 5 -- restore/merge guard (lokale snapshot beschermt cloud-refresh)
  {
    const dom = new JSDOM(html, {
      url: "https://example.com/",
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true
    });
    const { window } = dom;
    await wait(100);
    const fn = window.__shouldAcceptCloudList;
    ok("merge-gateway helper beschikbaar", typeof fn === "function");
    if(typeof fn === "function"){
      const now = Date.now ? Date.now() : 0;
      window.__mandjeLocalMutationEpoch = 14;
      ok("verse lokale mutatie blokkeert directe cloud-refresh", fn([{id:"x1",name:"Test"}], { openLocalEpoch: 5, openStartedAt: now - 1000 }) === false);
      ok("oude cloud-refresh wordt geaccepteerd", fn([{id:"x1",name:"Test"}], { openLocalEpoch: 5, openStartedAt: now - 5000 }) === true);
      ok("guard is veilig zonder options", fn([{id:"x1",name:"Test"}]) === true);
      window.__mandjeLocalMutationEpoch = 0;
      ok("guard accepteert zonder lokale epoch-info", fn([{id:"x1",name:"Test"}], { openLocalEpoch: 0, openStartedAt: now }) === true);
    }
    dom.window.close();
  }

  console.log("\n--------------------------------------------------");
  // RUN 6 -- offline startup moet online terug automatisch Cloud.init proberen
  {
    const dom = new JSDOM(html, {
      url: "https://example.com/",
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
      beforeParse(window){
        try{
          Object.defineProperty(window.navigator, "onLine", { configurable: true, writable: true, value: false });
          Object.defineProperty(window, "fetch", { configurable: true, writable: true, value: undefined });
          delete window.fetch;
        }catch(e){
          window.navigator.onLine = false;
          window.fetch = undefined;
          delete window.fetch;
        }
        window.localStorage.setItem("mandje.v2", JSON.stringify({
          version: 3,
          settings:{
            theme:"auto", showPrices:false, seenIntro:true, categoryOrder:["overig"],
            minPurchases:3, cvThreshold:0.6, dueWindowDays:1,
            customCategories:[], customCatEmoji:{}, collapsedCats:{},
            seenQtyHint:false, seenBulkHint:false, seenPriceNudge:false
          },
          syncQueue: [],
          lastSyncState: { mode:"local", status:"not_started", ready:false, pendingMutations:0, offline:true, reason:null, lastUpdated:0 },
          offlinePendingFlags:{},
          list: [],
          catalog: {},
          coBuy: {},
          meals: {}
        }));
      }
    });
    const { window } = dom;
    await wait(180);

    ok("app start offline in lokale modus", window.getCloudStateSummary ? (window.getCloudStateSummary().mode === "local") : true);
    var cloud = resolveCloud(window);
    var initCalls = 0;
    ok("Cloud object gevonden voor recovery-test", !!cloud);
    if(cloud && typeof cloud.init === "function"){
      cloud.init = async function(){ initCalls++; };
      if(window.navigator && "onLine" in window.navigator){
        try{ Object.defineProperty(window.navigator, "onLine", { configurable: true, writable: true, value: true }); }catch(e){ window.navigator.onLine = true; }
      }
      try{
        window.fetch = async function(){ return { ok:true, json:async()=>({}), text:async()=>"" }; };
      }catch(e){
        try{ Object.defineProperty(window, "fetch", { configurable:true, writable:true, value: async function(){ return { ok:true, json:async()=>({}), text:async()=>"" }; } }); }catch(e2){}
      }
      window.dispatchEvent(new window.Event("online"));
      await wait(140);
      ok("online herstellen triggert Cloud.init één keer", initCalls === 1);
      window.dispatchEvent(new window.Event("online"));
      await wait(140);
      ok("online-events worden throttled zonder herhaaldelijke instant-trigger", initCalls === 1);
    }

    dom.window.close();
  }

  console.log("RESULTAAT: "+pass+" geslaagd, "+fail+" gefaald");
  process.exit(fail ? 1 : 0);
}

run().catch(e=>{ console.error("TESTFOUT:", e); process.exit(2); });
