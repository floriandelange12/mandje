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

  // 11. Review-regressies (2026-09-06): cloud-lijst open + lokale lijsten, lijstgebonden undo, overlay sluit→open, escaping, kopje-regels
  {
    // Supabase-stub: één cloud-item, één lid; genoeg voor Cloud.open() via het echte pad
    const mkStub=()=>{
      const q=(table)=>{ const o={}; ["select","eq","neq","in","is","not","gte","lte","order","single","maybeSingle","limit","update","insert","delete","upsert"].forEach(m=>{ o[m]=function(){ return o; }; });
        o.then=(res)=>{ let data=[]; if(table==="items") data=[{id:"c1",list_id:"c1",name:"Cloudkaas",category:"kaas-vleeswaren",qty:1,price:null,note:"",unit:"",done:false,assigned_to:null,added_by_name:"Sanne",created_at:new Date().toISOString()}]; if(table==="members") data=[{id:"m1",list_id:"c1",user_id:"u1",display_name:"Ik",color:"#24593F"}]; return Promise.resolve({data:data,error:null}).then(res); };
        return o; };
      return { from:(t)=>q(t), rpc:()=>q("rpc"), removeChannel(){}, channel(){ const c={}; c.on=()=>c; c.subscribe=()=>c; c.track=()=>{}; c.presenceState=()=>({}); c.unsubscribe=()=>{}; return c; } };
    };
    const seedR={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[item("a1","appels","groente-fruit"),item("m1","melk","zuivel-eieren")],catalog:{},coBuy:{},meals:{},
      localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit"),item("m1","melk","zuivel-eieren")]},{id:"l_b",name:"B-lijst",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("s1","schroeven","klussen")]}],activeLocalId:"l_boodschappen"};
    const dR=mk(seedR); await wait(160); const W=dR.window, D=W.document, C=W.Cloud;
    C.sb=mkStub(); C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u1"; C.lists=[{id:"c1",name:"Gedeeld",owner_user_id:"u1",member_count:2}];
    await C.open("c1").catch(()=>{}); await wait(60);
    ok("Review: cloud-lijst open → state.list = cloud-items, persoonlijke lijst in snapshot", C.active==="c1" && stored(W).list.map(i=>i.name).join()==="appels,melk" && /Cloudkaas/.test(D.querySelector("#open-list").textContent));
    // a) nieuwe lokale lijst vanuit een cloud-lijst: persoonlijke lijst blijft intact (was: overschreven met cloud-items)
    const todo=W.createLocalList({name:"Klussen", preset:"todo"}); W.switchLocalList(todo.id); await wait(60);
    let st=stored(W);
    ok("Review: nieuwe lijst vanuit cloud-lijst laat Boodschappen intact (appels,melk)", st.localLists.find(l=>l.id==="l_boodschappen").items.map(i=>i.name).join()==="appels,melk" && st.activeLocalId===todo.id && C.active===null);
    // b) lokale lijst verwijderen terwijl een cloud-lijst open staat: de volgende lijst houdt haar eigen items
    W.switchLocalList("l_boodschappen"); await wait(40);
    C.sb=mkStub(); C.enabled=true; C.ready=true; C.mode="cloud";
    await C.open("c1").catch(()=>{}); await wait(60);
    W.deleteLocalList("l_boodschappen"); await wait(40);
    st=stored(W);
    ok("Review: verwijderen van de actieve lokale lijst tijdens een open cloud-lijst laat B-lijst intact (schroeven)", st.localLists.find(l=>l.id==="l_b").items.map(i=>i.name).join()==="schroeven" && st.activeLocalId==="l_b");
    // c) dupliceren vanuit een cloud-lijst kopieert de lokale items, niet de cloud-items
    const copy=W.duplicateLocalList("l_b"); await wait(30);
    ok("Review: dupliceren tijdens een open cloud-lijst kopieert de lokale items", !!copy && copy.items.map(i=>i.name).join()==="schroeven");
    C.openLocal(); await wait(60);
    // d) undo is lijstgebonden
    W.addToList("bellen", null, {silent:true}); await wait(30);
    const idBel=stored(W).list.find(i=>i.name==="bellen").id;
    W.removeFromList(idBel); await wait(30);
    W.switchLocalList(todo.id); await wait(40);
    const undoBtn=[D.querySelector("#toast"),D.querySelector("#toast2")].map(t=>t&&t.classList.contains("show")&&t.querySelector(".toast-action")).find(Boolean);
    if(undoBtn) undoBtn.click(); await wait(40);
    st=stored(W);
    ok("Review: 'Ongedaan' na een lijstwissel raakt de andere lijst niet", !!undoBtn && !st.list.some(i=>i.name==="bellen") && !st.localLists.find(l=>l.id===todo.id).items.some(i=>i.name==="bellen"));
    // e) overlay sluiten en direct openen (lijstkiezer → + Nieuwe lijst) blijft open na de uitgestelde history.back()
    D.querySelector("#list-switch-wrap .list-switch").click(); await wait(50);
    D.querySelector("#sheet2 #ls-new").click(); await wait(150);
    ok("Review: sluit→open in dezelfde tick: 'Nieuwe lijst'-sheet blijft open", D.querySelector("#sheet").classList.contains("show") && !!D.querySelector("#nl-name") && !D.querySelector("#sheet2").classList.contains("show"));
    D.querySelector("#nl-cancel").click(); await wait(80);
    // f) kopje-regels: tijden splitsen niet, dubbel per kopje toegestaan; kopje-chip is tekst
    W.addToList("Tandarts 10:30", null, {silent:true}); W.addToList("Kind: tandenborstel", null, {silent:true}); await wait(20);
    const okDup=W.addToList("Ik: tandenborstel", null, {silent:true}); await wait(30);
    st=stored(W);
    ok("Review: 'Tandarts 10:30' blijft één tekst; zelfde tekst onder een ander kopje mag", st.list.some(i=>i.name==="Tandarts 10:30" && !i.section) && okDup===true && st.list.filter(i=>i.name==="tandenborstel").length===2);
    W.addToList("<i onerror=alert(1)>K</i>: hoed", null, {silent:true});   // kopje ≤ 30 tekens, anders is het geen kopje await wait(20);
    const row=[...D.querySelectorAll("#open-list li.row")].find(r=>/hoed/.test(r.textContent)); row.querySelector(".card .meta").click(); await wait(40);
    ok("Review: kopje met HTML wordt als tekst getoond in het item-sheet", !D.querySelector("#sheet #ps-secchips i") && [...D.querySelectorAll("#sheet #ps-secchips .cadchip")].some(b=>/onerror/.test(b.textContent)));
    D.querySelector("#ps-del").click(); await wait(60);
    // g) lege staat escapet de lijstnaam
    W.renameLocalList(todo.id, "<img src=x onerror=window.__pwn2=1>"); await wait(10);
    stored(W).list.length; W.finishPlain("opruimen"); await wait(20);
    const ids=stored(W).list.map(i=>i.id); ids.forEach(id=>W.removeFromList(id)); await wait(60);
    ok("Review: lege staat toont een lijstnaam met HTML als tekst", !W.__pwn2 && !D.querySelector("#open-list .empty img") && /onerror/.test(D.querySelector("#open-list .empty h2").textContent));
    // h) kaart zonder role=button; naam is een knop die het sheet opent
    W.switchLocalList("l_b"); await wait(40);
    const card=D.querySelector("#open-list .card");
    ok("Review: geen role=button op de kaart; de naam is een knop met label", !!card && !card.hasAttribute("role") && card.querySelector("button.meta") && /schroeven/.test(card.querySelector("button.meta").getAttribute("aria-label")));
    card.querySelector("button.meta").click(); await wait(40);
    ok("Review: naam-knop opent het item-sheet", D.querySelector("#sheet").classList.contains("show") && !!D.querySelector("#s-cats"));
    dR.window.close();
  }

  // 12. Fase 3A — sync: afronden = soft-delete met undo, huishoud-geschiedenis, wachtrij die een herstart overleeft, cache, RPC-fallbacks
  {
    // Stub met call-log: elke keten eindigt in .then; rpc('item_bump_qty') telt op, rpc(onbekend) → PGRST202
    const mkStub2=(opts)=>{
      opts=opts||{}; const calls=[]; let items=[
        {id:"c1",list_id:"c1",name:"Cloudkaas",category:"kaas-vleeswaren",qty:1,price:null,note:"",unit:"",done:true,assigned_to:null,added_by_name:"Sanne",created_at:new Date().toISOString(),bought_at:null},
        {id:"c2",list_id:"c1",name:"Cloudmelk",category:"zuivel-eieren",qty:2,price:null,note:"",unit:"",done:false,assigned_to:null,added_by_name:"Ik",created_at:new Date().toISOString(),bought_at:null}];
      const q=(table)=>{ const o={table:table, ops:[]}; ["select","eq","neq","in","is","not","gte","lte","order","single","maybeSingle","limit","update","insert","delete","upsert"].forEach(m=>{ o[m]=function(){ o.ops.push([m].concat([].slice.call(arguments))); return o; }; });
        o.then=(res,rej)=>{ calls.push(o); let data=[], error=null;
          if(table==="items"){
            const isNull=o.ops.some(x=>x[0]==="is"&&x[1]==="bought_at");
            if(opts.noBoughtAt && isNull){ error={code:"42703", message:"column items.bought_at does not exist"}; }
            else if(o.ops[0][0]==="select"){ data=items.filter(i=>!isNull || i.bought_at==null); if(o.ops.some(x=>x[0]==="not")) data=items.filter(i=>i.bought_at); }
            else if(o.ops[0][0]==="update"){ const f=o.ops[0][1]; if(opts.noBoughtAt && "bought_at" in f){ error={code:"PGRST204", message:"Could not find the 'bought_at' column of 'items' in the schema cache"}; } else { const ids=(o.ops.find(x=>x[0]==="in")||[])[2]||[]; const id=(o.ops.find(x=>x[0]==="eq")||[])[2]; items.forEach(i=>{ if(ids.indexOf(i.id)!==-1 || i.id===id) Object.assign(i,f); }); } }
            else if(o.ops[0][0]==="delete"){ const ids=(o.ops.find(x=>x[0]==="in")||[])[2]||[]; const id=(o.ops.find(x=>x[0]==="eq")||[])[2]; items=items.filter(i=>ids.indexOf(i.id)===-1 && i.id!==id); }
          }
          if(table==="members") data=[{id:"m1",list_id:"c1",user_id:"u1",display_name:"Ik",color:"#24593F"}];
          if(table==="user_state"){
            const op=o.ops[0][0];
            if(op==="select"){ data = o.ops.some(x=>x[0]==="maybeSingle") ? (userState||null) : (userState?[userState]:[]); }
            else if(op==="upsert"){ userState=JSON.parse(JSON.stringify(o.ops[0][1])); data=[{updated_at:userState.updated_at}]; }
            else if(op==="update"){ const f=o.ops[0][1], lte=o.ops.find(x=>x[0]==="lte"); if(userState && (!lte || userState.updated_at<=lte[2])){ userState=JSON.parse(JSON.stringify(Object.assign({},userState,f))); data=[{updated_at:userState.updated_at}]; } else data=[]; }
          }
          return Promise.resolve({data:data,error:error}).then(res,rej); };
        return o; };
      let userState=opts.userState||null;
      const sb={ calls:calls, items:()=>items, userState:()=>userState, from:(t)=>q(t), removeChannel(){}, channel(){ const c={}; c.on=()=>c; c.subscribe=()=>c; c.track=()=>{}; c.presenceState=()=>({}); c.unsubscribe=()=>{}; return c; },
        rpc:(name,args)=>{ const o={table:"rpc:"+name, args:args, ops:[]}; o.then=(res,rej)=>{ calls.push(o); let r={data:null,error:null};
          if(name==="item_bump_qty" && !opts.noRpc){ const it=items.find(i=>i.id===args.p_id); if(it){ it.qty=Math.max(1,it.qty+args.p_delta); r.data=it.qty; } }
          else if(name==="member_heartbeat" && !opts.noRpc){ r.data=true; }
          else r.error={code:"PGRST202", message:"Could not find the function public."+name};
          return Promise.resolve(r).then(res,rej); }; return o; } };
      return sb;
    };
    const seedS={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[item("a1","appels","groente-fruit")],catalog:{},coBuy:{},meals:{},history:[],
      localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit")]}],activeLocalId:"l_boodschappen"};
    const dS=mk(seedS); await wait(160); const W=dS.window, D=W.document, C=W.Cloud;
    const sb=mkStub2(); C.sb=sb; C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u1"; C.lists=[{id:"c1",name:"Gedeeld",owner_user_id:"u1",member_count:2}];
    await C.open("c1").catch(()=>{}); await wait(80);
    const sel=sb.calls.filter(c=>c.table==="items" && c.ops[0][0]==="select");
    ok("3A: refreshItems filtert op bought_at is null en onthoudt dat de kolom bestaat", C.active==="c1" && sel.some(c=>c.ops.some(x=>x[0]==="is"&&x[1]==="bought_at"&&x[2]===null)) && C._hasBoughtAt===true);
    ok("3A: cloud-cache gevuld na een geslaagde refresh (naam, tijd, items)", !!stored(W).cloudCache && !!stored(W).cloudCache.c1 && stored(W).cloudCache.c1.items.length===2 && stored(W).cloudCache.c1.name==="Gedeeld");
    ok("3A: huishoud-geschiedenis opgevraagd (bought_at not null, laatste 180 dagen)", sel.some(c=>c.ops.some(x=>x[0]==="not"&&x[1]==="bought_at") && c.ops.some(x=>x[0]==="gte"&&x[1]==="bought_at")));

    // afronden: soft-delete + undo via 'Terug op de lijst'
    const before=sb.calls.length;
    C.finish(); await wait(60);
    const upd=sb.calls.slice(before).find(c=>c.table==="items" && c.ops[0][0]==="update");
    ok("3A: afronden = update({bought_at, done:true}).in('id',[…]) — geen delete", !!upd && !!upd.ops[0][1].bought_at && upd.ops[0][1].done===true && upd.ops.some(x=>x[0]==="in"&&x[2].join()==="c1") && !sb.calls.slice(before).some(c=>c.table==="items"&&c.ops[0][0]==="delete"));
    ok("3A: afgerond item weg uit de lijst, nog wel in de cloud (soft)", !/Cloudkaas/.test(D.querySelector("#open-list").textContent) && sb.items().some(i=>i.id==="c1" && i.bought_at));
    let st=stored(W);
    ok("3A: lokale boekhouding via finishAfterCloud: geschiedenis + koopdatum in de catalogus", st.history.length===1 && st.history[0].count===1 && st.history[0].list==="c1" && !!st.catalog["cloudkaas"] && st.catalog["cloudkaas"].purchaseDates.length===1);
    const undoBtn=D.querySelector("#sheet #fin-undo");
    ok("3A: Klaar-blad heeft 'Terug op de lijst' (undo) op een cloud-lijst", !!undoBtn);
    if(undoBtn){ undoBtn.click(); await wait(120); }
    st=stored(W);
    const undoUpd=sb.calls.find(c=>c.table==="items" && c.ops[0][0]==="update" && c.ops[0][1].bought_at===null);
    ok("3A: undo zet bought_at terug op null, haalt de rit uit de geschiedenis en de koopdatum uit de catalogus", !!undoUpd && st.history.length===0 && (!st.catalog["cloudkaas"] || st.catalog["cloudkaas"].purchaseDates.length===0) && sb.items().find(i=>i.id==="c1").bought_at===null);
    await wait(120);
    ok("3A: na undo staat het item weer in de lijst (met vinkje, zoals lokaal)", /Cloudkaas/.test(D.querySelector("#open-list").textContent + D.querySelector("#done-list").textContent));

    // aantal via RPC (telt op) en fallback zonder RPC
    const nBefore=sb.calls.length;
    C.qty("c2", 1); await wait(40);
    const rpcCall=sb.calls.slice(nBefore).find(c=>c.table==="rpc:item_bump_qty");
    ok("3A: aantal via item_bump_qty (p_id, p_delta) i.p.v. overschrijven", !!rpcCall && rpcCall.args.p_id==="c2" && rpcCall.args.p_delta===1 && sb.items().find(i=>i.id==="c2").qty===3);
    C._hasBumpRpc=undefined; sb.calls.length=0;
    const sbNo=mkStub2({noRpc:true}); C.sb=sbNo;
    C.qty("c2", 1); await wait(40);
    ok("3A: zonder RPC (PGRST202) valt aantal terug op update({qty}) en onthoudt dat", C._hasBumpRpc===false && sbNo.calls.some(c=>c.table==="items" && c.ops[0][0]==="update" && c.ops[0][1].qty===4));
    C.sb=sb;

    // wachtrij: zonder client direct in de wachtrij, en persistent
    C.sb=null; C._pending.length=0;
    C.toggle("c2", {quiet:true}); await wait(40);
    st=stored(W);
    ok("3A: mutatie zonder client gaat in de wachtrij én in localStorage (syncQueue)", C._pending.length===1 && C._pending[0].op==="update" && Array.isArray(st.syncQueue) && st.syncQueue.length===1 && st.syncQueue[0].id==="c2");
    C._pending.length=0; C._restoreQueue();
    ok("3A: _restoreQueue haalt de wachtrij terug uit de opgeslagen staat", C._pending.length===1 && C._pending[0].id==="c2");
    C.sb=sb; sb.calls.length=0;
    C._pending.push({op:"insert", tmpId:"tmp_x", payload:{list_id:"andere-lijst", name:"x"}});
    C.flushPending(); await wait(60);
    ok("3A: flushPending verstuurt de update en bewaart de insert voor een andere lijst (niet droppen)", sb.calls.some(c=>c.table==="items"&&c.ops[0][0]==="update") && C._pending.some(e=>e.op==="insert" && e.payload.list_id==="andere-lijst") && !C._pending.some(e=>e.op==="update"));
    C._pending.length=0; C._persistQueue(); await wait(30);
    ok("3A: lege wachtrij → syncQueue leeg", stored(W).syncQueue.length===0);

    // hervatten: hooguit 1× per 3 s verversen
    sb.calls.length=0; C._resumeAt=0;
    W.onAppResume(); W.onAppResume(); await wait(60);
    const selN=sb.calls.filter(c=>c.table==="items" && c.ops[0][0]==="select" && c.ops.some(x=>x[0]==="is")).length;
    ok("3A: onAppResume ververst de lijst één keer (throttle 3 s)", selN===1);

    // mergePurchaseDate: datum erbij zonder timesAdded te verhogen; dubbel = false
    const isoD=new Date(Date.now()-3*86400000).toISOString();
    const m1=W.mergePurchaseDate("Halfvolle melk","zuivel-eieren",isoD), m2=W.mergePurchaseDate("Halfvolle melk","zuivel-eieren",isoD);
    W.saveNow(); st=stored(W);
    ok("3A: mergePurchaseDate maakt/vult de cataloguspost (timesAdded 0) en negeert een dubbele datum", m1===true && m2===false && !!st.catalog["halfvolle melk"] && st.catalog["halfvolle melk"].purchaseDates.length===1 && st.catalog["halfvolle melk"].timesAdded===0);

    // zonder bought_at-kolom: afronden valt terug op delete
    const sbOld=mkStub2({noBoughtAt:true}); C.sb=sbOld; C._hasBoughtAt=undefined;
    await C.refreshItems(C._activeRefreshToken); await wait(40);
    ok("3A: zonder kolom bought_at → tweede select zonder filter, _hasBoughtAt=false", C._hasBoughtAt===false && sbOld.calls.filter(c=>c.table==="items"&&c.ops[0][0]==="select").length>=2);
    C.finish(); await wait(60);
    ok("3A: zonder kolom → afronden verwijdert hard (delete().in)", sbOld.calls.some(c=>c.table==="items"&&c.ops[0][0]==="delete"&&c.ops.some(x=>x[0]==="in")) && !D.querySelector("#sheet #fin-undo"));
    dS.window.close();

    // cache-balk: koude start zonder cloud terwijl er een gedeelde lijst open stond
    const seedC=Object.assign({}, seedS, {cloudCache:{c1:{name:"Gedeeld", at:new Date().toISOString(), items:[{id:"c1",name:"Cloudkaas",category:"kaas-vleeswaren",qty:1,unit:"",note:"",done:false,added_by_name:"Sanne"},{id:"c2",name:"Cloudmelk",category:"zuivel-eieren",qty:2,unit:"",note:"",done:false,added_by_name:""}]}}});
    const dC=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){ w.localStorage.setItem("mandje.v2", JSON.stringify(seedC)); w.localStorage.setItem("mandje.activeList","c1"); }});
    await wait(700); const WC=dC.window, DC=WC.document, CC=WC.Cloud;
    // cloud-init faalt in jsdom (geen SDK) → offline-modus; balk hoort er dan te staan
    const bar=DC.querySelector("#cloud-cache-bar .cache-bar");
    ok("3A: cache-balk bij koude start zonder cloud ("+(CC.mode)+"/"+(CC.ready?"ready":"not-ready")+")", CC.mode==="local" && !CC.active && !!bar && /Gedeeld/.test(bar.textContent) && /2 te halen/.test(bar.textContent));
    if(bar){ bar.querySelector("#cc-open").click(); await wait(60); }
    const sh=DC.querySelector("#sheet");
    ok("3A: 'Bekijk de lijst' opent een alleen-lezen blad met de gecachte items per schap", !!bar && sh.classList.contains("show") && /Cloudkaas/.test(sh.textContent) && /Cloudmelk/.test(sh.textContent) && /Alleen-lezen/.test(sh.textContent));
    dC.window.close();

    // 13. Fase 3B — user_state: samenvoegen i.p.v. overschrijven, stempels/grafstenen, voorwaardelijke push
    {
      const day=(n)=>{ const d=new Date(Date.now()-n*86400000); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
      const T0=Date.now()-3600000;
      const remote={ user_id:"u1", device:"iPad · test", updated_at:new Date(T0).toISOString(),
        catalog:{ "melk":{name:"melk",category:"zuivel-eieren",defaultPrice:null,purchaseDates:[day(9),day(2)],timesAdded:4,lastAddedAt:new Date(T0).toISOString(),cadenceMode:"manual",manualIntervalDays:7,u:T0},
                  "kaas":{name:"kaas",category:"kaas-vleeswaren",defaultPrice:2.5,purchaseDates:[day(5)],timesAdded:2,lastAddedAt:null,cadenceMode:"auto",manualIntervalDays:null} },
        co_buy:{ "melk":{"kaas":3}, "kaas":{"melk":3} },
        settings:{ showPrices:true, seenIntro:true, activeStoreId:null, stores:[{id:"st_ipad",name:"Jumbo",order:[]}], _sync:{ settingsAt:{showPrices:T0, stores:T0}, tomb:{catalog:{"oud":T0}, lists:{}, meals:{}, history:{}} } },
        meals:{ "meal_r":{id:"meal_r",name:"Pasta",emoji:"🍝",items:[{name:"pasta",qty:1,unit:""}],updatedAt:new Date(T0).toISOString()} },
        history:[{id:"h_r",at:new Date(T0).toISOString(),count:2,total:null,paid:null,list:"local",items:[{name:"melk",qty:1,unit:"",price:null,category:"zuivel-eieren"}]}],
        local_lists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("r1","brood","brood-bakkerij")],createdAt:new Date(T0).toISOString(),updatedAt:new Date(T0).toISOString()},
                     {id:"l_ipad",name:"Vakantie",type:"plain",preset:"pack",glyph:"🧳",finish:"opruimen",items:[item("r2","paspoort","overig")],createdAt:new Date(T0).toISOString(),updatedAt:new Date(T0).toISOString()}] };
      const seedU={version:3,settings:{theme:"dark",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[item("a1","appels","groente-fruit")],
        catalog:{ "melk":{name:"Melk",category:"zuivel-eieren",defaultPrice:1.2,purchaseDates:[day(9),day(1)],timesAdded:3,lastAddedAt:null,cadenceMode:"auto",manualIntervalDays:null}, "oud":{name:"oud",category:"overig",purchaseDates:[],timesAdded:1,cadenceMode:"auto"} },
        coBuy:{},meals:{},history:[],localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit")]}],activeLocalId:"l_boodschappen"};
      const dU=mk(seedU); await wait(160); const W=dU.window, D=W.document, C=W.Cloud;
      const sb=mkStub2({userState:remote}); C.sb=sb; C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u1"; C.lists=[];
      const okPull=await C.pullUserState(); await wait(40);
      let st=stored(W);
      ok("3B: pull haalt de user_state-rij op (maybeSingle) en meldt succes", okPull===true && sb.calls.some(c=>c.table==="user_state" && c.ops[0][0]==="select" && c.ops.some(x=>x[0]==="maybeSingle")));
      const melk=st.catalog["melk"];
      ok("3B: catalogus samengevoegd: koopdata verenigd, tellers max, remote wint op stempel (handmatig ritme), lokale prijs blijft niet leidend", !!melk && melk.purchaseDates.join()===[day(9),day(2),day(1)].sort().join() && melk.timesAdded===4 && melk.cadenceMode==="manual" && melk.manualIntervalDays===7);
      ok("3B: grafsteen uit de cloud verwijdert 'oud' lokaal; nieuw product 'kaas' komt erbij", !st.catalog["oud"] && !!st.catalog["kaas"] && st.catalog["kaas"].defaultPrice===2.5);
      ok("3B: instellingen per veld: showPrices en winkels volgen de cloud, thema (toestel-eigen) blijft", st.settings.showPrices===true && st.settings.stores.length===1 && st.settings.stores[0].name==="Jumbo" && st.settings.theme==="dark");
      ok("3B: vaak-samen per paar het maximum, bundel en geschiedenis overgenomen", st.coBuy.melk && st.coBuy.melk.kaas===3 && !!st.meals.meal_r && st.history.length===1 && st.history[0].id==="h_r");
      ok("3B: lijsten: remote Boodschappen (gestempeld) wint, maar ongerepte lokale items blijven; paklijst van de iPad erbij", st.localLists.length===2 && st.list.map(i=>i.name).sort().join()==="appels,brood" && st.localLists.some(l=>l.id==="l_ipad" && l.items.length===1));
      ok("3B: samengevoegde staat verschilt van de cloud → push ingepland (lokale items erbij)", D.querySelector("#open-list").textContent.indexOf("brood")!==-1);
      // push: stempel + voorwaardelijke update
      sb.calls.length=0;
      C._usPushTimer && W.clearTimeout(C._usPushTimer);
      const okPush=await C.pushUserState(true); await wait(30);
      const upd=sb.calls.find(c=>c.table==="user_state" && c.ops[0][0]==="update");
      ok("3B: push = voorwaardelijke update (eq user_id, lte updated_at) met catalog/co_buy/settings/meals/history/local_lists + device", okPush===true && !!upd && upd.ops.some(x=>x[0]==="lte"&&x[1]==="updated_at") && ["catalog","co_buy","settings","meals","history","local_lists","device"].every(k=>k in upd.ops[0][1]));
      const pushedSettings=upd.ops[0][1].settings;
      ok("3B: toestel-eigen voorkeuren gaan niet mee (theme/textScale), _sync met settingsAt en grafstenen wel", !("theme" in pushedSettings) && !("textScale" in pushedSettings) && !!pushedSettings._sync && !!pushedSettings._sync.tomb && pushedSettings.showPrices===true);
      ok("3B: local_lists in de push bevat de items van de actieve lijst (state.list) en updatedAt", upd.ops[0][1].local_lists.find(l=>l.id==="l_boodschappen").items.length===2 && !!upd.ops[0][1].local_lists.find(l=>l.id==="l_boodschappen").updatedAt);
      // lokale wijziging → stempel u + settingsAt, en na 5 s automatisch een push
      W.addToList("yoghurt", null, {silent:true}); await wait(30);
      st=stored(W);
      ok("3B: lokale wijziging stempelt het catalogusproduct (u) en de lijst (updatedAt)", !!st.catalog["yoghurt"] && typeof st.catalog["yoghurt"].u==="number" && !!st.localLists[0].updatedAt);
      sb.calls.length=0; await wait(5400);
      ok("3B: 5 s na de laatste save is de staat automatisch gepusht", sb.calls.some(c=>c.table==="user_state" && c.ops[0][0]==="update"));
      // grafsteen bij verwijderen uit de catalogus: verdwijnt uit de push en herrijst niet bij een oudere cloud-kopie
      W.renameCatalogEntry("yoghurt", "kwark"); await wait(30);
      st=stored(W);
      ok("3B: hernoemen = grafsteen voor de oude sleutel + nieuwe post", !!st.sync.tomb.catalog["yoghurt"] && !!st.catalog["kwark"] && !st.catalog["yoghurt"]);
      const older=JSON.parse(JSON.stringify(sb.userState())); older.catalog["yoghurt"]={name:"yoghurt",category:"zuivel-eieren",purchaseDates:[],timesAdded:1,cadenceMode:"auto",u:T0}; older.updated_at=new Date(T0+1000).toISOString();
      const sb2=mkStub2({userState:older}); C.sb=sb2; C._usRemoteAt=null;
      await C.pullUserState(); await wait(30); st=stored(W);
      ok("3B: oudere cloud-kopie laat een verwijderd product niet herrijzen (grafsteen nieuwer dan de stempel)", !st.catalog["yoghurt"] && !!st.catalog["kwark"]);
      // conflict: iemand anders schreef intussen → update matcht niet → eerst pull, dan opnieuw
      const sb3=mkStub2({userState:Object.assign(JSON.parse(JSON.stringify(sb2.userState())), {updated_at:new Date(Date.now()+5000).toISOString(), history:[{id:"h_other",at:new Date().toISOString(),count:1,total:null,paid:null,list:"local",items:[]}]})}); C.sb=sb3; C._usRemoteAt=new Date(T0).toISOString();
      sb3.calls.length=0; const okC=await C.pushUserState(true); await wait(30); st=stored(W);
      const updates=sb3.calls.filter(c=>c.table==="user_state"&&c.ops[0][0]==="update");
      ok("3B: conflict → pull + merge + tweede push; de geschiedenis van het andere toestel is nu ook hier", okC===true && updates.length===2 && sb3.calls.some(c=>c.table==="user_state"&&c.ops[0][0]==="select") && st.history.some(h=>h.id==="h_other"));
      // bundel verwijderen → grafsteen; meal_r komt niet terug uit een oudere rij
      W.deleteMeal("meal_r"); await wait(30); st=stored(W);
      ok("3B: bundel verwijderen zet een grafsteen", !st.meals.meal_r && !!st.sync.tomb.meals.meal_r);
      ok("3B: Diagnose toont de sync-status", (()=>{ D.querySelector("#gear-btn").click(); return /Sync tussen toestellen/.test(D.querySelector("#meer-content").textContent) && /zojuist|geleden/.test(D.querySelector("#meer-content").textContent); })());
      dU.window.close();
    }
  }

  console.log("\nt5: "+pass+" geslaagd, "+fail+" gefaald");
  process.exit(fail?1:0);
})().catch(e=>{ console.error("t5 TESTFOUT:", e); process.exit(2); });
