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
    ok("Review: toewijs-chips in het sheet bevatten geen geïnjecteerde attributen", sheetHtml.indexOf("onmouseover")===-1 && /background:#2F7A4F|cadchip/.test(sheetHtml));
    // kies Mallory als 'wie haalt het' en sla op → itemRow rendert de sub-regel met haar kleur
    const chip=[...docB.querySelectorAll("#s-assign .cadchip")].find(b=>b.dataset.m==="m1"); if(chip) chip.click();
    docB.querySelector("#s-save").click(); await wait(40);
    const rowHtml=docB.querySelector("#open-list").innerHTML;
    ok("Review: rij met toegewezen lid bevat geen geïnjecteerde attributen", rowHtml.indexOf("onmouseover")===-1 && /→ Mallory/.test(docB.querySelector("#open-list").textContent));
    ok("Review: onveilige kleur valt terug op de standaardkleur", /color:#2F7A4F/.test(rowHtml));
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

  console.log("\nt3: "+pass+" geslaagd, "+fail+" gefaald");
  process.exit(fail?1:0);
})().catch(e=>{console.error("t3 TESTFOUT:",e);process.exit(2)});
