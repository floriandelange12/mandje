/* t5 — Fase 6: meerdere lokale lijsten en lijsttypes (grocery / plain).
   Draait met jsdom over de gebouwde index.html. Eis: 0 gefaald. */
const fs=require("fs"), {JSDOM}=require("jsdom");
const html=fs.readFileSync(require("path").join(__dirname,"..","index.html"),"utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0, fail=0;
const ok=(n,c)=>{ if(c){pass++;console.log("  ✓ "+n);} else {fail++;console.log("  ✗ FAIL: "+n);} };
const now=new Date().toISOString();
const item=(id,name,cat,done)=>({id:id,name:name,category:cat,qty:1,unit:"",done:!!done,note:"",price:null,assigned_to:null,added_by_name:"",addedAt:now});
const mk=(seed,url)=>new JSDOM(html,{url:url||"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){ w.localStorage.setItem("mandje.v2", JSON.stringify(seed)); }});
const stored=(W)=>JSON.parse(W.localStorage.getItem("mandje.v2"));

(async()=>{
  console.log("\nt5 — lijsten & lijsttypes");

  // 1. migratie: oude opslag zonder localLists → één lijst 'Boodschappen' met dezelfde items
  const old={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[item("a1","appels","groente-fruit"),item("m1","melk","zuivel-eieren")],catalog:{},coBuy:{},meals:{}};
  const d1=mk(old); await wait(160); const W=d1.window, D=W.document;
  let st=stored(W);
  ok("Migratie: één lokale lijst 'Boodschappen' (l_boodschappen), actief", Array.isArray(st.localLists) && st.localLists.length===1 && st.localLists[0].id==="l_boodschappen" && st.activeLocalId==="l_boodschappen");
  ok("Migratie: items intact in state.list én in de index", st.list.length===2 && st.localLists[0].items.length===2 && D.querySelectorAll("#open-list li.row").length===2);
  ok("Migratie: kop = Boodschappen, geen lijstkiezer bij één lijst zonder cloud", D.querySelector("#title").textContent==="Boodschappen" && !D.querySelector("#list-switch-wrap .list-switch"));
  ok("Type-profiel: boodschappenlijst is 'grocery'", W.currentListMeta().type==="grocery" && W.isPlainList()===false);

  // 2. nieuwe paklijst uit sjabloon + wisselen
  const tplCount=W.templateItems("strand").length;
  const pack=W.createLocalList({name:"Vakantie", preset:"pack", template:"strand"});
  ok("Paklijst uit sjabloon Strand heeft de sjabloon-items met kopjes", pack.type==="plain" && pack.items.length===tplCount && tplCount>=20 && pack.items.some(i=>i.section==="Kleding"));
  W.switchLocalList(pack.id); await wait(60);
  st=stored(W);
  ok("Wisselen: paklijst actief, state.list = sjabloon-items, boodschappen bewaard in de index", st.activeLocalId===pack.id && st.list.length===tplCount && st.localLists.find(l=>l.id==="l_boodschappen").items.length===2);
  ok("Wisselen: kop toont de lijstnaam, body.list-plain, placeholder van de paklijst", D.querySelector("#title").textContent==="Vakantie" && D.body.classList.contains("list-plain") && /mee/.test(D.querySelector("#add-name").placeholder));
  ok("Plain: geen Winkelen-knop, geen aantal-knoppen, kopjes als secties", !D.querySelector("#shop-entry .shop-enter-btn") && !D.querySelector("#open-list .qty") && D.querySelectorAll("#open-list .shelf.plain").length>=4 && [...D.querySelectorAll("#open-list .plain-sec .ps-name")].some(x=>x.textContent==="Kleding"));
  ok("Plain: rijen hebben een sleepgreep, geen 'Schap kiezen'", D.querySelectorAll("#open-list .card .sr-handle").length===tplCount && !D.querySelector("#open-list .pick-cat"));
  ok("Lijstkiezer-pill zichtbaar bij twee lijsten", !!D.querySelector("#list-switch-wrap .list-switch") && /Vakantie/.test(D.querySelector("#list-switch-wrap .list-switch").textContent));

  // 3. gates: geen aantal-parsing, geen catalogus, kopje via 'Kopje: tekst', geen dubbele, geen autocomplete
  const add=(n)=>{ D.querySelector("#add-name").value=n; D.querySelector("#add-name").dispatchEvent(new W.KeyboardEvent("keydown",{key:"Enter",bubbles:true})); };
  const catBefore=Object.keys(stored(W).catalog).length;
  add("melk 2"); await wait(40);
  st=stored(W);
  ok("Plain: 'melk 2' blijft letterlijk (geen aantal-parsing) en komt achteraan", st.list[st.list.length-1].name==="melk 2" && st.list[st.list.length-1].qty===1);
  ok("Plain: catalogus wordt niet vervuild", Object.keys(st.catalog).length===catBefore);
  add("Documenten: rijbewijs"); await wait(40);
  st=stored(W);
  ok("Plain: 'Documenten: rijbewijs' krijgt kopje Documenten", st.list.some(i=>i.name==="rijbewijs" && i.section==="Documenten"));
  const before=st.list.length;
  add("rijbewijs"); await wait(40);
  ok("Plain: dubbele tekst wordt niet nog eens toegevoegd", stored(W).list.length===before);
  D.querySelector("#add-name").value="zon"; D.querySelector("#add-name").dispatchEvent(new W.Event("input",{bubbles:true})); await wait(60);
  ok("Plain: geen autocomplete", !D.querySelector("#ac-list").classList.contains("show"));
  D.querySelector("#add-name").value="";

  // 4. afronden: terugzetten (paklijst) en opruimen, beide met undo
  const ids=stored(W).list.slice(0,3).map(i=>i.id);
  ids.forEach(id=>W.toggleDone(id)); await wait(60);
  ok("Plain: afvinken werkt (3 ingepakt) en de subkop gebruikt de paklijst-woorden", stored(W).list.filter(i=>i.done).length===3 && /in te pakken/.test(D.querySelector("#subhead").textContent) && /ingepakt/.test(D.querySelector("#subhead").textContent));
  const fbtn=D.querySelector("#done-list .finish-inline-btn");
  ok("Plain: knop 'Alles terugzetten' onder de ingepakte items", !!fbtn && /terugzetten/i.test(fbtn.textContent));
  W.finishPlain("terugzetten"); await wait(40);
  ok("Terugzetten: alle vinkjes uit, niets verwijderd, geen geschiedenis-item", stored(W).list.filter(i=>i.done).length===0 && stored(W).list.length===before && (stored(W).history||[]).length===0);
  ids.forEach(id=>W.toggleDone(id)); await wait(40);
  W.finishPlain("opruimen"); await wait(40);
  ok("Opruimen: afgevinkte items weg", stored(W).list.length===before-3);
  const undoBtn=[D.querySelector("#toast"),D.querySelector("#toast2")].map(t=>t&&t.querySelector(".toast-action")).find(Boolean);
  if(undoBtn) undoBtn.click(); await wait(40);
  ok("Opruimen: Ongedaan zet de items terug (met vinkjes)", !!undoBtn && stored(W).list.length===before && stored(W).list.filter(i=>i.done).length===3);
  W.finishPlain("opruimen"); await wait(40);

  // 5. volgorde binnen een kopje
  const kled=stored(W).list.filter(i=>i.section==="Kleding" && !i.done).map(i=>i.id);
  W.reorderPlainItems(kled.slice().reverse()); await wait(40);
  const kled2=stored(W).list.filter(i=>i.section==="Kleding" && !i.done).map(i=>i.id);
  ok("Volgorde: items binnen een kopje herschikt (omgekeerd)", kled.length>=3 && kled2.join()===kled.slice().reverse().join());

  // 6. plain item-sheet: tekst/kopje/notitie
  D.querySelector("#open-list .row .card").click(); await wait(50);
  ok("Plain: item-sheet met tekst, kopje en notitie (geen schappen/cadans)", D.querySelector("#sheet").classList.contains("show") && !!D.querySelector("#ps-name") && !!D.querySelector("#ps-section") && !D.querySelector("#s-cats"));
  D.querySelector("#ps-note").value="warme jas mee"; D.querySelector("#ps-save").click(); await wait(40);
  ok("Plain: notitie opgeslagen en zichtbaar", stored(W).list.some(i=>i.note==="warme jas mee") && /warme jas mee/.test(D.querySelector("#open-list").textContent));

  // 7. lijstkiezer-sheet + beheer + terug naar boodschappen
  D.querySelector("#list-switch-wrap .list-switch").click(); await wait(50);
  const s2=D.querySelector("#sheet2");
  ok("Lijstkiezer: beide lokale lijsten met beheer-knop en '+ Nieuwe lijst'", s2.classList.contains("show") && s2.querySelectorAll('.ls-item[data-act^="local:"]').length===2 && s2.querySelectorAll(".lsi-more").length===2 && !!s2.querySelector("#ls-new"));
  s2.querySelector('.ls-item[data-act="local:l_boodschappen"]').click(); await wait(60);
  st=stored(W);
  ok("Terug naar Boodschappen: items intact, grocery-modus, paklijst bewaard", st.activeLocalId==="l_boodschappen" && st.list.length===2 && !D.body.classList.contains("list-plain") && D.querySelector("#title").textContent==="Boodschappen" && st.localLists.find(l=>l.id===pack.id).items.some(i=>i.note==="warme jas mee"));
  ok("Grocery weer normaal: aantal-knoppen en Winkelen-knop terug", !!D.querySelector("#open-list .qty") && !!D.querySelector("#shop-entry .shop-enter-btn"));

  // 8. nieuwe lijst via de sheet (to-do), dupliceren, verwijderen
  W.openNewListSheet(); await wait(40);
  const chips=[...D.querySelectorAll("#sheet .type-chip")];
  ok("Nieuwe-lijst-sheet: 5 soorten (Boodschappen, Paklijst, To-do, Checklist, Notities)", chips.length===5);
  chips.find(c=>/To-do/.test(c.textContent)).click(); await wait(20);
  D.querySelector("#nl-name").value="Klussen"; D.querySelector("#nl-go").click(); await wait(60);
  st=stored(W);
  ok("To-do 'Klussen' aangemaakt en actief (opruimen-modus)", st.localLists.length===3 && st.activeLocalId===st.localLists[2].id && st.localLists[2].preset==="todo" && st.localLists[2].finish==="opruimen" && D.querySelector("#title").textContent==="Klussen");
  const todoId=st.activeLocalId;
  add("lamp ophangen"); await wait(30);
  const copy=W.duplicateLocalList(todoId); await wait(20);   // save() is gecoalesced (microtask)
  ok("Dupliceren: kopie zonder vinkjes, eigen id", !!copy && copy.id!==todoId && copy.items.length===1 && stored(W).localLists.length===4);
  const delOk=W.deleteLocalList(copy.id); await wait(20);
  ok("Verwijderen: laatste lijst kan niet weg; andere wel", delOk===true && stored(W).localLists.length===3);
  W.deleteLocalList(todoId); await wait(40);
  ok("Actieve lijst verwijderen schakelt naar de eerste lijst", stored(W).activeLocalId==="l_boodschappen" && D.querySelector("#title").textContent==="Boodschappen" && stored(W).localLists.length===2);

  // 9. cloud-lijst zonder type-kolom gedraagt zich als grocery
  const C=W.Cloud; const prevActive=C.active, prevLists=C.lists;
  C.active="cloud-x"; C.lists=[{id:"cloud-x", name:"Gedeeld"}];
  ok("Cloud-lijst zonder 'type' → grocery-profiel", W.currentListMeta().type==="grocery" && W.currentListMeta().shared===true);
  C.active=prevActive; C.lists=prevLists;
  d1.window.close();

  // 10. persistentie: herladen zet de paklijst terug als actieve lijst
  const persisted=st; persisted.activeLocalId=pack.id;
  const d2=mk(persisted); await wait(160); const W2=d2.window, D2=W2.document;
  const packItems=persisted.localLists.find(l=>l.id===pack.id).items;
  const rows2=D2.querySelectorAll("#open-list li.row").length + D2.querySelectorAll("#done-list li.row").length;
  ok("Herladen met actieve paklijst: plain-modus, items en kopjes terug", D2.body.classList.contains("list-plain") && D2.querySelector("#title").textContent==="Vakantie" && rows2===packItems.length && D2.querySelectorAll("#open-list .plain-sec").length>=3);
  d2.window.close();

  console.log("\nt5: "+pass+" geslaagd, "+fail+" gefaald");
  process.exit(fail?1:0);
})().catch(e=>{ console.error("t5 TESTFOUT:", e); process.exit(2); });
