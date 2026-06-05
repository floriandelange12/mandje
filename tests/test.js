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
    const vasteTab = [...doc.querySelectorAll(".tab")].find(b=>b.dataset.tab==="vaste");
    fire(vasteTab, "click"); await wait(40);
    const vasteTxt = doc.querySelector("#vaste-content").textContent;
    ok("Vaste-tab toont Melk", /Melk/.test(vasteTxt));
    ok("Vaste-tab toont ritme-uitleg", /(wekelijks|elke|dagen)/i.test(vasteTxt));

    dom.window.close();
  }

  console.log("\n──────────────────────────────");
  console.log("RESULTAAT: "+pass+" geslaagd, "+fail+" gefaald");
  process.exit(fail ? 1 : 0);
}

run().catch(e=>{ console.error("TESTFOUT:", e); process.exit(2); });
