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

  console.log("\nt3: "+pass+" geslaagd, "+fail+" gefaald");
  process.exit(fail?1:0);
})().catch(e=>{console.error("t3 TESTFOUT:",e);process.exit(2)});
