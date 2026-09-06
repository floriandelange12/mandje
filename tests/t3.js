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
  ok("Veld bevat input#add-name + button#add-btn", !!doc.querySelector(".field #add-name") && !!doc.querySelector(".field #add-btn"));
  ok("Veld heeft geen los prijsveld", !doc.querySelector(".field #add-price") && !doc.querySelector(".field .pricein"));
  ok("Tandwiel-knop aanwezig", !!doc.querySelector("#gear-btn"));
  ok("Lijst/Vaste-segment heeft 2 knoppen", doc.querySelectorAll(".view-seg [data-tab]").length===2);

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
    ["melk",          1, "melk",        undefined],
    ["melk 2",        2, "melk",        undefined],
    ["brood x3",      3, "brood",       undefined],
    ["Wc-papier 4",   4, "Wc-papier",   undefined],
    ["Heineken 0",    1, "Heineken 0",  undefined],
    ["Heineken 0.0",  1, "Heineken 0.0",undefined],
    // eenheid-parsing (prefix + suffix), qty blijft 1
    ["500 g gehakt",  1, "gehakt",      "500 g"],
    ["2 liter melk",  1, "melk",        "2 liter"],
    ["1 kg aardappels",1,"aardappels",  "1 kg"],
    ["melk 2 liter",  1, "melk",        "2 liter"],
    ["gehakt 500g",   1, "gehakt",      "500 g"]
  ];
  cases6.forEach(([raw, expQty, expName, expUnit])=>{
    const r = W.parseQtyFromInput(raw);
    const unitOk = expUnit===undefined ? !r.unit : r.unit===expUnit;
    ok("parseQty('"+raw+"') → "+expQty+" / '"+expName+"'"+(expUnit?(" / "+expUnit):""), r.qty===expQty && r.name===expName && unitOk);
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
  ok("Intro: 4 stages aanwezig (demo, vaste, samen, startchips)", dots.length === 4);
  ok("Intro: stap 1 → Volgende-knop", !!doc8.querySelector("#intro-next"));
  doc8.querySelector("#intro-next").click(); await wait(20);
  doc8.querySelector("#intro-next").click(); await wait(20);
  doc8.querySelector("#intro-next").click(); await wait(20);
  ok("Intro: laatste stap → Aan-de-slag knop + vaak-gekochte chips", !!doc8.querySelector("#intro-go") && doc8.querySelectorAll("#intro-chips .chip").length===8);
  doc8.querySelector("#intro-chips .chip").click(); await wait(40);
  ok("Intro: chip tikken zet het product op de lijst", doc8.querySelectorAll("#open-list li.row").length===1 && doc8.querySelector("#intro-chips .chip").classList.contains("on"));
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

  // 14. Iteratie 4 — Copy warmer: 'Je mandje is leeg' ipv 'Niets op de lijst'
  const dom13=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc13=dom13.window.document;
  ok("Copy: lege subhead zegt 'Je mandje is leeg'", (doc13.querySelector("#subhead")?.textContent||"").indexOf("Je mandje is leeg") !== -1);
  dom13.window.close();

  // 15. Intro toont 'Sla over'-knop op stage 1
  const dom14=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc14=dom14.window.document;
  ok("Intro: Sla over-knop aanwezig", !!doc14.querySelector("#intro-skip"));
  doc14.querySelector("#intro-skip").click(); await wait(30);
  ok("Intro: sluit na 'Sla over'-tap", !doc14.querySelector("#sheet").classList.contains("show"));
  dom14.window.close();

  // 16. Add-bar position: floating fixed onderaan
  const dom15=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc15=dom15.window.document;
  const aw = doc15.querySelector("#addwrap");
  const pos = dom15.window.getComputedStyle(aw).position;
  ok("Add-bar floating onderaan (position:fixed)", pos === "fixed");
  dom15.window.close();

  // 17. Vergeten-chip verschijnt na co-buy + done item
  const dom16=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const W16=dom16.window; const doc16=dom16.window.document;
  // 3x melk+brood samen gekocht in catalog
  W16.touchCatalog("Melk", null); W16.touchCatalog("Brood", null);
  W16.recordCoBuy(["Melk","Brood"]); W16.recordCoBuy(["Melk","Brood"]); W16.recordCoBuy(["Melk","Brood"]);
  // Voeg melk toe en vink af
  doc16.querySelector("#add-name").value = "Melk";
  doc16.querySelector("#add-name").dispatchEvent(new W16.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  await wait(30);
  const check = doc16.querySelector("#open-list .check");
  if(check) check.click();
  await wait(30);
  // Trigger render via showPrices = true zodat totals zichtbaar wordt + vergeten-chip render
  const stored16 = JSON.parse(W16.localStorage.getItem("mandje.v2"));
  stored16.settings.showPrices = true;
  W16.localStorage.setItem("mandje.v2", JSON.stringify(stored16));
  // Force re-render
  W16.updateTotals && W16.updateTotals();
  await wait(30);
  // Forgot-row bestaat met brood-pill
  const forgot = doc16.querySelector("#t-forgot");
  ok("Forgot-row element aanwezig", !!forgot);
  dom16.window.close();

  // 18. Iteratie 5 — visualViewport keyboard-fix: alleen --kb-lift + kb-open class, GEEN .app transform
  const dom17=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const W17=dom17.window; const doc17=dom17.window.document;
  // Simuleer een visualViewport met gekrompen hoogte (toetsenbord open)
  if(!W17.visualViewport){
    W17.visualViewport = { height: W17.innerHeight, offsetTop:0, addEventListener:function(){}, removeEventListener:function(){} };
  }
  // forceer kb-lift via de publieke hook als die bestaat; anders check dat .app GEEN transform heeft
  const appEl = doc17.querySelector("#app");
  ok("Keyboard-fix: .app krijgt geen transform meer", !appEl.style.transform);
  ok("Keyboard-fix: --kb-lift CSS-var bestaat in stylesheet (addwrap gebruikt 'm)", html.indexOf("--kb-lift")!==-1);
  dom17.window.close();

  // 19. Send-sheet titel-update behoudt input (geen volledige re-render)
  const dom18=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150);
  ok("Send-sheet heeft #sc-title node voor titel-only update", html.indexOf('id="sc-title"')!==-1);
  dom18.window.close();

  // 20. Afrond-knop verschijnt onderaan de in-mandje-sectie
  const dom19=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc19=dom19.window.document;
  doc19.querySelector("#add-name").value="Melk";
  doc19.querySelector("#add-name").dispatchEvent(new dom19.window.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  await wait(30);
  const chk19 = doc19.querySelector("#open-list .check");
  if(chk19) chk19.click();
  await wait(30);
  ok("Afrond-knop onderaan in-mandje", !!doc19.querySelector("#done-list .finish-inline-btn"));
  dom19.window.close();

  // 21. Prijzen-nudge: bij >=8 items + prijzen uit → seenPriceNudge wordt gezet
  const dom20=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const doc20=dom20.window.document; const W20=dom20.window;
  ["Melk","Brood","Kaas","Appels","Eieren","Bananen","Yoghurt","Pasta"].forEach(function(n){
    doc20.querySelector("#add-name").value=n;
    doc20.querySelector("#add-name").dispatchEvent(new W20.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  });
  await wait(60);
  const st20 = JSON.parse(W20.localStorage.getItem("mandje.v2"));
  ok("Prijzen-nudge: seenPriceNudge gezet na 8 items", st20.settings.seenPriceNudge === true);
  dom20.window.close();

  // 22. Iteratie 6 — avatarHtml: emoji vs initialen
  const dom21=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const W21=dom21.window;
  if(typeof W21.avatarHtml === "function"){
    const withEmoji = W21.avatarHtml("Florian", "#2F7A4F", "🦊", 34);
    const withInit  = W21.avatarHtml("Florian Delange", "#2F7A4F", "", 34);
    ok("avatarHtml: emoji-variant toont de emoji", withEmoji.indexOf("🦊") !== -1);
    ok("avatarHtml: zonder emoji toont initialen (FD)", withInit.indexOf("FD") !== -1);
  } else {
    ok("avatarHtml beschikbaar op window", false);
  }
  dom21.window.close();

  // 23. Vrienden-laag aanwezig in build (SQL-RPC's + UI-hooks)
  ok("Build bevat ensure_profile-aanroep", html.indexOf("ensure_profile") !== -1);
  ok("Build bevat add_friend-aanroep", html.indexOf("add_friend") !== -1);
  ok("Build bevat openFriendsSheet", html.indexOf("openFriendsSheet") !== -1);
  ok("Build bevat ?friend= afhandeling", html.indexOf('params.get("friend")') !== -1);
  ok("Build bevat sendToFriend", html.indexOf("sendToFriend") !== -1);

  // 24. Iteratie 7 — avatar-smiley-grid weg, optioneel emoji-veld erin
  ok("AVATAR_EMOJI smiley-grid is verwijderd", html.indexOf("AVATAR_EMOJI") === -1);
  ok("Optioneel emoji-veld (#id-emoji) aanwezig", html.indexOf('id="id-emoji"') !== -1);
  ok("Profiel bewerken (openProfileSheet) aanwezig", html.indexOf("openProfileSheet") !== -1);
  ok("Vriend verwijderen-actie (friend-del) aanwezig", html.indexOf("friend-del") !== -1);
  ok(".mbtn.primary klasse gedefinieerd", html.indexOf(".mbtn.primary") !== -1);
  ok("Vriendcode-box klasse aanwezig", html.indexOf("friend-code-box") !== -1);

  // 25. Cross-platform input-hardening
  ok("Autofill-override aanwezig (-webkit-autofill)", html.indexOf("-webkit-autofill") !== -1);
  ok("text-size-adjust aanwezig", html.indexOf("text-size-adjust") !== -1);

  // 26. Maaltijden/bundels: aanmaken + in één tik aan de lijst
  const dom22=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const W22=dom22.window; const doc22=dom22.window.document;
  const mid=W22.addMeal("Pasta-avond","🍝",[{name:"Pasta",qty:1,unit:""},{name:"Pastasaus",qty:2,unit:""},{name:"Gehakt",qty:1,unit:"500 g"}]);
  ok("Bundel aangemaakt", !!mid && W22.mealList().length===1);
  W22.addMealToList(mid); await wait(40);
  ok("Bundel → 3 items op de lijst", doc22.querySelectorAll("#open-list .row").length===3);
  const st22=JSON.parse(W22.localStorage.getItem("mandje.v2"));
  ok("Bundel persistent in state.meals", st22.meals && Object.keys(st22.meals).length===1);
  ok("Eenheid in bundel-item bewaard", st22.list.some(i=>i.name==="Gehakt" && i.unit==="500 g"));
  // Barcode: OFF-categorie-mapping (pure functie) + scan-knop aanwezig
  ok("mapOFFCategory en:dairy → zuivel-eieren", W22.mapOFFCategory(["en:dairy"])==="zuivel-eieren");
  ok("mapOFFCategory nl:groenten → groente-fruit", W22.mapOFFCategory(["en:plant-based-foods","nl:groenten"])==="groente-fruit");
  ok("mapOFFCategory onbekend → null", W22.mapOFFCategory(["en:xyz-unknown"])===null);
  ok("Scan-knop aanwezig in add-balk", !!doc22.querySelector(".field #scan-btn"));
  dom22.window.close();

  // 27. Winkelmodus: opent, toont rijen per schap, afvinken + voortgang
  const dom23=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
  await wait(150); const W23=dom23.window; const doc23=dom23.window.document;
  ["Melk","Brood","Appels"].forEach(function(n){ doc23.querySelector("#add-name").value=n; doc23.querySelector("#add-name").dispatchEvent(new W23.KeyboardEvent("keydown",{key:"Enter",bubbles:true})); });
  await wait(40);
  ok("Winkelmodus: instap-knop aanwezig", !!doc23.querySelector("#shop-entry .shop-enter-btn"));
  W23.openShoppingMode(); await wait(30);
  ok("Winkelmodus: scherm open", doc23.querySelector("#shop-screen").classList.contains("show"));
  ok("Winkelmodus: 3 rijen", doc23.querySelectorAll("#shop-screen .shop-row").length===3);
  const firstId = JSON.parse(W23.localStorage.getItem("mandje.v2")).list.find(i=>!i.done).id;
  W23.shopToggle(firstId); await wait(30);
  ok("Winkelmodus: afvinken werkt", JSON.parse(W23.localStorage.getItem("mandje.v2")).list.filter(i=>i.done).length===1);
  ok("Winkelmodus: voortgang 1 / 3", /1 \/ 3/.test(doc23.querySelector("#shop-screen .shop-count").textContent));
  dom23.window.close();


  // 28. Fase 0 — regressies: onbekend schap, zoekfilter, toast-dode-zone, thema-meta, offline-regressie
  {
    const seed=(list,extra)=>JSON.stringify(Object.assign({version:3,settings:Object.assign({theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},extra||{}),list:list,catalog:{},coBuy:{},meals:{}}));
    // a) item met een schap dat niet in categoryOrder staat (bv. eigen schap van een ander lid) blijft zichtbaar
    const dom28=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,
      beforeParse(w){ w.localStorage.setItem("mandje.v2", seed([{id:"u1",name:"Geheim product",category:"cust_onbekend_x",qty:1,price:null,note:"",done:false,addedAt:""}])); }});
    await wait(150); const doc28=dom28.window.document;
    ok("Fase0: item met onbekend schap wordt gerenderd", doc28.querySelectorAll("#open-list .row").length===1);
    ok("Fase0: onbekend schap valt onder 'Overig'", /Overig/i.test(doc28.querySelector("#open-list .section")?.textContent||""));
    ok("Fase0: subhead telt 1 te halen", /1 te halen/.test(doc28.querySelector("#subhead").textContent));
    // thema-meta: precies één theme-color en die volgt het thema
    ok("Fase0: precies één theme-color-meta", doc28.querySelectorAll('meta[name="theme-color"]').length===1);
    ok("Fase0: theme-color volgt licht thema", doc28.querySelector('meta[name="theme-color"]').getAttribute("content")==="#F3EDE3");
    // statische CSS-invarianten in de gebouwde bundel
    ok("Fase0: rode swipe-laag alleen tijdens vegen (.row.swiping .behind)", /\.row\.swiping \.behind\{\s*opacity:1/.test(html) && /\.row \.behind\{[^}]*opacity:0/.test(html));
    const zi=(sel)=>{ const m=html.match(new RegExp(sel.replace(/[.\-]/g,"\\$&")+"\\{[^}]*z-index:(\\d+)")); return m?+m[1]:-1; };
    ok("Fase0: toast ligt boven winkelmodus (z-index)", zi(".toast")>zi(".shop-screen") && zi(".confetti-layer")>zi(".shop-screen"));
    ok("Fase0: offline-badge is een live region", /id="offline-badge" role="status"/.test(html));
    dom28.window.close();

    // b) thema donker → meta donker
    const dom28b=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,
      beforeParse(w){ w.localStorage.setItem("mandje.v2", seed([],{theme:"dark"})); }});
    await wait(120);
    ok("Fase0: theme-color volgt donker thema", dom28b.window.document.querySelector('meta[name="theme-color"]').getAttribute("content")==="#15130F");
    dom28b.window.close();

    // c) zoekfilter overleeft een re-render + toast-dode-zone
    const names=["Melk","Brood","Kaas","Appels","Bananen","Rijst","Pasta","Koffie","Thee","Boter"];
    const dom28c=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,
      beforeParse(w){ w.localStorage.setItem("mandje.v2", seed(names.map((n,i)=>({id:"s"+i,name:n,category:"overig",qty:1,price:null,note:"",done:false,addedAt:""})))); }});
    await wait(150); const W=dom28c.window, docC=W.document;
    ok("Fase0: zoekbalk zichtbaar bij 10 items", !docC.querySelector("#search-bar").classList.contains("collapsed"));
    const si=docC.querySelector("#search-input"); si.value="melk"; si.dispatchEvent(new W.Event("input",{bubbles:true}));
    const visible=()=>[...docC.querySelectorAll("#open-list .row")].filter(r=>r.style.display!=="none").length;
    ok("Fase0: filter toont 1 van 10", visible()===1);
    docC.querySelector("#add-name").value="Hagelslag"; docC.querySelector("#add-name").dispatchEvent(new W.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
    await wait(40);
    ok("Fase0: filter blijft actief na re-render (11 items, 1 zichtbaar)", docC.querySelectorAll("#open-list .row").length===11 && visible()===1);
    si.value=""; si.dispatchEvent(new W.Event("input",{bubbles:true}));
    ok("Fase0: filter leeg → alles zichtbaar", visible()===11);
    const firstId=JSON.parse(W.localStorage.getItem("mandje.v2")).list[0].id;
    W.removeFromList(firstId); await wait(30);
    const toastEl=docC.querySelector("#toast");
    ok("Fase0: undo-toast heeft actie", toastEl.classList.contains("show") && toastEl.classList.contains("has-action"));
    toastEl.querySelector(".toast-action").click(); await wait(30);
    ok("Fase0: na actie is de toast weg en vangt hij geen taps meer (CSS: alleen .toast.show is klikbaar)", !toastEl.classList.contains("show") && !/.toast.has-action{[^}]*pointer-events:auto/.test(html));
    ok("Fase0: undo zette het item terug", docC.querySelectorAll("#open-list .row").length===11);
    dom28c.window.close();

    // d) offline-regressie: een open gedeelde lijst mag bij een offline-event nooit als persoonlijke lijst worden weggeschreven
    const dom28d=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,
      beforeParse(w){ w.localStorage.setItem("mandje.v2", seed([{id:"p1",name:"Eigen melk",category:"zuivel-eieren",qty:1,price:null,note:"",done:false,addedAt:""},{id:"p2",name:"Eigen brood",category:"brood-banket",qty:1,price:null,note:"",done:false,addedAt:""}])); }});
    await wait(180); const Wd=dom28d.window, docD=Wd.document; const cloud=Wd.Cloud||Wd.__cloudRef;
    ok("Fase0: start met 2 persoonlijke items", docD.querySelectorAll("#open-list .row").length===2);
    // simuleer een geopende gedeelde lijst (open() bewaart de persoonlijke snapshot; Supabase ontbreekt in jsdom)
    // minimale Supabase-stub: elke query-keten is thenable en levert lege data (update levert 1 rij → heartbeat sluit de lijst niet)
    const q=(upd)=>{ const o={}; ["select","eq","in","order","insert","update","delete","upsert","single","limit"].forEach(m=>{ o[m]=function(){ if(m==="update") upd=true; return o; }; }); o.then=(res)=>Promise.resolve({data:upd?[{}]:[],error:null}).then(res); return o; };
    cloud.sb={ from:()=>q(false), rpc:()=>q(false), removeChannel(){}, channel(){ const c={}; c.on=()=>c; c.subscribe=()=>c; c.track=()=>{}; c.presenceState=()=>({}); return c; } };
    cloud.enabled=true; cloud.ready=true; cloud.mode="cloud";
    await cloud.open("c1").catch(()=>{});
    await wait(30);
    ok("Fase0: gedeelde lijst actief", cloud.active==="c1");
    // een cloud-item in de zichtbare lijst (optimistische rij via Cloud.addItem)
    docD.querySelector("#add-name").value="Cloudkaas"; docD.querySelector("#add-name").dispatchEvent(new Wd.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
    await wait(30);
    cloud.ready=true;
    Wd.dispatchEvent(new Wd.Event("offline"));
    await wait(60);
    // de oude bug sloeg pas toe bij de eerstvolgende save(): daarom nu een lokale mutatie forceren
    docD.querySelector("#add-name").value="Na offline"; docD.querySelector("#add-name").dispatchEvent(new Wd.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
    await wait(40);
    const stored=JSON.parse(Wd.localStorage.getItem("mandje.v2")).list.map(i=>i.name).sort().join(",");
    ok("Fase0: offline-event laat de persoonlijke lijst intact (+ nieuwe mutatie)", stored==="Eigen brood,Eigen melk,Na offline");
    ok("Fase0: cloud-item is NIET in de persoonlijke lijst gelekt", !/Cloudkaas/.test(stored));
    ok("Fase0: na offline staat de persoonlijke lijst weer in beeld", docD.querySelectorAll("#open-list .row").length===3 && /Eigen melk/.test(docD.querySelector("#open-list").textContent));
    ok("Fase0: actieve lijst blijft bewaard voor reconnect", Wd.localStorage.getItem("mandje.activeList")==="c1");
    dom28d.window.close();
  }


  // 29. Review-fixes Fase 0 — unit-terugval (PGRST204), XSS via lidkleur, glyph-escape
  {
    const seed29=(list)=>JSON.stringify({version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:list,catalog:{},coBuy:{},meals:{}});
    const mkStub=(opts)=>{
      const calls={inserts:[],updates:[]};
      const q=(kind)=>{ const o={}; let upd=false, payload=null;
        ["select","eq","in","order","single","limit"].forEach(m=>{ o[m]=function(){ return o; }; });
        o.insert=function(p){ payload=p; calls.inserts.push(JSON.parse(JSON.stringify(p))); return o; };
        o.update=function(p){ upd=true; payload=p; calls.updates.push(JSON.parse(JSON.stringify(p))); return o; };
        o.delete=function(){ return o; }; o.upsert=function(){ return o; };
        o.then=(res)=>{ let r={data:upd?[{}]:[],error:null}; if(payload && "unit" in payload && opts.rejectUnit) r={data:null,error:{code:"PGRST204",message:"Could not find the 'unit' column of 'items' in the schema cache"}}; return Promise.resolve(r).then(res); };
        return o; };
      return { calls, sb:{ from:()=>q(), rpc:()=>q(), removeChannel(){}, channel(){ const c={}; c.on=()=>c; c.subscribe=()=>c; c.track=()=>{}; c.presenceState=()=>({}); return c; } } };
    };
    // a) kolom items.unit ontbreekt nog (migratie M0 niet gedraaid): tweede insert gaat zónder unit, niets in de wachtrij
    const dom29=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,
      beforeParse(w){ w.localStorage.setItem("mandje.v2", seed29([])); }});
    await wait(160); const W29=dom29.window, doc29=W29.document, cloud29=W29.Cloud||W29.__cloudRef;
    const stubA=mkStub({rejectUnit:true}); cloud29.sb=stubA.sb; cloud29.enabled=true; cloud29.ready=true; cloud29.mode="cloud";
    await cloud29.open("c1").catch(()=>{}); await wait(30);
    doc29.querySelector("#add-name").value="500 g gehakt"; doc29.querySelector("#add-name").dispatchEvent(new W29.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
    await wait(60);
    ok("Review: eerste insert stuurt unit mee", stubA.calls.inserts.length>=1 && stubA.calls.inserts[0].unit==="500 g");
    ok("Review: na PGRST204 volgt een tweede insert zónder unit", stubA.calls.inserts.length===2 && !("unit" in stubA.calls.inserts[1]));
    ok("Review: _hasUnit staat daarna op false", cloud29._hasUnit===false);
    ok("Review: offline-wachtrij blijft leeg (geen 'Offline'-toast-loop)", (cloud29._pending||[]).length===0);
    ok("Review: item staat gewoon op de lijst", /gehakt/i.test(doc29.querySelector("#open-list").textContent));
    dom29.window.close();

    // b) lidkleur uit de database is geen vrijbrief voor HTML-injectie (itemRow + toewijs-chips in het sheet)
    const dom29b=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,
      beforeParse(w){ w.localStorage.setItem("mandje.v2", seed29([])); }});
    await wait(160); const Wb=dom29b.window, docB=Wb.document, cloudB=Wb.Cloud||Wb.__cloudRef;
    const stubB=mkStub({}); cloudB.sb=stubB.sb; cloudB.enabled=true; cloudB.ready=true; cloudB.mode="cloud";
    await cloudB.open("c1").catch(()=>{}); await wait(30);
    cloudB.members=[{id:"m1",user_id:"u-mallory",display_name:"Mallory",color:'x" onmouseover="window.__pwned=1'}];
    docB.querySelector("#add-name").value="Brood"; docB.querySelector("#add-name").dispatchEvent(new Wb.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
    await wait(40);
    const firstCard=docB.querySelector("#open-list .row"); firstCard.querySelector(".card").click(); await wait(30);
    const sheetHtml=docB.querySelector("#sheet").innerHTML;
    ok("Review: toewijs-chips in het sheet bevatten geen geïnjecteerde attributen", sheetHtml.indexOf("onmouseover")===-1 && /background:#24593F|cadchip/.test(sheetHtml));
    // kies Mallory als 'wie haalt het' en sla op → itemRow rendert de sub-regel met haar kleur
    const chip=[...docB.querySelectorAll("#s-assign .cadchip")].find(b=>b.dataset.m==="m1"); if(chip) chip.click();
    docB.querySelector("#s-save").click(); await wait(40);
    const rowHtml=docB.querySelector("#open-list").innerHTML;
    ok("Review: rij met toegewezen lid bevat geen geïnjecteerde attributen (avatar-badge)", rowHtml.indexOf("onmouseover")===-1 && /Voor Mallory/.test(rowHtml) && !!docB.querySelector("#open-list .asg-av"));
    ok("Review: onveilige kleur valt terug op de standaardkleur", /background:#24593F/.test(rowHtml));
    ok("Review: geen script uitgevoerd", !Wb.__pwned);
    dom29b.window.close();

    // c) eigen schap met HTML in de naam wordt als tekst getoond
    const dom29c=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,
      beforeParse(w){ w.localStorage.setItem("mandje.v2", JSON.stringify({version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1,customCategories:[{id:"cust_x",label:"<img src=x onerror=window.__pwned2=1>",glyph:"🧪"}]},list:[{id:"c1",name:"Test",category:"cust_x",qty:1,price:null,note:"",done:false,addedAt:""}],catalog:{},coBuy:{},meals:{}})); }});
    await wait(150); const docC=dom29c.window.document;
    ok("Review: schapnaam met HTML wordt geëscaped in de sectiekop", !docC.querySelector("#open-list .section img") && /<img src=x/.test(docC.querySelector("#open-list .section").textContent));
    ok("Review: geen script via schapnaam", !dom29c.window.__pwned2);
    dom29c.window.close();
  }

  // 30. Fase 1 — schap-wrappers, overlay-model, toetsenbord/autocomplete, start-parameters, Meer-tab
  {
    const now30=new Date().toISOString();
    const seed30=JSON.stringify({version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[
      {id:"a1",name:"appels",category:"groente-fruit",qty:3,unit:"",done:false,note:"",price:null,assigned_to:null,added_by_name:"",addedAt:now30},
      {id:"b1",name:"brood",category:"brood-banket",qty:1,unit:"",done:false,note:"",price:null,assigned_to:null,added_by_name:"",addedAt:now30}
    ],catalog:{},coBuy:{},meals:{}});
    const mk30=(url)=>new JSDOM(html,{url:url||"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){ w.localStorage.setItem("mandje.v2", seed30); }});

    // a) schappen, sectiekoppen, iconen, subkop, manifest
    const d30=mk30(); await wait(160); const W=d30.window, D=W.document;
    const shelves=D.querySelectorAll("#open-list > .shelf");
    ok("Fase 1: elk schap zit in een div.shelf (raster op tablet/desktop)", shelves.length===2 && !!shelves[0].querySelector("button.section") && !!shelves[0].querySelector("ul.list"));
    const sec=D.querySelector("#open-list button.section");
    ok("Fase 1: sectiekop is een knop met aria-expanded + aria-controls", !!sec && sec.getAttribute("aria-expanded")==="true" && !!D.getElementById(sec.getAttribute("aria-controls")||""));
    if(sec){ sec.click(); await wait(30); }
    ok("Fase 1: inklappen zet aria-expanded op false", !!D.querySelector("#open-list button.section") && D.querySelector("#open-list button.section").getAttribute("aria-expanded")==="false");
    ok("Fase 1: geen .row-actions op een touch-toestel (jsdom: geen fine pointer)", !D.querySelector("#open-list .row-actions"));
    ok("Fase 1: schap-iconen zijn SVG's in de schapkleur", D.querySelectorAll("#open-list .section .shelf-ico svg").length===2 && !!D.querySelector("#open-list .section .shelf-ico.shelf-vers"));
    const sub30=D.querySelector("#subhead").textContent;
    ok("Fase 1: subkop in mensentaal ('2 te halen', geen modus-tekst)", /2 te halen/.test(sub30) && !/modus|cloud/i.test(sub30));
    ok("Fase 1: manifest als los bestand, geen base64-iconen in de head", !!D.querySelector('link[rel="manifest"]') && D.querySelector('link[rel="manifest"]').getAttribute("href")==="./manifest.webmanifest" && !D.querySelector('link[rel="apple-touch-icon"][href^="data:"]'));

    // b) overlay-model: dialog-semantiek, inert, sluitknop, Escape, history-token + systeem-back
    D.querySelector("#open-list .row .card").click(); await wait(40);
    const sheet=D.querySelector("#sheet");
    ok("Fase 1: geopend sheet is role=dialog + aria-modal", sheet.classList.contains("show") && sheet.getAttribute("role")==="dialog" && sheet.getAttribute("aria-modal")==="true");
    ok("Fase 1: achtergrond is inert zolang het sheet open is", D.querySelector("#main").hasAttribute("inert") && D.querySelector("#addwrap").hasAttribute("inert"));
    ok("Fase 1: sheet heeft een sluitknop (.sheet-x) met label", !!sheet.querySelector(".sheet-x[aria-label]"));
    ok("Fase 1: history-token voor Android-back", !!(W.history.state && W.history.state.mandje==="modal"));
    D.dispatchEvent(new W.KeyboardEvent("keydown",{key:"Escape",bubbles:true})); await wait(40);
    ok("Fase 1: Escape sluit het sheet en heft inert op", !sheet.classList.contains("show") && !D.querySelector("#main").hasAttribute("inert"));
    D.querySelector("#open-list .row .card").click(); await wait(40);
    const openedAgain=D.querySelector("#sheet").classList.contains("show");
    W.history.back(); await wait(80);
    ok("Fase 1: systeem-back (popstate) sluit het sheet", openedAgain && !D.querySelector("#sheet").classList.contains("show"));

    // c) autocomplete: combobox-semantiek, pijltjes + Enter
    const inp=D.querySelector("#add-name");
    ok("Fase 1: invoerveld is een combobox met listbox", inp.getAttribute("role")==="combobox" && D.querySelector("#ac-list").getAttribute("role")==="listbox");
    inp.value="me"; inp.dispatchEvent(new W.Event("input",{bubbles:true})); await wait(60);
    const opts=D.querySelectorAll("#ac-list .ac-item");
    if(opts.length){
      inp.dispatchEvent(new W.KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true})); await wait(10);
      ok("Fase 1: ↓ markeert de eerste optie (aria-activedescendant)", !!D.querySelector("#ac-list .ac-item.active") && inp.getAttribute("aria-activedescendant")==="ac-opt-0" && inp.getAttribute("aria-expanded")==="true");
      inp.dispatchEvent(new W.KeyboardEvent("keydown",{key:"Enter",bubbles:true})); await wait(60);
      ok("Fase 1: Enter kiest de gemarkeerde optie en sluit de lijst", !D.querySelector("#ac-list").classList.contains("show") && inp.getAttribute("aria-expanded")==="false");
    } else {
      ok("Fase 1: autocomplete toont suggesties voor 'me' (Melk)", false);
    }
    d30.window.close();

    // d) start-parameters (manifest-shortcuts + Android share_target)
    const d30b=mk30("https://example.com/?title=Boodschappen&text=melk%2C%20brood%0Aeieren"); await wait(220);
    const Db=d30b.window.document, ta=Db.querySelector("#bulk-input");
    ok("Fase 1: share_target → 'Plak meerdere' met de tekst regel-voor-regel", !!ta && ta.value.split("\n").length===4 && /melk/.test(ta.value) && /eieren/.test(ta.value));
    ok("Fase 1: launch-parameters uit de adresbalk verwijderd", d30b.window.location.search==="");
    d30b.window.close();
    const d30c=mk30("https://example.com/?focus=add&source=pwa"); await wait(500);
    ok("Fase 1: ?focus=add focust het invoerveld", !!d30c.window.document.activeElement && d30c.window.document.activeElement.id==="add-name");
    d30c.window.close();

    // e) Meer-tab: groepen, segment verborgen, Tekstgrootte, Diagnose
    const d30d=mk30(); await wait(160); const Dd=d30d.window.document, Wd=d30d.window;
    Dd.querySelector("#gear-btn").click(); await wait(40);
    const secs=[...Dd.querySelectorAll("#meer-content .section")].map(x=>x.textContent.trim().toLowerCase());
    ok("Fase 1: Meer-tab heeft de groepen Weergave · Op je beginscherm · Schappen · Back-up & privacy · Diagnose", ["weergave","op je beginscherm","schappen","back-up & privacy","diagnose"].every(g=>secs.some(x=>x.indexOf(g)===0)));
    ok("Fase 1: Lijst/Vaste-segment verborgen op de Meer-tab (body.tab-meer)", Dd.body.classList.contains("tab-meer"));
    const groot=[...Dd.querySelectorAll('#meer-content .seg[aria-label="Tekstgrootte"] button')].find(b=>/^groot$/i.test(b.textContent.trim()));
    if(groot){ groot.click(); await wait(20); }
    ok("Fase 1: Tekstgrootte 'Groot' zet --text-scale op 1.12 en bewaart de instelling", !!groot && Dd.documentElement.style.getPropertyValue("--text-scale")==="1.12" && JSON.parse(Wd.localStorage.getItem("mandje.v2")).settings.textScale===1.12);
    const meerTxt=Dd.querySelector("#meer-content").textContent;
    ok("Fase 1: Diagnose toont versie en cloud-status", /versie/i.test(meerTxt) && /cloud/i.test(meerTxt));
    Dd.querySelectorAll("[data-tab]").forEach(b=>{ if(b.dataset.tab==="lijst") b.click(); }); await wait(20);
    ok("Fase 1: terug naar Lijst haalt body.tab-meer weer weg", !Dd.body.classList.contains("tab-meer"));
    d30d.window.close();
  }

  // 31. Fase 2a — winkelmodus incrementeel, FLIP-rijen, toast bij toevoegen
  {
    const now31=new Date().toISOString();
    const seed31=JSON.stringify({version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[
      {id:"a1",name:"appels",category:"groente-fruit",qty:3,unit:"",done:false,note:"",price:null,assigned_to:null,added_by_name:"",addedAt:now31},
      {id:"a2",name:"bananen",category:"groente-fruit",qty:1,unit:"",done:false,note:"",price:null,assigned_to:null,added_by_name:"",addedAt:now31},
      {id:"b1",name:"brood",category:"brood-banket",qty:1,unit:"",done:false,note:"",price:null,assigned_to:null,added_by_name:"",addedAt:now31}
    ],catalog:{},coBuy:{},meals:{}});
    const d31=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){ w.localStorage.setItem("mandje.v2", seed31); }});
    await wait(160); const W=d31.window, D=W.document;
    ok("Fase 2a: lijstrijen dragen data-id (FLIP)", D.querySelectorAll("#open-list li.row[data-id]").length===3);
    W.openShoppingMode(); await wait(40);
    const scr=D.querySelector("#shop-screen");
    ok("Fase 2a: winkelmodus heeft invoerveld en Afronden-knop in de voet", !!scr.querySelector("#shop-add-name") && !!scr.querySelector("#shop-finish"));
    ok("Fase 2a: Afronden is uitgeschakeld zolang niets is afgevinkt", scr.querySelector("#shop-finish").disabled===true);
    const rowsBefore=[...scr.querySelectorAll(".shop-row")];
    const bodyBefore=scr.querySelector("#shop-body");
    ok("Fase 2a: rijen zijn checkboxes met naam", rowsBefore.length===3 && rowsBefore[0].getAttribute("role")==="checkbox" && rowsBefore[0].dataset.name==="appels");
    rowsBefore[0].click(); await wait(30);
    const rowsAfter=[...scr.querySelectorAll(".shop-row")];
    ok("Fase 2a: afvinken herbouwt niets — zelfde DOM-nodes, zelfde volgorde", rowsAfter.length===3 && rowsAfter[0]===rowsBefore[0] && rowsAfter[1]===rowsBefore[1] && scr.querySelector("#shop-body")===bodyBefore);
    ok("Fase 2a: afgevinkte rij blijft op zijn plek met .done + aria-checked", rowsAfter[0].classList.contains("done") && rowsAfter[0].getAttribute("aria-checked")==="true" && !scr.querySelector(".shelf.done"));
    ok("Fase 2a: teller en voortgangsbalk bijgewerkt", /1 \/ 3/.test(scr.querySelector("#shop-count").textContent) && scr.querySelector("#shop-pbar").getAttribute("aria-valuenow")==="33");
    ok("Fase 2a: Afronden toont het aantal en is actief", /1/.test(scr.querySelector("#shop-finish").textContent) && scr.querySelector("#shop-finish").disabled===false);
    rowsAfter[1].click(); await wait(30);
    const shelfVers=scr.querySelector('.shelf[data-cat="groente-fruit"]');
    ok("Fase 2a: schap krijgt .all-done zodra alles in het schap is afgevinkt", !!shelfVers && shelfVers.classList.contains("all-done") && !scr.querySelector('.shelf[data-cat="brood-banket"]').classList.contains("all-done"));
    scr.querySelector("#shop-hide").click(); await wait(20);
    ok("Fase 2a: 'Verberg afgevinkte' zet de klasse en bewaart de instelling", scr.classList.contains("hide-done") && JSON.parse(W.localStorage.getItem("mandje.v2")).settings.shopHideDone===true);
    scr.querySelector("#shop-hide").click(); await wait(20);
    // toevoegen vanuit de winkelmodus
    scr.querySelector("#shop-add-name").value="melk 2";
    scr.querySelector("#shop-add").dispatchEvent(new W.Event("submit",{bubbles:true,cancelable:true})); await wait(60);
    const melkRow=[...scr.querySelectorAll(".shop-row")].find(r=>r.dataset.name==="melk");
    ok("Fase 2a: toevoegen in de winkel zet de rij in het juiste schap met aantal", !!melkRow && melkRow.closest(".shelf").dataset.cat==="zuivel-eieren" && /2/.test((melkRow.querySelector(".shop-qty")||{}).textContent||""));
    ok("Fase 2a: invoerveld leeg na toevoegen", scr.querySelector("#shop-add-name").value==="");
    // sluiten rendert de Lijst-tab (dirty) — afgevinkte items staan in 'In mandje'
    W.closeShoppingMode(); await wait(40);
    ok("Fase 2a: na sluiten staan de 2 afgevinkte items in 'In mandje' en 2 open", D.querySelectorAll("#done-list li.row").length===2 && D.querySelectorAll("#open-list li.row").length===2);
    // toast bij toevoegen op de Lijst-tab is informatief en tikbaar
    D.querySelector("#add-name").value="wc papier"; D.querySelector("#add-name").dispatchEvent(new W.KeyboardEvent("keydown",{key:"Enter",bubbles:true})); await wait(40);
    const toastEl=[D.querySelector("#toast2"), D.querySelector("#toast")].find(t=>t && t.classList.contains("show") && /wc papier/.test(t.textContent));
    ok("Fase 2a: toast bij toevoegen noemt het schap en is tikbaar", !!toastEl && /wc papier → Huishouden/.test(toastEl.textContent) && toastEl.classList.contains("has-tap"));
    d31.window.close();
  }

  // 32. Fase 2b — classificatie-scoring, dubbele regels (matchKey), Schap kiezen, bijna-op per chip, Vaak gekocht
  {
    const dstr=(daysAgo)=>{ const d=new Date(); d.setDate(d.getDate()-daysAgo); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
    const catalog32={
      "melk":{name:"Melk",category:"zuivel-eieren",defaultPrice:null,purchaseDates:[dstr(29),dstr(22),dstr(15),dstr(8)],timesAdded:6,lastAddedAt:new Date(Date.now()-8*86400000).toISOString(),cadenceMode:"auto",manualIntervalDays:null},
      "brood":{name:"Brood",category:"brood-banket",defaultPrice:null,purchaseDates:[dstr(20),dstr(10)],timesAdded:4,lastAddedAt:new Date(Date.now()-3*86400000).toISOString(),cadenceMode:"auto",manualIntervalDays:null},
      "kaas":{name:"Kaas",category:"kaas-vleeswaren",defaultPrice:null,purchaseDates:[],timesAdded:3,lastAddedAt:new Date(Date.now()-5*86400000).toISOString(),cadenceMode:"auto",manualIntervalDays:null},
      "eenmalig":{name:"Eenmalig",category:"overig",defaultPrice:null,purchaseDates:[],timesAdded:1,lastAddedAt:new Date().toISOString(),cadenceMode:"auto",manualIntervalDays:null}
    };
    const seed32=(list)=>JSON.stringify({version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:list||[],catalog:catalog32,coBuy:{},meals:{}});
    const d32=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){ w.localStorage.setItem("mandje.v2", seed32([])); }});
    await wait(160); const W=d32.window, D=W.document;
    // a) classificatie
    const cls=(n)=>W.classify ? W.classify(n) : null;
    ok("Fase 2b: classify scoort op einde/woordgrens (boterhamworst → kaas & vleeswaren, melkchocolade → snoep)", cls("boterhamworst")==="kaas-vleeswaren" && cls("melkchocolade")==="snoep-snacks" && cls("halfvolle melk")==="zuivel-eieren");
    ok("Fase 2b: nieuwe keywords (snijbloemen, tortillachips, kruidenboter, roomijs)", cls("snijbloemen")==="tuin-planten" && cls("tortillachips")==="snoep-snacks" && cls("kruidenboter")==="kaas-vleeswaren" && cls("roomijs")==="diepvries");
    ok("Fase 2b: bestaande classificaties intact (bloemkool, kipfilet, wc papier, hondenvoer)", cls("bloemkool")==="groente-fruit" && cls("kipfilet")==="vlees-vis" && cls("wc papier")==="huishouden" && cls("hondenvoer")==="huisdier");
    // b) lege staat: Vaak gekocht (timesAdded ≥ 2, niet op de lijst)
    const qs=D.querySelector("#open-list .quick-start");
    const chipNames=qs ? [...qs.querySelectorAll(".chip span:not(.plus)")].map(x=>x.textContent) : [];
    ok("Fase 2b: lege staat toont 'Vaak gekocht'-chips uit de catalogus (zonder eenmalige items)", !!qs && chipNames.indexOf("Melk")!==-1 && chipNames.indexOf("Brood")!==-1 && chipNames.indexOf("Eenmalig")===-1);
    // c) bijna-op-banner: chip met verberg-knop; verbergen werkt vandaag; snooze via lang indrukken (functie)
    const banner=D.querySelector("#due-banner .banner");
    ok("Fase 2b: bijna-op-banner toont melk met een eigen verberg-knop", !!banner && !!banner.querySelector(".chip-wrap .chip") && !!banner.querySelector(".chip-wrap .chip-x"));
    if(banner){ banner.querySelector(".chip-x").click(); await wait(30); }
    ok("Fase 2b: verbergen per chip haalt alleen dat product weg (vandaag)", !D.querySelector("#due-banner .chip-wrap") && JSON.parse(W.localStorage.getItem("mandje.v2")).settings.dismissedDueItems.melk===dstr(0));
    W.snoozeDue("melk", 7); await wait(20);
    const snoozed=JSON.parse(W.localStorage.getItem("mandje.v2")).catalog.melk.snoozeUntil;
    ok("Fase 2b: snooze zet snoozeUntil een week vooruit", snoozed===dstr(-7));
    // d) dubbele regels: "wc-papier" + "wc papier" → één regel met 2
    const add=(n)=>{ D.querySelector("#add-name").value=n; D.querySelector("#add-name").dispatchEvent(new W.KeyboardEvent("keydown",{key:"Enter",bubbles:true})); };
    add("wc-papier"); await wait(30); add("wc papier"); await wait(30);
    const rows=[...D.querySelectorAll("#open-list li.row")];
    ok("Fase 2b: 'wc-papier' en 'wc papier' worden één regel met aantal 2", rows.length===1 && rows[0].querySelector(".qty span").textContent==="2");
    // e) Overig-rij krijgt 'Schap kiezen'
    add("zqxblorp"); await wait(30);
    const overigRow=[...D.querySelectorAll("#open-list li.row")].find(r=>/zqxblorp/.test(r.textContent));
    ok("Fase 2b: item in Overig toont een 'Schap kiezen'-chip; bekende items niet", !!overigRow && !!overigRow.querySelector(".pick-cat") && !rows[0].querySelector(".pick-cat"));
    overigRow.querySelector(".pick-cat").click(); await wait(40);
    ok("Fase 2b: 'Schap kiezen' opent het item-sheet met schap-keuze", D.querySelector("#sheet").classList.contains("show") && !!D.querySelector("#sheet .catchip"));
    d32.window.close();
    // f) Vaste-tab: 'Vaak gekocht' vanaf dag één, ook zonder vaste boodschappen
    const d32b=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){ w.localStorage.setItem("mandje.v2", JSON.stringify({version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[],catalog:{"kaas":catalog32.kaas,"brood":catalog32.brood},coBuy:{},meals:{}})); }});
    await wait(160); const Db=d32b.window.document;
    [...Db.querySelectorAll("[data-tab]")].find(b=>b.dataset.tab==="vaste").click(); await wait(40);
    const vasteTxt=Db.querySelector("#vaste-content").textContent;
    ok("Fase 2b: Vaste-tab toont 'Vaak gekocht' zonder vaste boodschappen (geen lege staat)", /Vaak gekocht/.test(vasteTxt) && Db.querySelectorAll("#vaste-content .freq-chips .chip").length===2 && !Db.querySelector("#vaste-content .empty"));
    d32b.window.close();
  }

  // 33. Fase 2c/d — afronden omkeerbaar + geschiedenis + Klaar!-blad, winkels/looproute, weekritueel, catalogusbeheer
  {
    const dstr=(daysAgo)=>{ const d=new Date(); d.setDate(d.getDate()-daysAgo); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
    const now33=new Date().toISOString();
    const mkItem=(id,name,cat,done)=>({id:id,name:name,category:cat,qty:1,unit:"",done:!!done,note:"",price:null,assigned_to:null,added_by_name:"",addedAt:now33});
    const seed33=JSON.stringify({version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},
      list:[mkItem("a1","appels","groente-fruit",true), mkItem("b1","brood","brood-banket",true), mkItem("m1","melk","zuivel-eieren",false)],
      catalog:{"appels":{name:"appels",category:"groente-fruit",defaultPrice:null,purchaseDates:[dstr(14)],timesAdded:2,lastAddedAt:now33,cadenceMode:"auto",manualIntervalDays:null}},
      coBuy:{"appels":{"bananen":3},"bananen":{"appels":3}},meals:{}});
    // a) afronden lokaal: Klaar!-blad, geschiedenis, undo zet alles terug (ook de aankoopdatum van vandaag)
    const d33=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){ w.localStorage.setItem("mandje.v2", seed33); }});
    await wait(160); const W=d33.window, D=W.document;
    W.finishShopping(); await wait(60);
    const st1=JSON.parse(W.localStorage.getItem("mandje.v2"));
    ok("Fase 2c: afronden haalt afgevinkte items van de lijst en schrijft een geschiedenis-item", st1.list.length===1 && Array.isArray(st1.history) && st1.history.length===1 && st1.history[0].count===2 && st1.history[0].items.map(i=>i.name).sort().join()==="appels,brood");
    ok("Fase 2c: aankoopdatum van vandaag geregistreerd", st1.catalog.appels.purchaseDates.indexOf(dstr(0))!==-1 && st1.catalog.brood && st1.catalog.brood.purchaseDates.indexOf(dstr(0))!==-1);
    const sheet=D.querySelector("#sheet");
    ok("Fase 2c: Klaar!-blad met samenvatting en 'Terug op de lijst'", sheet.classList.contains("show") && /2/.test(sheet.querySelector(".fin-sum").textContent) && !!sheet.querySelector("#fin-undo"));
    sheet.querySelector("#fin-undo").click(); await wait(60);
    const st2=JSON.parse(W.localStorage.getItem("mandje.v2"));
    ok("Fase 2c: 'Terug op de lijst' zet de items terug, wist het geschiedenis-item en de nieuwe aankoopdatum", st2.list.length===3 && st2.history.length===0 && st2.catalog.appels.purchaseDates.indexOf(dstr(0))===-1 && !D.querySelector("#sheet").classList.contains("show"));
    // b) opnieuw afronden, Klaar → geschiedenis blijft; 'Herhaal vorige lijst' zet ze terug op de lijst
    W.finishShopping(); await wait(60);
    D.querySelector("#fin-ok").click(); await wait(40);
    W.repeatLastTrip(); await wait(40);
    const st3=JSON.parse(W.localStorage.getItem("mandje.v2"));
    ok("Fase 2c: 'Herhaal vorige lijst' zet de gekochte items terug als open items", st3.history.length===1 && st3.list.filter(i=>!i.done).map(i=>i.name).sort().join()==="appels,brood,melk");
    // c) winkels: preset-looproute, kiezer, lijstvolgorde volgt de actieve winkel
    W.addStore("Lidl Centrum","lidl"); await wait(40);
    const st4=JSON.parse(W.localStorage.getItem("mandje.v2"));
    ok("Fase 2d: winkel met Lidl-preset aangemaakt en actief (brood vóór groente)", st4.settings.stores.length===1 && st4.settings.activeStoreId===st4.settings.stores[0].id && st4.settings.stores[0].order.slice(0,2).join()==="brood-banket,groente-fruit" && st4.settings.stores[0].order.length===st4.settings.categoryOrder.length);
    const order=[...D.querySelectorAll("#open-list .shelf")].map(s=>s.dataset.cat);
    ok("Fase 2d: Lijst-tab volgt de looproute van de actieve winkel", order.join()==="brood-banket,groente-fruit,zuivel-eieren");
    const pick=D.querySelector("#store-pick");
    ok("Fase 2d: winkel-kiezer toont Standaard + winkel, winkel actief", !!pick && pick.querySelectorAll(".chip").length===2 && pick.querySelectorAll(".chip")[1].classList.contains("on"));
    pick.querySelectorAll(".chip")[0].click(); await wait(40);
    const order2=[...D.querySelectorAll("#open-list .shelf")].map(s=>s.dataset.cat);
    ok("Fase 2d: 'Standaard' zet de standaardvolgorde terug", order2.join()==="groente-fruit,brood-banket,zuivel-eieren" && JSON.parse(W.localStorage.getItem("mandje.v2")).settings.activeStoreId===null);
    // d) catalogusbeheer: hernoemen met samenvoegen, verbergen sluit uit van suggesties
    W.addToList("Bananen"); await wait(30);
    const renamed=W.renameCatalogEntry("bananen","Appels"); await wait(30);   // save() is gecoalesced (microtask)
    ok("Fase 2d: hernoemen naar bestaande naam voegt samen (datums + timesAdded) en past de lijst aan", renamed && !JSON.parse(W.localStorage.getItem("mandje.v2")).catalog.bananen && JSON.parse(W.localStorage.getItem("mandje.v2")).catalog.appels.timesAdded>=3 && D.querySelectorAll("#open-list li.row").length>=1 && !/bananen/i.test(D.querySelector("#open-list").textContent));
    const cat=JSON.parse(W.localStorage.getItem("mandje.v2")).catalog;
    W.openCatalogSheet(); await wait(40);
    const rows=[...D.querySelectorAll("#sheet .cm-row")];
    ok("Fase 2d: catalogusblad toont alle producten met acties", rows.length===Object.keys(cat).length && !!D.querySelector("#sheet #cm-q"));
    rows[0].querySelector(".cm-more").click(); await wait(20);
    const hideBtn=[...D.querySelectorAll("#sheet .cm-acts button")].find(b=>/niet meer voorstellen/i.test(b.textContent));
    ok("Fase 2d: acties Details · Hernoem · Niet meer voorstellen · Verwijder", !!hideBtn && D.querySelectorAll("#sheet .cm-acts button").length===4);
    hideBtn.click(); await wait(20);
    const hiddenKey=Object.keys(JSON.parse(W.localStorage.getItem("mandje.v2")).catalog).find(k=>JSON.parse(W.localStorage.getItem("mandje.v2")).catalog[k].hidden);
    ok("Fase 2d: verborgen product komt niet meer in 'Vaak gekocht'", !!hiddenKey && !W.frequentItems(20).some(e=>e.hidden));
    d33.window.close();
    // e) weekritueel: koopgeschiedenis op vandaag-weekdag → kaart met startzetten
    const wdDates=[]; for(let i=0;i<8;i++){ wdDates.push(dstr(7*i+7)); }
    const seedR=JSON.stringify({version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[],
      catalog:{"melk":{name:"Melk",category:"zuivel-eieren",defaultPrice:null,purchaseDates:wdDates.slice().sort(),timesAdded:8,lastAddedAt:now33,cadenceMode:"auto",manualIntervalDays:null}},
      coBuy:{},meals:{},history:[{id:"h1",at:now33,count:2,total:null,paid:null,list:"local",items:[{name:"melk",qty:1,unit:"",price:null,category:"zuivel-eieren"},{name:"brood",qty:1,unit:"",price:null,category:"brood-banket"}]}]});
    const dR=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){ w.localStorage.setItem("mandje.v2", seedR); }});
    await wait(160); const Wr=dR.window, Dr=Wr.document;
    ok("Fase 2d: boodschappendag afgeleid uit de koopgeschiedenis (vandaag)", Wr.shoppingWeekday()===new Date().getDay());
    const rit=Dr.querySelector("#week-ritual .ritual");
    ok("Fase 2d: 'Klaar voor de week?'-kaart met Vaste erop en Herhaal vorige lijst", !!rit && /Klaar voor de week/.test(rit.textContent) && /Vaste erop/.test(rit.textContent) && /Herhaal vorige lijst/.test(rit.textContent));
    rit.querySelector(".r-x").click(); await wait(20);
    ok("Fase 2d: kaart weggetikt voor vandaag", !Dr.querySelector("#week-ritual .ritual") && JSON.parse(Wr.localStorage.getItem("mandje.v2")).settings.ritualDismissed===dstr(0));
    dR.window.close();
  }

  // 34. Fase 7b — recept-parser, barcode-bevestiging + categorie, QR-encoder, Aan-de-slag-kaart, row-cache
  {
    const now34=new Date().toISOString();
    const seed34=JSON.stringify({version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[
      {id:"a1",name:"appels",category:"groente-fruit",qty:3,unit:"",done:false,note:"",price:null,assigned_to:null,added_by_name:"",addedAt:now34}
    ],catalog:{},coBuy:{},meals:{}});
    const d34=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){ w.localStorage.setItem("mandje.v2", seed34); }});
    await wait(160); const W=d34.window, D=W.document;
    // a) recept → ingrediënten
    const ings=W.parseRecipeText("Ingrediënten (voor 4 personen)\n- 500 g spaghetti\n- 2 el olijfolie\n- 1 ui, gesnipperd\n- 2 teentjes knoflook\n- 400 g gehakt\n- 1 blik tomatenblokjes (400 g)\n- zout en peper naar smaak\nBereiding\n1. Verhit de olie in een pan en bak de ui glazig.\n2. Voeg het gehakt toe en bak het rul.\nLaat 20 minuten sudderen en serveer met parmezaan.");
    const names=ings.map(i=>i.name);
    ok("Fase 7b: recept-parser pakt de ingrediënten met hoeveelheid en laat instructies weg", names.indexOf("Spaghetti")!==-1 && names.indexOf("Ui")!==-1 && names.indexOf("Knoflook")!==-1 && names.indexOf("Gehakt")!==-1 && names.indexOf("Tomatenblokjes")!==-1 && !names.some(n=>/verhit|voeg|laat|bereiding|ingredi/i.test(n)));
    ok("Fase 7b: hoeveelheden als eenheid ('500 g') of aantal (2 teentjes → eenheid)", ings.find(i=>i.name==="Spaghetti").unit==="500 g" && ings.find(i=>i.name==="Olijfolie").unit==="2 el" && ings.find(i=>i.name==="Knoflook").unit==="2 teentjes");
    // b) barcode-bevestiging zet het schap uit de lookup
    W.addToList("Blikje energiedrank", null, {qty:1, category:"dranken", silent:true}); await wait(30);
    const st=JSON.parse(W.localStorage.getItem("mandje.v2"));
    ok("Fase 7b: addToList met category (barcode) gebruikt dat schap en leert het in de catalogus", st.list.find(i=>i.name==="Blikje energiedrank").category==="dranken" && st.catalog["blikje energiedrank"].category==="dranken");
    // c) QR-encoder: structuur (finders, donkere module, maat) — de decodeer-ronde draait apart via tools/qr-check.js
    const q=W.qrMatrix("https://floriandelange12.github.io/mandje/?join=ABC123");
    const fin=(r,c)=>q.get(r,c)&&q.get(r+6,c)&&q.get(r,c+6)&&q.get(r+6,c+6)&&q.get(r+3,c+3)&&!q.get(r+1,c+1);
    ok("Fase 7b: QR-matrix versie 4 (33×33) met drie finders en donkere module", !!q && q.version===4 && q.size===33 && fin(0,0) && fin(0,26) && fin(26,0) && q.get(25,8)===true);
    ok("Fase 7b: qrSvg levert een SVG met pad", /^<svg[^>]*viewBox="0 0 29 29"/.test(W.qrSvg("Mandje",{px:120})) && /<path d="M/.test(W.qrSvg("Mandje")));
    // d) Aan-de-slag-kaart: stappen vinken zichzelf af
    const steps=W.onboardSteps();
    ok("Fase 7b: Aan de slag heeft 5 stappen, 'zet iets op je lijst' is al gedaan", steps.length===5 && steps[0].done===true && steps[1].done===false);
    const card=D.querySelector("#onboard-card .ritual.onboard");
    ok("Fase 7b: kaart zichtbaar met 1 van 5 gedaan", !!card && /1 van 5/.test(card.textContent) && card.querySelectorAll(".ob-step.done").length===1);
    card.querySelector(".r-x").click(); await wait(30);
    ok("Fase 7b: kaart wegtikken is blijvend", !D.querySelector("#onboard-card .ritual") && JSON.parse(W.localStorage.getItem("mandje.v2")).settings.onboardDismissed===true);
    // e) row-cache: ongewijzigde rij is hetzelfde DOM-element na een re-render; gewijzigde rij is nieuw
    const before=D.querySelector('#open-list li.row[data-id="a1"]');
    W.addToList("Brood", null, {silent:true}); await wait(30);
    const after=D.querySelector('#open-list li.row[data-id="a1"]');
    ok("Fase 7b: row-cache hergebruikt een ongewijzigde rij", before===after);
    after.querySelector(".q-plus").click(); await wait(30);
    const after2=D.querySelector('#open-list li.row[data-id="a1"]');
    ok("Fase 7b: gewijzigde rij (aantal) wordt opnieuw gebouwd", after2!==after && after2.querySelector(".qty span").textContent==="4");
    d34.window.close();
  }

  console.log("\nt3: "+pass+" geslaagd, "+fail+" gefaald");
  process.exit(fail?1:0);
})().catch(e=>{console.error("t3 TESTFOUT:",e);process.exit(2)});
