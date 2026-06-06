const fs=require("fs"), {JSDOM}=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","index.html"),"utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0, fail=0;
const ok=(n,c)=>{ if(c){pass++;console.log("  ✓ "+n);} else {fail++;console.log("  ✗ FAIL: "+n);} };
(async()=>{
  // 1. add-bar: geen los prijsveld, type=search (tegen iOS contact-autofill)
  const dom=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc=dom.window.document;
  ok("Add-bar heeft GEEN los prijsveld", !doc.querySelector("#add-price"));
  ok("Invoerveld type=search", doc.querySelector("#add-name")?.getAttribute("type")==="search");
  const kids=[...doc.querySelector(".field").children].map(c=>c.tagName.toLowerCase()+(c.id?"#"+c.id:"")).join(",");
  ok("Veld = svg+input#add-name+button#add-btn ("+kids+")", kids==="svg,input#add-name,button#add-btn");
  ok("Tandwiel-knop aanwezig", !!doc.querySelector("#gear-btn"));
  ok("Slechts 2 tabs (Lijst/Vaste)", doc.querySelectorAll(".tabbar .tab").length===2);

  // 2. prijzen standaard UIT → snel toevoegen geeft prijs null, balk verborgen
  doc.querySelector("#add-name").value="Melk";
  doc.querySelector("#add-name").dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  await wait(40);
  ok("Item toegevoegd", doc.querySelectorAll("#open-list .row").length===1);
  ok("Prijs null bij snel toevoegen", JSON.parse(dom.window.localStorage.getItem("mandje.v2")).list[0].price===null);
  ok("Totaalsbalk verborgen (prijzen uit)", doc.querySelector("#totals").classList.contains("hide"));
  dom.window.close();

  // 3. prijzen AAN + item met prijs → balk zichtbaar, totaal klopt
  const dom2=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,
    beforeParse(w){ w.localStorage.setItem("mandje.v2",JSON.stringify({version:2,settings:{showPrices:true,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1,theme:"light"},list:[{id:"x1",name:"Kaas",category:"kaas-vleeswaren",qty:2,price:3.50,note:"",done:false,addedAt:""}],catalog:{}})); }});
  await wait(150); const doc2=dom2.window.document;
  ok("Totaalsbalk zichtbaar (prijzen aan)", !doc2.querySelector("#totals").classList.contains("hide"));
  ok("Totaal = €7,00 (2×3,50)", /7,00/.test(doc2.querySelector("#t-total").textContent));
  dom2.window.close();

  // 4. hint bij €0 met prijzen aan
  const dom3=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,
    beforeParse(w){ w.localStorage.setItem("mandje.v2",JSON.stringify({version:2,settings:{showPrices:true,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1,theme:"light"},list:[{id:"x1",name:"Kaas",category:"kaas-vleeswaren",qty:1,price:null,note:"",done:false,addedAt:""}],catalog:{}})); }});
  await wait(120); const doc3=dom3.window.document;
  const hint=doc3.querySelector("#t-hint");
  ok("Hint zichtbaar bij €0", hint && hint.style.display!=="none");
  dom3.window.close();

  // 5. typefout-tolerantie
  const dom4=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc4=dom4.window.document;
  doc4.querySelector("#add-name").value="Manderijn";
  doc4.querySelector("#add-name").dispatchEvent(new dom4.window.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  await wait(40);
  ok("'Manderijn' (typo) -> Groente & fruit", /Groente/.test([...doc4.querySelectorAll("#open-list .section")].map(s=>s.textContent).join("|")));
  dom4.window.close();

  // 6. Nieuwe non-food categorieën — auto-classifier
  const dom5=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc5=dom5.window.document;
  const cases=[
    ["Luiers",       /Baby/],
    ["Paracetamol",  /Apotheek/],
    ["Schroeven",    /Klussen/],
    ["Potgrond",     /Tuin/],
    ["Pennen",       /Kantoor/],
    ["Sokken",       /Kleding/],
    ["Hondenvoer",   /Huisdier/]
  ];
  for(const [item] of cases){
    doc5.querySelector("#add-name").value=item;
    doc5.querySelector("#add-name").dispatchEvent(new dom5.window.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
    await wait(15);
  }
  const sections5=[...doc5.querySelectorAll("#open-list .section")].map(s=>s.textContent).join("|");
  cases.forEach(([item,re])=>{
    ok("'"+item+"' → "+re.source.replace(/[\\\/]/g,""), re.test(sections5));
  });
  dom5.window.close();

  // 7. parseQtyFromInput
  const dom6=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const W=dom6.window;
  const cases6=[
    ["melk",          1, "melk"],
    ["melk 2",        2, "melk"],
    ["brood x3",      3, "brood"],
    ["Wc-papier 4",   4, "Wc-papier"],
    ["Heineken 0",    1, "Heineken 0"],
    ["Heineken 0.0",  1, "Heineken 0.0"]
  ];
  cases6.forEach(([raw, expQty, expName])=>{
    const r = W.parseQtyFromInput(raw);
    ok("parseQty('"+raw+"') → "+expQty+" / '"+expName+"'", r.qty===expQty && r.name===expName);
  });
  dom6.window.close();

  // 8. Bulk-paste voegt meerdere items toe met juiste qty
  const dom7=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc7=dom7.window.document;
  dom7.window.openBulkPasteSheet(); await wait(40);
  const bulkIn = doc7.querySelector("#bulk-input");
  bulkIn.value = "Melk\nBrood x2\nKaas\nWc-papier";
  doc7.querySelector("#bulk-go").click(); await wait(40);
  ok("Bulk: 4 items op de lijst", doc7.querySelectorAll("#open-list .row").length === 4);
  const stored7 = JSON.parse(dom7.window.localStorage.getItem("mandje.v2"));
  ok("Bulk: Brood heeft qty 2", (stored7.list.find(i => i.name === "Brood")||{}).qty === 2);
  dom7.window.close();

  // 9. Intro toont 3 dots + Volgende→Aan-de-slag op laatste stap
  const dom8=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc8=dom8.window.document;
  const dots = doc8.querySelectorAll("#sheet .intro-dots .id-dot");
  ok("Intro: 3 stages aanwezig", dots.length === 3);
  ok("Intro: stap 1 → Volgende-knop", !!doc8.querySelector("#intro-next"));
  doc8.querySelector("#intro-next").click(); await wait(20);
  doc8.querySelector("#intro-next").click(); await wait(20);
  ok("Intro: laatste stap → Aan-de-slag knop", !!doc8.querySelector("#intro-go"));
  dom8.window.close();

  // 10. Co-purchase tracking + suggesties
  const dom9=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const W9=dom9.window;
  W9.touchCatalog("Melk", null); W9.touchCatalog("Brood", null);
  W9.recordCoBuy(["Melk","Brood"]);
  W9.recordCoBuy(["Melk","Brood"]);
  W9.recordCoBuy(["Melk","Brood"]);
  const sugg = W9.getCoSuggestions("melk", 2);
  ok("CoBuy: melk→brood suggestie (3× samen)", sugg.length===1 && sugg[0].key==="brood" && sugg[0].count===3);
  const suggUnknown = W9.getCoSuggestions("onbekend", 2);
  ok("CoBuy: lege array voor onbekend item", Array.isArray(suggUnknown) && suggUnknown.length===0);
  dom9.window.close();

  // 11. Undo-toast bij removeFromList toont 'Ongedaan' actie + herstelt
  const dom10=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc10=dom10.window.document; const W10=dom10.window;
  doc10.querySelector("#add-name").value="Melk";
  doc10.querySelector("#add-name").dispatchEvent(new W10.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  await wait(30);
  const beforeRm = JSON.parse(W10.localStorage.getItem("mandje.v2")).list;
  const rmId = beforeRm[0].id;
  W10.removeFromList(rmId); await wait(30);
  const toastEl = doc10.querySelector("#toast");
  ok("Undo: toast heeft action-knop", !!toastEl.querySelector(".toast-action"));
  ok("Undo: action label = 'Ongedaan'", (toastEl.querySelector(".toast-action")||{}).textContent === "Ongedaan");
  toastEl.querySelector(".toast-action").click(); await wait(30);
  const afterUndo = JSON.parse(W10.localStorage.getItem("mandje.v2")).list;
  ok("Undo: item terug op de lijst", afterUndo.length===1 && afterUndo[0].name==="Melk");
  dom10.window.close();

  // 12. Auto-add: catalog-item met autoAdd + due → staat op de lijst na init
  const dom11=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem("mandje.v2", JSON.stringify({
        version:2,
        settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1,customCategories:[],customCatEmoji:{},collapsedCats:{}},
        list:[],
        catalog:{
          "melk":{name:"Melk",category:"zuivel-eieren",defaultPrice:1.29,
            purchaseDates:[dayStr(-21), dayStr(-14), dayStr(-7)],
            timesAdded:3, lastAddedAt:null, cadenceMode:"auto", manualIntervalDays:null,
            autoAdd:true}
        },
        coBuy:{}
      }));
    }
  });
  await wait(180);
  const stored11 = JSON.parse(dom11.window.localStorage.getItem("mandje.v2"));
  ok("Auto-add: Melk staat na init op de lijst", stored11.list.some(i => i.name === "Melk"));
  dom11.window.close();

  // 13. Section-collapse: chevron aanwezig + class toggle bij klik
  const dom12=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc12=dom12.window.document;
  doc12.querySelector("#add-name").value="Melk";
  doc12.querySelector("#add-name").dispatchEvent(new dom12.window.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  await wait(20);
  const secs = doc12.querySelectorAll("#open-list .section.collapsible");
  ok("Section: collapsible class aanwezig", secs.length >= 1);
  ok("Section: sec-chevron SVG aanwezig", !!secs[0].querySelector(".sec-chevron"));
  secs[0].click(); await wait(20);
  ok("Section: collapsed class na klik", secs[0].classList.contains("collapsed"));
  dom12.window.close();

  function dayStr(off){ const d=new Date(); d.setDate(d.getDate()+off); const p=n=>(n<10?"0":"")+n; return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }

  console.log("\nt3: "+pass+" geslaagd, "+fail+" gefaald");
  process.exit(fail?1:0);
})().catch(e=>{console.error("t3 TESTFOUT:",e);process.exit(2)});
