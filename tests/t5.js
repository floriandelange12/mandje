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
            else if(o.ops[0][0]==="insert"){ const p=o.ops[0][1]; const row=Object.assign({id:"new_"+(items.length+1), created_at:new Date().toISOString(), bought_at:null, done:false, note:"", unit:"", price:null, assigned_to:null}, p); items.push(row); if(o.ops.some(x=>x[0]==="select")) data=[{id:row.id}]; }
          }
          if(table==="members") data=[{id:"m1",list_id:"c1",user_id:"u1",display_name:"Ik",color:"#24593F"}];
          if(table==="meals" && o.ops[0][0]==="select") data=(opts.meals||[]).map(m=>JSON.parse(JSON.stringify(m)));
          if(table==="user_state"){
            const op=o.ops[0][0];
            if(op==="select"){ data = o.ops.some(x=>x[0]==="maybeSingle") ? (userState||null) : (userState?[userState]:[]); }
            else if(op==="upsert"){ userState=JSON.parse(JSON.stringify(o.ops[0][1])); data=[{updated_at:userState.updated_at}]; }
            else if(op==="update"){ const f=o.ops[0][1], lte=o.ops.find(x=>x[0]==="lte"); if(userState && (!lte || userState.updated_at<=lte[2])){ userState=JSON.parse(JSON.stringify(Object.assign({},userState,f))); data=[{updated_at:userState.updated_at}]; } else data=[]; }
          }
          if(opts.slowInsert && table==="items" && o.ops[0][0]==="insert"){
            return new Promise(r=>{ (sb.pendingInserts=sb.pendingInserts||[]).push(()=>r({data:data,error:error})); }).then(res,rej);
          }
          return Promise.resolve({data:data,error:error}).then(res,rej); };
        return o; };
      let userState=opts.userState||null;
      let authUser=opts.authUser||{id:"u1", email:null, is_anonymous:true}; const authCalls=[]; let authCb=null;
      const auth={ calls:authCalls, user:()=>authUser,
        getUser:async()=>({data:{user:opts.noUser?null:authUser},error:null}), getSession:async()=>({data:{session:{access_token:"tok", user:authUser}},error:null}),
        onAuthStateChange:(cb)=>{ authCb=cb; return {data:{subscription:{unsubscribe(){}}}}; }, fire:(ev,session)=>authCb&&authCb(ev,session),
        updateUser:async(p)=>{ authCalls.push(["updateUser",p]); if(opts.updateFails) return {data:null,error:{message:opts.updateFails}}; authUser=Object.assign({},authUser,{new_email:p.email}); return {data:{user:authUser},error:null}; },
        signInWithOtp:async(p)=>{ authCalls.push(["signInWithOtp",p]); if(!(opts.knownEmails||[]).includes(p.email)) return {data:null,error:{message:"Signups not allowed for otp"}}; return {data:{},error:null}; },
        verifyOtp:async(p)=>{ authCalls.push(["verifyOtp",p]); if(p.token!=="12345678") return {data:null,error:{message:"Token has expired or is invalid"}}; authUser=(p.type==="email_change") ? Object.assign({},authUser,{email:p.email,is_anonymous:false,new_email:null}) : {id:"u2",email:p.email,is_anonymous:false}; return {data:{user:authUser,session:{access_token:"tok2",user:authUser}},error:null}; },
        signOut:async(o)=>{ authCalls.push(["signOut", o||null]); if(opts.signOutFails) return {error:{message:opts.signOutFails}}; authUser={id:"u3",email:null,is_anonymous:true}; return {error:null}; },
        signInAnonymously:async()=>{ authCalls.push(["signInAnonymously"]); return {data:{session:{access_token:"tok3",user:authUser}},error:null}; } };
      const sb={ calls:calls, items:()=>items, userState:()=>userState, auth:auth, from:(t)=>q(t),
        resolveInsert(){ const l=sb.pendingInserts||[]; sb.pendingInserts=[]; l.forEach(f=>f()); }, removeChannel(){}, channel(){ const c={}; c.on=()=>c; c.subscribe=(fn)=>{ c._sub=fn; return c; }; c.track=(p)=>{ (sb.tracked=sb.tracked||[]).push(p); return Promise.resolve("ok"); }; c.presenceState=()=>sb.presence||{}; c.unsubscribe=()=>{}; c.on=(ev,filter,fn)=>{ if(ev==="presence"||(filter&&filter.event==="sync")) c._presence=fn; return c; }; c.fireSync=()=>c._presence&&c._presence(); sb.chan=c; return c; },
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

    // 14. Fase 3C — account met e-mail: koppelen (code), inloggen op een ander toestel, uitloggen, quota, wis dit toestel, nudge
    {
      const seedA={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[item("a1","appels","groente-fruit")],catalog:{},coBuy:{},meals:{},history:[],
        localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit")]}],activeLocalId:"l_boodschappen"};
      const dA=mk(seedA); await wait(160); const W=dA.window, D=W.document, C=W.Cloud;
      const sb=mkStub2({knownEmails:["sanne@voorbeeld.nl"]}); C.sb=sb; C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u1"; C.lists=[{id:"c1",name:"Gedeeld",owner_user_id:"u1",member_count:2}];
      C._setAuthUser(sb.auth.user());
      C.init=async function(){ this.enabled=true; this.ready=true; this.mode="cloud"; const u=await this.sb.auth.getUser(); this.userId=u.data.user.id; this._setAuthUser(u.data.user); this._initCalls=(this._initCalls||0)+1; };
      D.querySelector("#gear-btn").click(); await wait(60);
      const meer=()=>D.querySelector("#meer-content").textContent;
      const btn=(t)=>[...D.querySelectorAll("#meer-content button")].find(b=>b.textContent.trim()===t);
      ok("3C: Meer → Account (anoniem): 'Account maken met e-mail' en 'Ik heb al een account'", /Account/.test(meer()) && !!btn("Account maken met e-mail") && !!btn("Ik heb al een account") && !btn("Beveilig je account met e-mail"));
      ok("3C: 'Wis dit toestel' i.p.v. 'Alles wissen'", !!btn("Wis dit toestel") && !btn("Alles wissen"));
      // koppelen: e-mail → code → verifyOtp(type email_change)
      btn("Account maken met e-mail").click(); await wait(60);
      const sh=D.querySelector("#sheet");
      ok("3C: koppel-blad met e-mailveld en 'Stuur code'", sh.classList.contains("show") && !!sh.querySelector("#acc-email") && sh.querySelector("#acc-go").textContent==="Stuur code" && sh.querySelector("#acc-step2").hidden===true);
      sh.querySelector("#acc-email").value="geen-adres"; sh.querySelector("#acc-go").click(); await wait(30);
      ok("3C: ongeldig adres → waarschuwing, niets verstuurd", !sh.querySelector("#acc-warn").hidden && sb.auth.calls.length===0);
      sh.querySelector("#acc-email").value="Florian@Voorbeeld.nl"; sh.querySelector("#acc-go").click(); await wait(60);
      ok("3C: updateUser({email}) met genormaliseerd adres, stap 2 zichtbaar, knop 'Bevestig'", sb.auth.calls.some(c=>c[0]==="updateUser" && c[1].email==="florian@voorbeeld.nl") && sh.querySelector("#acc-step2").hidden===false && sh.querySelector("#acc-go").textContent==="Bevestig");
      sh.querySelector("#acc-code").value="000000"; sh.querySelector("#acc-go").click(); await wait(60);
      ok("3C: verkeerde code → melding, blad blijft open", !sh.querySelector("#acc-warn").hidden && sh.classList.contains("show"));
      sh.querySelector("#acc-code").value="1234 5678"; sh.querySelector("#acc-go").click(); await wait(80);
      const v=sb.auth.calls.filter(c=>c[0]==="verifyOtp").pop();
      ok("3C: juiste code → verifyOtp(type email_change), blad dicht, account gekoppeld", !!v && v[1].type==="email_change" && v[1].token==="12345678" && !sh.classList.contains("show") && C.hasAccount() && C.authEmail==="florian@voorbeeld.nl");
      D.querySelector("#gear-btn").click(); await wait(30); D.querySelector("#gear-btn").click(); await wait(60);
      ok("3C: Meer → Account toont 'Ingelogd als' + uitloggen + verwijderen", /Ingelogd als/.test(meer()) && /florian@voorbeeld\.nl/.test(meer()) && !!btn("Uitloggen op dit toestel") && !!btn("Verwijder mijn account en cloudgegevens"));
      // uitloggen → signOut + reinit (init opnieuw) → weer anoniem
      W.confirm=()=>true;
      btn("Uitloggen op dit toestel").click(); await wait(120);
      ok("3C: uitloggen roept signOut aan en laadt opnieuw (init), account weg", sb.auth.calls.some(c=>c[0]==="signOut") && C._initCalls>=1 && !C.hasAccount());
      // inloggen op een 'ander toestel': onbekend adres → uitleg; bekend adres → code → verifyOtp(type email) → reinit met ander user_id
      C.lists=[{id:"c1",name:"Gedeeld",owner_user_id:"u1",member_count:2}];   // reinit (stub) laadt geen lijsten; de waarschuwing gaat over deze lijst
      D.querySelector("#gear-btn").click(); await wait(30); D.querySelector("#gear-btn").click(); await wait(60);
      btn("Ik heb al een account").click(); await wait(60);
      ok("3C: inlog-blad waarschuwt over de gedeelde lijst van het anonieme profiel", /gedeelde lijst/.test(sh.querySelector("#acc-intro").textContent));
      sh.querySelector("#acc-email").value="onbekend@voorbeeld.nl"; sh.querySelector("#acc-go").click(); await wait(60);
      ok("3C: onbekend adres → 'Geen account met dit adres' (shouldCreateUser:false)", /Geen account/.test(sh.querySelector("#acc-warn").textContent) && sb.auth.calls.some(c=>c[0]==="signInWithOtp" && c[1].options.shouldCreateUser===false));
      sh.querySelector("#acc-email").value="sanne@voorbeeld.nl"; sh.querySelector("#acc-go").click(); await wait(60);
      const initsBefore=C._initCalls||0;
      sh.querySelector("#acc-code").value="12345678"; sh.querySelector("#acc-go").click(); await wait(120);
      const v2=sb.auth.calls.filter(c=>c[0]==="verifyOtp").pop();
      ok("3C: bekend adres → code → verifyOtp(type email) → opnieuw geladen onder het account (user_id u2)", !!v2 && v2[1].type==="email" && C.userId==="u2" && C.authEmail==="sanne@voorbeeld.nl" && (C._initCalls||0)===initsBefore+1 && !sh.classList.contains("show"));
      // quota vol → ruimte maken + toast met 'Exporteer'
      const origSet=W.Storage.prototype.setItem; let threw=0;   // Storage heeft een named-setter: overschrijven moet op het prototype
      W.Storage.prototype.setItem=function(k,v){ if(k==="mandje.v2" && threw===0){ threw++; const e=new Error("quota"); e.name="QuotaExceededError"; throw e; } return origSet.call(this,k,v); };
      W.addToList("quotakaas", null, {silent:true}); await wait(40);
      const qToast=[D.querySelector("#toast"),D.querySelector("#toast2")].find(t=>t && t.classList.contains("show") && /Opslag/.test(t.textContent));
      ok("3C: opslag vol → toast 'Opslag op dit toestel is vol' met actie Exporteer, staat alsnog weggeschreven", threw===1 && !!qToast && !!qToast.querySelector(".toast-action") && qToast.querySelector(".toast-action").textContent==="Exporteer" && stored(W).catalog["quotakaas"]);
      W.Storage.prototype.setItem=origSet;
      // nudge op de lijst (account weg, wel een gedeelde lijst)
      C.authEmail=null; C.isAnon=true; C.lists=[{id:"c1",name:"Gedeeld",owner_user_id:"u2",member_count:2}];
      D.querySelector("#gear-btn").click(); await wait(60);
      const nudge=D.querySelector("#account-nudge .ritual.account");
      ok("3C: nudge 'Bewaar je account' op de lijst zodra je deelt", !!nudge && /Bewaar je account/.test(nudge.textContent));
      nudge.querySelector(".r-x").click(); await wait(30);
      ok("3C: nudge weggetikt → onthouden, niet meer tonen", stored(W).settings.accountNudgeDismissed===true && !D.querySelector("#account-nudge .ritual.account"));
      // wis dit toestel: alle mandje.*-sleutels weg, niets meer teruggeschreven
      W.localStorage.setItem("mandje.me", JSON.stringify({display_name:"Ik"}));
      W.wipeDevice(); await wait(120);
      ok("3C: wipeDevice verwijdert alle mandje.*-sleutels (incl. sessie) en blokkeert verdere saves", !W.localStorage.getItem("mandje.v2") && !W.localStorage.getItem("mandje.me") && sb.auth.calls.some(c=>c[0]==="signOut"));
      dA.window.close();
    }

    // 15. Fase 4 — "Wat is op": parser, vlag lokaal en in de cloud, vooraan in het schap, item-blad, live toast, presence 'in de winkel'
    {
      const seedO={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},list:[item("a1","appels","groente-fruit"),item("m1","melk","zuivel-eieren"),item("y1","yoghurt","zuivel-eieren")],catalog:{},coBuy:{},meals:{},history:[],
        localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit"),item("m1","melk","zuivel-eieren"),item("y1","yoghurt","zuivel-eieren")]}],activeLocalId:"l_boodschappen"};
      const dO=mk(seedO); await wait(160); const W=dO.window, D=W.document, C=W.Cloud;
      ok("F4: parser: 'op: melk', 'melk is op', 'eieren zijn op!' → naam; 'melk' → niets", W.parseOpCommand("op: melk").name==="melk" && W.parseOpCommand("Melk is op").name==="Melk" && W.parseOpCommand("eieren zijn op!").name==="eieren" && W.parseOpCommand("melk")===null && W.parseOpCommand("pindakaas op brood")===null);
      const type=(t)=>{ const i=D.querySelector("#add-name"); i.value=t; i.dispatchEvent(new W.Event("input",{bubbles:true})); };
      type("yoghurt is op"); await wait(80);
      const acRow=D.querySelector("#ac-list .ac-item.op");
      ok("F4: autocomplete toont één rode rij 'yoghurt is op — meld het'", D.querySelector("#ac-list").classList.contains("show") && !!acRow && /yoghurt is op/.test(acRow.textContent));
      D.querySelector("#add-name").dispatchEvent(new W.KeyboardEvent("keydown",{key:"Enter",bubbles:true})); await wait(60);
      let st=stored(W);
      const yog=st.list.find(i=>i.id==="y1");
      ok("F4: Enter op 'yoghurt is op' vlagt het bestaande item (geen dubbel, geen aantal), invoerveld leeg", !!yog.flaggedAt && st.list.filter(i=>/yoghurt/i.test(i.name)).length===1 && yog.qty===1 && D.querySelector("#add-name").value==="");
      const zuivel=D.querySelector("#cat-zuivel-eieren");
      ok("F4: gevlagd item staat vooraan in zijn schap, met rode rand en 'OP'-pil", !!zuivel && zuivel.querySelector("li.row").dataset.id==="y1" && zuivel.querySelector("li.row").classList.contains("urgent") && zuivel.querySelector("li.row .pill-op").textContent==="OP" && !D.querySelector('li.row[data-id="m1"]').classList.contains("urgent"));
      type("op: eieren"); D.querySelector("#add-name").dispatchEvent(new W.KeyboardEvent("keydown",{key:"Enter",bubbles:true})); await wait(60);
      st=stored(W);
      const eggs=st.list.find(i=>i.name==="eieren");
      ok("F4: 'op: eieren' voegt het item toe mét vlag en toast", !!eggs && !!eggs.flaggedAt && /eieren is op/.test(D.querySelector("#toast").textContent+D.querySelector("#toast2").textContent));
      // item-blad: chip 'Is op' → 'Gemeld als op' en terug
      D.querySelector('li.row[data-id="m1"] .card').click(); await wait(60);
      const sh=D.querySelector("#sheet"), opBtn=sh.querySelector("#s-op");
      ok("F4: item-blad heeft de knop 'Is op' (uit)", sh.classList.contains("show") && !!opBtn && opBtn.textContent==="Is op" && !opBtn.classList.contains("on"));
      opBtn.click(); sh.querySelector("#s-save").click(); await wait(60);
      st=stored(W);
      ok("F4: 'Is op' + Klaar → melk gevlagd en bovenaan in Zuivel", !!st.list.find(i=>i.id==="m1").flaggedAt && D.querySelector("#cat-zuivel-eieren li.row").classList.contains("urgent"));
      D.querySelector('li.row[data-id="m1"] .card').click(); await wait(60);
      ok("F4: heropenen toont 'Gemeld als op'", sh.querySelector("#s-op").textContent==="Gemeld als op" && sh.querySelector("#s-op").classList.contains("on"));
      sh.querySelector("#s-op").click(); sh.querySelector("#s-save").click(); await wait(60);
      ok("F4: vlag weer uit via het blad", !stored(W).list.find(i=>i.id==="m1").flaggedAt);
      // winkelmodus: OP-pil en vooraan
      W.openShoppingMode(); await wait(60);
      const shopRows=[...D.querySelectorAll('#shop-body .shelf[data-cat="zuivel-eieren"] .shop-row')];
      ok("F4: winkelmodus: gevlagde items vooraan in het schap met OP-pil en rode rand", shopRows.length>=3 && shopRows[0].classList.contains("urgent") && !!shopRows[0].querySelector(".pill-op") && shopRows.findIndex(r=>r.dataset.id==="m1") > shopRows.findIndex(r=>r.dataset.id==="y1") && !shopRows[shopRows.length-1].classList.contains("urgent"));
      W.closeShoppingMode(); await wait(40);
      // cloud: vlag meesturen, mapping, live toast van een huisgenoot, presence 'in de winkel'
      const sb=mkStub2(); C.sb=sb; C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u1"; C.lists=[{id:"c1",name:"Gedeeld",owner_user_id:"u1",member_count:2}];
      C.me={display_name:"Ik", color:"#24593F"};
      await C.open("c1").catch(()=>{}); await wait(80);
      sb.calls.length=0;
      W.flagByName("Cloudmelk"); await wait(60);
      const upd=sb.calls.find(c=>c.table==="items" && c.ops[0][0]==="update");
      ok("F4: cloud: bestaand item vlaggen = update({flagged_at, flagged_by_name})", !!upd && !!upd.ops[0][1].flagged_at && upd.ops[0][1].flagged_by_name==="Ik" && D.querySelector('li.row[data-id="c2"]').classList.contains("urgent"));
      sb.calls.length=0;
      W.addToList("spinazie", null, {flag:true, silent:true}); await wait(60);
      const ins=sb.calls.find(c=>c.table==="items" && c.ops[0][0]==="insert");
      ok("F4: cloud: nieuw item met vlag → insert met flagged_at/flagged_by_name", !!ins && !!ins.ops[0][1].flagged_at && ins.ops[0][1].flagged_by_name==="Ik");
      const spin=stored(W).list.find(i=>i.name==="spinazie") || W.localLists()[0].items.find(i=>i.name==="spinazie");
      const spinRow=[...D.querySelectorAll('#open-list li.row')].find(li=>/spinazie/.test(li.textContent));
      ok("F4: na de insert krijgt het item meteen zijn echte id (geen tmp_ meer), rij blijft staan", !!spinRow && !/^tmp_/.test(spinRow.dataset.id) && /^new_/.test(spinRow.dataset.id));
      sb.calls.length=0; W.toggleDone(spinRow.dataset.id); await wait(60);
      ok("F4: afvinken vlak na toevoegen gaat als update op het echte id naar de cloud", sb.calls.some(c=>c.table==="items" && c.ops[0][0]==="update" && c.ops.some(x=>x[0]==="eq" && x[2]===spinRow.dataset.id)));
      // huisgenoot vlagt iets: volgende refresh → toast "Sanne: Cloudkaas is op"
      sb.items().find(i=>i.id==="c1").flagged_at=new Date().toISOString(); sb.items().find(i=>i.id==="c1").flagged_by_name="Sanne"; sb.items().find(i=>i.id==="c1").done=false;
      await C.refreshItems(C._activeRefreshToken); await wait(60);
      const toastTxt=D.querySelector("#toast").textContent+" | "+D.querySelector("#toast2").textContent;
      ok("F4: live: nieuwe vlag van Sanne → toast 'Sanne: Cloudkaas is op' en rij urgent", /Sanne: Cloudkaas is op/.test(toastTxt) && D.querySelector('li.row[data-id="c1"]').classList.contains("urgent") && /Sanne/.test(D.querySelector('li.row[data-id="c1"] .op-by').textContent));
      // presence: winkelmodus openen stuurt shopping:true mee; een ander in de winkel → balk + toast
      sb.tracked=[]; W.openShoppingMode(); await wait(40);
      ok("F4: winkelmodus open → presence track({shopping:true})", sb.tracked.some(p=>p.shopping===true && p.user_id==="u1"));
      W.closeShoppingMode(); await wait(40);
      ok("F4: winkelmodus dicht → track({shopping:false})", sb.tracked[sb.tracked.length-1].shopping===false);
      sb.presence={ u9:[{user_id:"u9", name:"Florian", color:"#2F5FA8", emoji:"", shopping:true}] };
      sb.chan.fireSync(); await wait(60);
      const bar=D.querySelector("#presence-bar");
      ok("F4: ander lid in de winkel → balk '🛒 Florian is in de winkel' met knop, toast, avatar-markering", bar.classList.contains("shopping") && /Florian is in de winkel/.test(bar.textContent) && !!bar.querySelector(".pb-act") && /in de winkel/.test(D.querySelector("#toast").textContent+D.querySelector("#toast2").textContent));
      sb.presence={ u9:[{user_id:"u9", name:"Florian", color:"#2F5FA8", emoji:"", shopping:false}] };
      sb.chan.fireSync(); await wait(30);
      ok("F4: klaar met winkelen → gewone 'kijkt mee'-balk", !bar.classList.contains("shopping") && /Florian kijkt mee/.test(bar.textContent));
      dO.window.close();
    }

    // 16. Fase 5 — meldingen: schakelaar + voorkeuren per soort, contextuele vraag, start_shopping, app-badge
    {
      const seedP={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1,onboardDismissed:true},list:[item("a1","appels","groente-fruit")],catalog:{},coBuy:{},meals:{},history:[],
        localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit")]}],activeLocalId:"l_boodschappen"};
      const sub={endpoint:"https://push.example/abc", toJSON:()=>({keys:{p256dh:"k",auth:"a"}}), unsubscribe:async()=>true};
      const reg={pushManager:{getSubscription:async()=>sub, subscribe:async()=>sub}};
      const badges=[];
      const dP=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){
        w.localStorage.setItem("mandje.v2", JSON.stringify(seedP));
        w.PushManager=function(){}; w.Notification={permission:"granted", requestPermission:(cb)=>{ if(cb) cb("granted"); return Promise.resolve("granted"); }};
        Object.defineProperty(w.navigator,"serviceWorker",{value:{ready:Promise.resolve(reg), register:()=>Promise.resolve(reg), addEventListener(){} , controller:null}});
        Object.defineProperty(w.navigator,"setAppBadge",{value:(n)=>{ badges.push(n); return Promise.resolve(); }});
        Object.defineProperty(w.navigator,"clearAppBadge",{value:()=>{ badges.push(0); return Promise.resolve(); }});
      }});
      await wait(200); const W=dP.window, D=W.document, C=W.Cloud;
      const sb=mkStub2(); C.sb=sb; C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u1"; C.lists=[{id:"c1",name:"Gedeeld",owner_user_id:"u1",member_count:2}];
      ok("F5: pushEnabled met VAPID-key + gestubde PushManager/Notification/serviceWorker", C.pushEnabled()===true);
      // contextuele vraag op de gedeelde lijst
      await C.open("c1").catch(()=>{}); await wait(80);
      const nudge=D.querySelector("#push-nudge .ritual.push");
      ok("F5: op een gedeelde lijst met huisgenoten verschijnt 'Seintje als iets op is?'", !!nudge && /Seintje/.test(nudge.textContent));
      sb.calls.length=0; nudge.querySelector("#pn-go").click(); await wait(120);
      const up=sb.calls.find(c=>c.table==="push_subscriptions" && c.ops[0][0]==="upsert");
      ok("F5: 'Zet aan' → abonnement met prefs {op:true, shopping:true} naar push_subscriptions, pushOn=true, kaart weg", !!up && up.ops[0][1].endpoint===sub.endpoint && up.ops[0][1].prefs && up.ops[0][1].prefs.op===true && stored(W).settings.pushOn===true && !D.querySelector("#push-nudge .ritual.push"));
      // Meer → Meldingen met sub-schakelaars
      D.querySelector("#gear-btn").click(); await wait(60);
      const sw=(label)=>D.querySelector('#meer-content .switch[aria-label="'+label+'"]');
      ok("F5: Meer → Meldingen aan, met 'Iets is op' en 'Iemand gaat winkelen'", !!sw("Meldingen") && sw("Meldingen").classList.contains("on") && !!sw("Iets is op") && !!sw("Iemand gaat winkelen") && sw("Iets is op").classList.contains("on"));
      sb.calls.length=0; sw("Iemand gaat winkelen").click(); await wait(80);
      const updP=sb.calls.find(c=>c.table==="push_subscriptions" && c.ops[0][0]==="update");
      ok("F5: voorkeur uit → settings.push.shopping=false en update prefs op het abonnement", stored(W).settings.push.shopping===false && !!updP && updP.ops[0][1].prefs.shopping===false && updP.ops.some(x=>x[0]==="eq"&&x[2]===sub.endpoint));
      ok("F5: voorkeuren gaan mee in de sync (SYNC_SETTINGS bevat push)", W.buildUserStatePayload().settings.push && W.buildUserStatePayload().settings.push.shopping===false);
      sw("Meldingen").click(); await wait(60);
      ok("F5: hoofdschakelaar uit → pushOn=false, sub-schakelaars weg", stored(W).settings.pushOn===false && !sw("Iets is op"));
      // start_shopping bij winkelmodus (gedeelde lijst met ≥2 leden)
      D.querySelector("#gear-btn").click(); await wait(40);
      sb.calls.length=0; W.openShoppingMode(); await wait(60);
      ok("F5: winkelmodus openen → rpc start_shopping(p_list_id)", sb.calls.some(c=>c.table==="rpc:start_shopping" && c.args.p_list_id==="c1"));
      W.closeShoppingMode(); sb.calls.length=0; W.openShoppingMode(); await wait(40); W.closeShoppingMode();
      ok("F5: niet nog eens binnen 2 uur (client-throttle)", !sb.calls.some(c=>c.table==="rpc:start_shopping"));
      // app-badge = open items
      badges.length=0; W.addToList("peren", null, {silent:true}); await wait(40);
      ok("F5: app-badge volgt het aantal open items van de geopende (gedeelde) lijst", badges.length>0 && badges[badges.length-1]===D.querySelectorAll("#open-list li.row").length && badges[badges.length-1]>=2);
      dP.window.close();
    }
    // 17. Pakket A — account & auth: uitlog-scope, ander account wist de vorige gegevens,
    //     init zonder gebruiker, runtime SIGNED_OUT, mislukte signOut, listener na reconnect, teksten
    {
      const seedQ={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},
        list:[item("a1","appels","groente-fruit")],
        catalog:{"appels":{name:"appels",category:"groente-fruit",defaultPrice:null,purchaseDates:[],timesAdded:4,lastAddedAt:null,cadenceMode:"auto",manualIntervalDays:null}},
        coBuy:{},meals:{},history:[{id:"h1",at:new Date().toISOString(),count:1,total:null,paid:null,list:"local",items:[]}],
        localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit")]},
                    {id:"l_prive",name:"Privé",type:"plain",preset:"todo",glyph:"🧺",finish:"opruimen",items:[item("p1","geheim","overig")]}],
        activeLocalId:"l_boodschappen"};
      const dQ=mk(seedQ); await wait(160); const W=dQ.window, D=W.document, C=W.Cloud;
      const toasts=()=>D.querySelector("#toast").textContent+" | "+D.querySelector("#toast2").textContent;
      const sb=mkStub2({knownEmails:["sanne@voorbeeld.nl"]});
      C.sb=sb; C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u1"; C.lists=[{id:"c1",name:"Gedeeld",owner_user_id:"u1",member_count:2}];
      C._setAuthUser(sb.auth.user());
      C.init=async function(){ this.enabled=true; this.ready=true; this.mode="cloud"; const u=await this.sb.auth.getUser(); this.userId=(u.data&&u.data.user)?u.data.user.id:null; this._setAuthUser(u.data&&u.data.user); this._initCalls=(this._initCalls||0)+1; };

      // A9 — enkelvoud: "de gedeelde lijst ... hoort" (was "de 1 gedeelde lijst ... horen")
      W.openAccountSheet("login"); await wait(60);
      const shQ=D.querySelector("#sheet");
      ok("A9: inlog-blad gebruikt enkelvoud bij één gedeelde lijst", /de gedeelde lijst van dit toestel hoort/.test(shQ.querySelector("#acc-intro").textContent) && !/de 1 gedeelde lijst/.test(shQ.querySelector("#acc-intro").textContent));
      // A7 — inloggen: de code moet hier ingevuld worden, de link opent de browser
      shQ.querySelector("#acc-email").value="sanne@voorbeeld.nl"; shQ.querySelector("#acc-go").click(); await wait(80);
      ok("A7: inlogstroom legt uit dat de code hier ingevuld moet worden (link opent de browser)", /link in de mail opent je browser/.test(shQ.querySelector("#acc-sent").textContent) && !/Die werkt ook/.test(shQ.querySelector("#acc-sent").textContent));
      shQ.querySelector("#acc-cancel").click(); await wait(40);
      W.openAccountSheet("link"); await wait(60);
      shQ.querySelector("#acc-email").value="florian@voorbeeld.nl"; shQ.querySelector("#acc-go").click(); await wait(80);
      ok("A7: bij koppelen blijft de tekst 'de link werkt ook'", /Die werkt ook/.test(shQ.querySelector("#acc-sent").textContent));
      shQ.querySelector("#acc-cancel").click(); await wait(40);
      // A8 — "already registered" wordt Nederlands en wijst naar 'Ik heb al een account'
      const sbTaken=mkStub2({updateFails:"A user with this email address has already been registered"});
      C.sb=sbTaken;
      const rTaken=await C.linkEmail("sanne@voorbeeld.nl");
      ok("A8: linkEmail vertaalt 'already registered' naar reason 'exists'", rTaken.ok===false && rTaken.reason==="exists");
      W.openAccountSheet("link"); await wait(60);
      shQ.querySelector("#acc-email").value="sanne@voorbeeld.nl"; shQ.querySelector("#acc-go").click(); await wait(80);
      ok("A8: het blad toont Nederlandse uitleg i.p.v. de Engelse foutmelding", /hoort al bij een account/.test(shQ.querySelector("#acc-warn").textContent) && !/registered/.test(shQ.querySelector("#acc-warn").textContent));
      shQ.querySelector("#acc-cancel").click(); await wait(40);
      C.sb=sb;

      // A2 — eigenaar van de gesynchroniseerde gegevens vastleggen
      await C.pullUserState(); await wait(40);
      ok("A2: pullUserState legt vast bij welk account de lokale sync-gegevens horen", stored(W).sync.ownerId==="u1");

      // A5 — mislukte signOut mag je niet 'uitgelogd' achterlaten
      C._setAuthUser({id:"u1", email:"florian@voorbeeld.nl"});
      const sbFail=mkStub2({signOutFails:"Failed to fetch"});
      C.sb=sbFail;
      const outFail=await C.signOut(); await wait(40);
      ok("A5: mislukte signOut geeft false terug en houdt het account ingelogd", outFail===false && C.hasAccount()===true && C.authEmail==="florian@voorbeeld.nl");
      ok("A5: mislukte signOut meldt dat in het Nederlands", /Uitloggen lukte niet/.test(toasts()));

      // A1 — uitloggen alleen op dit toestel
      C.sb=sb; sb.auth.calls.length=0;
      const outOk=await C.signOut(); await wait(120);
      const soCall=sb.auth.calls.filter(c=>c[0]==="signOut").pop();
      ok("A1: signOut logt alleen dít toestel uit (scope 'local')", outOk===true && !!soCall && !!soCall[1] && soCall[1].scope==="local" && C.hasAccount()===false);

      // A2 — inloggen als een ánder account wist eerst de gegevens van het vorige account
      C.userId="u1"; C._setAuthUser({id:"u1", email:"florian@voorbeeld.nl"});
      await C.sendLoginCode("sanne@voorbeeld.nl"); await wait(20);
      const rIn=await C.verifyCode("12345678"); await wait(120);
      let stQ=stored(W);
      ok("A2: ander user_id → catalogus, geschiedenis en privélijst van het vorige account gewist", rIn.ok===true && C.userId==="u2" && Object.keys(stQ.catalog).length===0 && stQ.history.length===0 && stQ.localLists.length===1 && stQ.localLists[0].id==="l_boodschappen" && stQ.localLists[0].items.length===0);
      ok("A2: nieuwe eigenaar vastgelegd en in het Nederlands uitgelegd", stQ.sync.ownerId==="u2" && /gegevens van je account/.test(toasts()));
      W.addToList("kaas", null, {silent:true}); await wait(40);
      ok("A2: hetzelfde user_id wist niets (koppelen blijft samenvoegen)", C._resetSyncedDataForNewOwner("u2")===false && !!stored(W).catalog["kaas"]);

      // A4 — runtime SIGNED_OUT (auto-refresh mislukt) → verse sessie i.p.v. 'ready' zonder auth
      C.ready=true; C._initInProgress=false; C._signingOutAt=0;
      const initsB=C._initCalls||0;
      C._onAuthEvent("SIGNED_OUT", null); await wait(80);
      ok("A4: SIGNED_OUT tijdens de sessie start opnieuw op (reinit)", (C._initCalls||0)===initsB+1);

      // A6 — offline gaan zegt de auth-listener op zodat een nieuwe client er weer een kan binden
      C.sb=sb; C.ready=true; C._authBound=false; C._authSub=null; C._bindAuth();
      ok("A6: _bindAuth bewaart de opzegbare subscription", C._authBound===true && !!C._authSub);
      C._setOfflineMode("test"); await wait(40);
      ok("A6: _setOfflineMode zegt de listener op en zet _authBound terug", C._authBound===false && C._authSub===null && C._accessToken===null);
      dQ.window.close();

      // A3 — init zonder gebruiker: eerst opnieuw anoniem aanmelden, anders eerlijk lokaal verder
      {
        const sbI=mkStub2({noUser:true});
        const dI=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){
          w.localStorage.setItem("mandje.v2", JSON.stringify(seedQ));
          w.fetch=()=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({}),text:()=>Promise.resolve("")});
          w.supabase={ createClient:()=>sbI };
        }});
        await wait(260); const WI=dI.window, CI=WI.Cloud;
        CI.sb=null; CI.ready=false; CI._initInProgress=false; CI._authBound=false; CI._authSub=null;
        sbI.auth.calls.length=0;
        await CI.init(); await wait(120);
        ok("A3: geen gebruiker na getUser → één nieuwe anonieme aanmelding", sbI.auth.calls.filter(c=>c[0]==="signInAnonymously").length===1);
        ok("A3: blijft dat leeg, dan lokale modus met uitleg i.p.v. 'ready' zonder auth", CI.ready===false && CI.mode==="local" && /Niet ingelogd/.test(CI.initError||""));
        dI.window.close();
      }
    }
    // 17. Pakket B — sync-correctheid: prototype-sleutels, redding bij samenvoegen, stempels, quota, keepalive, bundels, instellingen
    {
      const iso=(ms)=>new Date(ms).toISOString();
      const sig=(o)=>{ const c={}; Object.keys(o).filter(k=>k!=="u").sort().forEach(k=>{ c[k]=o[k]; }); return JSON.stringify(c); };
      const T=Date.now();
      const L=(id,name,at)=>({id:id,name:name,category:"overig",qty:1,unit:"",done:false,note:"",price:null,assigned_to:null,added_by_name:"",addedAt:at});
      const seedB={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:3},
        list:[L("x1","x-oud",iso(T-7200000))],catalog:{},coBuy:{},meals:{},history:[],
        sync:{settingsAt:{}, tomb:{}, listSeen:{l_boodschappen:iso(T-120000)}},
        localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"x",finish:"opruimen",
          items:[L("x1","x-oud",iso(T-7200000))],createdAt:iso(T-7200000),updatedAt:iso(T-60000)}],activeLocalId:"l_boodschappen"};
      const dB=mk(seedB); await wait(160); const W=dB.window, D=dB.window.document;

      // B1 — een item dat letterlijk "__proto__" heet vervuilt Object.prototype niet
      const polluted=W.mergePurchaseDate("__proto__","overig",new Date().toISOString());
      W.mergePurchaseDate("constructor","overig",new Date().toISOString());
      W.addToList("__proto__", null, {silent:true}); await wait(30);
      W.saveNow(); let st=stored(W);
      ok("B1: '__proto__' uit de huishoud-geschiedenis vervuilt Object.prototype niet",
        polluted===false && W.eval("({}).purchaseDates")===undefined && W.eval("({}).timesAdded")===undefined
        && !Object.prototype.hasOwnProperty.call(st.catalog,"__proto__") && !Object.prototype.hasOwnProperty.call(st.catalog,"constructor"));
      ok("B1: het item staat gewoon op de lijst, alleen zonder cataloguspost", st.list.some(i=>i.name==="__proto__"));

      // B2/B3 — remote item van vlak vóór de laatste lokale bewerking overleeft de fusie
      const rowB={ user_id:"u1", device:"iPad", updated_at:iso(T-30000), catalog:{}, co_buy:{}, meals:{}, history:[],
        settings:{ _sync:{ settingsAt:{}, tomb:{catalog:{"nooit-gezien":T-1000}, lists:{}, meals:{}, history:{}} } },
        local_lists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"x",finish:"opruimen",
          items:[L("x1","x-oud",iso(T-7200000)), L("x2","melk",iso(T-90000)), L("x3","weggegooid",iso(T-7200000))],
          createdAt:iso(T-7200000), updatedAt:iso(T-90000)}] };
      const resB=W.mergeUserState(rowB); await wait(30); W.saveNow(); st=stored(W);
      const namesB=st.list.map(i=>i.name);
      ok("B2: item dat het andere toestel ná het ijkpunt toevoegde overleeft de fusie", namesB.indexOf("melk")!==-1);
      ok("B2: wat de winnaar vóór het ijkpunt wegdeed blijft weg", namesB.indexOf("weggegooid")===-1);
      ok("B3: de fusie kreeg er items bij → verse stempel die beide kanten overtreft",
        new Date(st.localLists[0].updatedAt).getTime() > T-60000);
      ok("B10: grafsteen uit de cloud voor een sleutel die nergens leeft wordt overgenomen", st.sync.tomb.catalog["nooit-gezien"]===T-1000);
      ok("B11: eigen, van de standaard afwijkende instelling wordt niet door de cloud-standaard overschreven", st.settings.dueWindowDays===3 && !!resB);

      // B11 — winkels van twee toestellen worden verenigd i.p.v. vervangen
      W.__state().settings.stores=[{id:"st_a",name:"Albert",order:[]}]; W.saveNow(); await wait(20);
      W.mergeUserState({ user_id:"u1", updated_at:iso(T), catalog:{}, co_buy:{}, meals:{}, history:[], local_lists:[],
        settings:{ stores:[{id:"st_b",name:"Jumbo",order:[]}], _sync:{settingsAt:{}, tomb:{}} } });
      await wait(20); W.saveNow(); st=stored(W);
      ok("B11: winkels van beide toestellen blijven bestaan (vereniging op id)",
        st.settings.stores.length===2 && st.settings.stores.map(s=>s.id).sort().join()==="st_a,st_b");

      // B4 — twee ongestempelde posten leveren aan beide kanten hetzelfde op
      const A4={name:"kaas",category:"kaas-vleeswaren",defaultPrice:2.5,purchaseDates:["2026-01-01"],timesAdded:2,lastAddedAt:null,cadenceMode:"auto",manualIntervalDays:null};
      const B4={name:"kaas",category:"zuivel-eieren",defaultPrice:null,purchaseDates:["2026-01-02","2026-01-03"],timesAdded:1,lastAddedAt:null,cadenceMode:"manual",manualIntervalDays:7};
      const m1=W._mergeCatalogEntry(A4,B4), m2=W._mergeCatalogEntry(B4,A4);
      ok("B4: ongestempelde posten convergeren aan beide kanten naar dezelfde waarde, met een verse stempel",
        sig(m1)===sig(m2) && typeof m1.u==="number" && typeof m2.u==="number" && m1.purchaseDates.length===3);

      // B5 — alleen iets toevoegen stempelt de voorkeuren niet opnieuw
      W.addToList("kaas", null, {silent:true}); await wait(30); W.saveNow();
      const uKaas=stored(W).catalog["kaas"].u;
      await wait(30);
      W.addToList("kaas", null, {silent:true}); await wait(30); W.saveNow();
      ok("B5: nog eens toevoegen verhoogt de teller maar herstempelt de post niet",
        stored(W).catalog["kaas"].u===uKaas && stored(W).catalog["kaas"].timesAdded>=2);
      // via het echte pad: item-blad openen, ritme op 'wekelijks' zetten en opslaan (saveSheet meldt de wijziging)
      const kaasRow=[...D.querySelectorAll("#open-list li.row")].find(li=>/kaas/i.test(li.textContent));
      kaasRow.querySelector(".card").click(); await wait(60);
      D.querySelector('#sheet #s-cad .cadchip[data-v="m7"]').click();
      D.querySelector("#sheet #s-save").click(); await wait(60); W.saveNow(); await wait(20);
      ok("B5: een echte voorkeurwijziging (ritme) stempelt wél",
        stored(W).catalog["kaas"].cadenceMode==="manual" && stored(W).catalog["kaas"].u>uKaas);

      // B6 — noodgedwongen inkorten bij een volle opslag maakt geen grafstenen
      const hist=[]; for(let i=0;i<60;i++) hist.push({id:"h"+i, at:iso(T-i*3600000), count:1, total:null, paid:null, list:"local", items:[]});
      W.__state().history=hist; W.saveNow(); await wait(20);
      const origSet=W.Storage.prototype.setItem; let threw=0;
      W.Storage.prototype.setItem=function(k,v){ if(k==="mandje.v2" && threw<2){ threw++; const e=new Error("quota"); e.name="QuotaExceededError"; throw e; } return origSet.call(this,k,v); };
      W.addToList("quotaperen", null, {silent:true}); await wait(40);
      W.Storage.prototype.setItem=origSet;
      W.addToList("naquota", null, {silent:true}); await wait(40); W.saveNow(); st=stored(W);
      ok("B6: quota-noodrem kort de geschiedenis in zonder grafstenen te maken",
        threw===2 && st.history.length===50 && Object.keys(st.sync.tomb.history||{}).length===0);

      // B12 — na een sync die naar een andere lijstsoort schakelt klopt de chrome weer
      const plainB=W.createLocalList({name:"Paklijst B", preset:"pack"}); W.switchLocalList(plainB.id); await wait(60);
      D.body.classList.remove("list-plain");
      W.rerenderAfterSync(); await wait(20);
      ok("B12: rerenderAfterSync zet het lijsttype terug (plain blijft plain)", D.body.classList.contains("list-plain"));
      W.switchLocalList("l_boodschappen"); await wait(40);

      // B8 — keepalive bij het sluiten schrijft voorwaardelijk (PATCH + updated_at=lte)
      const C=W.Cloud; const fetches=[];
      W.fetch=function(url, opts){ fetches.push([url, opts]); return Promise.resolve({ok:true}); };
      C.sb=mkStub2(); C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u1"; C._usHasTable=undefined;
      C._accessToken="tok"; C._usRemoteAt=iso(T-1000); C._usNoRow=false;
      C.scheduleUserStatePush(60000);
      W.onAppHide ? W.onAppHide() : C.flushUserStateNow();
      C.flushUserStateNow(); await wait(30);
      const pat=fetches.find(f=>f[1] && f[1].method==="PATCH");
      ok("B8: flushUserStateNow schrijft voorwaardelijk (PATCH met updated_at=lte), niet blind upserten",
        !!pat && /user_id=eq\./.test(pat[0]) && pat[0].indexOf("updated_at=lte."+encodeURIComponent(iso(T-1000)))!==-1
        && !fetches.some(f=>f[1] && f[1].method==="POST"));
      // zonder kennis van de cloud-rij: helemaal geen keepalive-schrijfactie
      fetches.length=0; C._usRemoteAt=null; C._usNoRow=false; C.scheduleUserStatePush(60000);
      C.flushUserStateNow(); await wait(30);
      ok("B7: zonder bekende cloud-rij geen blinde upsert vanuit de keepalive", fetches.length===0);

      // B9 — een hier verwijderde bundel komt niet terug uit de meals-tabel
      W.__state().meals={ meal_y:{id:"meal_y", name:"Lokaal", emoji:"x", items:[], updatedAt:iso(T-1000)} };
      W.__state().sync.tomb.meals={ meal_x:T };
      W.saveNow(); await wait(20);
      C.sb=mkStub2({meals:[{id:"meal_x",name:"Verwijderd",emoji:"x",items:[],updated_at:iso(T-60000)},
                           {id:"meal_y",name:"Oud",emoji:"x",items:[],updated_at:iso(T-60000)}]});
      await C.loadMeals(); await wait(40); W.saveNow(); st=stored(W);
      ok("B9: loadMeals laat een verwijderde bundel niet herrijzen en overschrijft geen nieuwere lokale versie",
        !st.meals.meal_x && !!st.meals.meal_y && st.meals.meal_y.name==="Lokaal");
      dB.window.close();
    }
    // 17. Pakket C — gedeelde items: wachtrij bij afronden, tmp→echt id, bewerkingen tijdens de insert, vlag-/winkel-toasts
    {
      const seedX={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1,onboardDismissed:true},list:[item("a1","appels","groente-fruit")],catalog:{},coBuy:{},meals:{},history:[],
        localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit")]}],activeLocalId:"l_boodschappen"};
      const dX=mk(seedX); await wait(160); const W=dX.window, D=W.document, C=W.Cloud;
      const clearToasts=()=>{ ["#toast","#toast2"].forEach(s=>{ const t=D.querySelector(s); if(t) t.textContent=""; }); };
      const toastTxt=()=>D.querySelector("#toast").textContent+" | "+D.querySelector("#toast2").textContent;
      const sb=mkStub2(); C.sb=sb; C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u1"; C.me={display_name:"Ik",color:"#24593F"};
      C.lists=[{id:"c1",name:"Gedeeld",owner_user_id:"u1",member_count:2}];
      await C.open("c1").catch(()=>{}); await wait(80);
      C.toggle("c1",{quiet:true}); await wait(40);            // de vooraf afgevinkte cloudrij uitvinken

      // C1 — offline toevoegen, afvinken, afronden: de wachtende insert mag niet blijven staan
      C.sb=null; C._pending.length=0;
      C.addItem("brood", null, 1, {silent:true}); await wait(40);
      const rowB=[...D.querySelectorAll("#open-list li.row")].find(li=>/brood/.test(li.textContent));
      const tmpB=rowB && rowB.dataset.id;
      ok("C1: offline toevoegen zet een insert met tmp_-id in de wachtrij", /^tmp_/.test(tmpB||"") && C._pending.length===1 && C._pending[0].op==="insert");
      C.toggle(tmpB,{quiet:true}); await wait(40);
      ok("C1: afvinken vouwt in de wachtende insert (done:true)", C._pending.length===1 && C._pending[0].payload.done===true);
      C.finish(); await wait(80);
      D.querySelector("#scrim").click(); await wait(40);
      ok("C1: afronden trekt de wachtende insert in", C._pending.length===0);
      C.sb=sb; sb.calls.length=0;
      C.flushPending(); await wait(60);
      ok("C1: flushPending maakt het afgeronde item niet alsnog aan", !sb.calls.some(c=>c.table==="items" && c.ops[0][0]==="insert") && !sb.items().some(i=>i.name==="brood"));

      // C2 — acties met het oude tmp-id komen op het echte id uit
      sb.calls.length=0;
      C.addItem("koekjes", null, 1, {silent:true}); await wait(60);
      const realK=(sb.items().find(i=>i.name==="koekjes")||{}).id;
      const tmpK=Object.keys(C._idMap).find(k=>C._idMap[k]===realK);
      ok("C2: na de insert onthoudt _idMap tmp→echt id", !!realK && !!tmpK && /^tmp_/.test(tmpK));
      sb.calls.length=0;
      C.setFields(tmpK, {note:"met chocola"}); await wait(60);
      ok("C2: setFields met het oude tmp-id landt op het echte id", sb.calls.some(c=>c.table==="items" && c.ops[0][0]==="update" && c.ops.some(x=>x[0]==="eq" && x[2]===realK)) && (sb.items().find(i=>i.id===realK)||{}).note==="met chocola");
      sb.calls.length=0;
      C.remove(tmpK); await wait(60);
      ok("C2: verwijderen met het oude tmp-id verwijdert de echte rij", !sb.items().some(i=>i.id===realK) && sb.calls.some(c=>c.table==="items" && c.ops[0][0]==="delete"));

      // C3 — bewerkingen tijdens een lopende insert komen alsnog op het echte id
      const sbS=mkStub2({slowInsert:true}); C.sb=sbS; C._pending.length=0;
      C.addItem("yoghurt", null, 1, {silent:true}); await wait(40);
      const rowY=[...D.querySelectorAll("#open-list li.row")].find(li=>/yoghurt/.test(li.textContent));
      const tmpY=rowY && rowY.dataset.id;
      ok("C3: insert onderweg → tmp_-id in de lijst, niets in de wachtrij", /^tmp_/.test(tmpY||"") && C._pending.length===0 && !!C._inflight[tmpY]);
      rowY.querySelector(".card .meta").click(); await wait(60);       // item-blad open op het tmp-id
      C.qty(tmpY, 1); await wait(30);
      W.flagItemOp(tmpY, true, {silent:true}); await wait(30);
      ok("C3: tijdens de insert wordt niets naar een tmp_-id geschreven; de velden wachten", !sbS.calls.some(c=>c.table==="items" && c.ops[0][0]==="update" && c.ops.some(x=>x[0]==="eq" && String(x[2]).indexOf("tmp_")===0)) && !!C._pendingAfterInsert[tmpY] && C._pendingAfterInsert[tmpY].qty===2);
      sbS.resolveInsert(); await wait(140);
      const realY=(sbS.items().find(i=>i.name==="yoghurt")||{}).id;
      const rowDb=sbS.items().find(i=>i.id===realY)||{};
      ok("C3: na de insert gaan aantal en vlag alsnog naar het echte id", !!realY && rowDb.qty===2 && !!rowDb.flagged_at && !C._pendingAfterInsert[tmpY]);
      ok("C2: het open item-blad verhuist mee naar het echte id", !!W.__sheetCtx() && W.__sheetCtx().id===realY);
      D.querySelector("#scrim").click(); await wait(40);

      // C4 — een bij het laden al gevlagde én afgevinkte rij mag na het uitvinken niet alsnog toasten
      const sb4=mkStub2(); C.sb=sb4; C._pending.length=0;
      const it4=sb4.items().find(i=>i.id==="c1");
      it4.flagged_at=new Date().toISOString(); it4.flagged_by_name="Sanne"; it4.done=true;
      C._seenFlags={}; C._flagsPrimedFor=null;                 // koude start met de vlag er al
      await C.open("c1").catch(()=>{}); await wait(120);
      clearToasts();
      it4.done=false;                                          // huisgenoot vinkt 'm weer uit
      await C.refreshItems(C._activeRefreshToken); await wait(80);
      ok("C4: al bekende vlag op een afgevinkte rij toast niet na het uitvinken", !/is op/.test(toastTxt()) && C._seenFlags["c1|"+it4.flagged_at]===1);

      // C5 — winkel-toast niet herhalen als de presence even wegvalt (telefoon op slot)
      C._shoppingSeen={}; clearToasts();
      const walker={user_id:"u9", name:"Florian", color:"#2F5FA8", emoji:"", shopping:true};
      sb4.presence={u9:[walker]}; sb4.chan.fireSync(); await wait(60);
      const eerste=toastTxt(); clearToasts();
      sb4.presence={}; sb4.chan.fireSync(); await wait(40);            // presence valt weg
      sb4.presence={u9:[walker]}; sb4.chan.fireSync(); await wait(60); // en komt terug
      ok("C5: winkelen-toast komt één keer; terugkerende presence herhaalt 'm niet", /in de winkel/.test(eerste) && !/in de winkel/.test(toastTxt()) && !!C._shoppingSeen.u9);

      // C6 — het OP-label verjaart mee: de rij-cache mag "net" niet bevriezen
      const vers6={id:"x6",name:"melk",qty:1,unit:"",note:"",price:null,done:false,category:"zuivel-eieren",assigned_to:null,added_by_name:"",flaggedAt:new Date().toISOString(),flaggedBy:"Sanne"};
      const oud6=Object.assign({}, vers6, {flaggedAt:new Date(Date.now()-3*3600000).toISOString()});
      const min70=Object.assign({}, vers6, {flaggedAt:new Date(Date.now()-70*60000).toISOString()});
      const min130=Object.assign({}, vers6, {flaggedAt:new Date(Date.now()-130*60000).toISOString()});
      ok("C6: de tijd-emmer verandert mee met het OP-label", W.opTimeBucket(vers6)!==W.opTimeBucket(oud6) && W.opTimeBucket(min70)!==W.opTimeBucket(min130) && W.opTimeBucket({flaggedAt:null})==="");
      ok("C6: rowSig bevat de tijd-emmer, dus de rij-cache verloopt met het label", W.rowSig(oud6).split(String.fromCharCode(1)).indexOf(W.opTimeBucket(oud6))!==-1);
      dX.window.close();
    }
    // 17. Package D — meldingen: abonnement volgt de gebruiker, opzeggen vóór een identiteitswissel, prefs uit de sync
    {
      const seedD={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1,onboardDismissed:true,pushOn:true},list:[item("a1","appels","groente-fruit")],catalog:{},coBuy:{},meals:{},history:[],
        localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit")]}],activeLocalId:"l_boodschappen"};
      let unsubbed=false;
      const sub={endpoint:"https://push.example/dev-1", toJSON:()=>({keys:{p256dh:"k",auth:"a"}}), unsubscribe:async()=>{ unsubbed=true; return true; }};
      const reg={pushManager:{getSubscription:async()=>sub, subscribe:async()=>sub}};
      const swMsg=[];
      const dD=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){
        w.localStorage.setItem("mandje.v2", JSON.stringify(seedD));
        w.PushManager=function(){}; w.Notification={permission:"granted", requestPermission:(cb)=>{ if(cb) cb("granted"); return Promise.resolve("granted"); }};
        Object.defineProperty(w.navigator,"serviceWorker",{value:{ready:Promise.resolve(reg), register:()=>Promise.resolve(reg), addEventListener(t,fn){ if(t==="message") swMsg.push(fn); }, controller:null}});
      }});
      await wait(200); const W=dD.window, D=W.document, C=W.Cloud;
      const sb=mkStub2(); C.sb=sb; C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u9"; C.lists=[{id:"c1",name:"Gedeeld",owner_user_id:"u9",member_count:2}];

      // D1a: het browser-abonnement bestaat al → de rij toch opnieuw op naam van de HUIDIGE gebruiker zetten
      sb.calls.length=0;
      await C.checkPushSubscription(); await wait(60);
      const up=sb.calls.find(c=>c.table==="push_subscriptions" && c.ops[0][0]==="upsert");
      ok("D1a: checkPushSubscription her-upsert de rij voor de huidige gebruiker (onConflict endpoint, met prefs)",
         !!up && up.ops[0][1].user_id==="u9" && up.ops[0][1].endpoint===sub.endpoint && !!up.ops[0][1].prefs && !!up.ops[0][2] && up.ops[0][2].onConflict==="endpoint");

      // D2: voorkeuren die van een ander toestel binnenkomen moeten ook naar push_subscriptions.prefs
      let prefCalls=0; const realPrefs=C.updatePushPrefs;
      C.updatePushPrefs=function(){ prefCalls++; return Promise.resolve(true); };
      const sbUS=mkStub2({userState:{user_id:"u9", updated_at:new Date().toISOString(), catalog:{}, co_buy:{}, meals:{}, history:[], local_lists:[], settings:{push:{op:false,shopping:true}, _sync:{settingsAt:{},tomb:{}}}}});
      C.sb=sbUS; C._usHasTable=undefined; C._usRemoteAt=null; C._usPulling=false;
      await C.pullUserState(); await wait(60);
      ok("D2: samengevoegde voorkeuren uit user_state werken het abonnement op dit toestel bij",
         stored(W).settings.push && stored(W).settings.push.op===false && prefCalls>=1);
      C.updatePushPrefs=realPrefs; C.sb=sb;

      // D1b: uitloggen zegt het abonnement op vóór auth.signOut (daarna mag RLS de rij niet meer aanraken)
      const order=[]; const realUnsub=C.unsubscribePush, realReinit=C.reinit, realAuthOut=sb.auth.signOut;
      C.unsubscribePush=function(){ order.push("unsub"); return Promise.resolve(true); };
      C.reinit=function(){ order.push("reinit"); return Promise.resolve(); };
      sb.auth.signOut=function(){ order.push("auth"); return realAuthOut.apply(sb.auth, arguments); };
      await C.signOut(); await wait(30);
      ok("D1b: signOut zegt push op vóór auth.signOut en pas daarna reinit", order.join()==="unsub,auth,reinit");
      sb.auth.signOut=realAuthOut; C.unsubscribePush=realUnsub; C.reinit=realReinit;

      // D1b: unsubscribePush wist de rij op endpoint zolang we nog ingelogd zijn
      C.ready=true; C.sb=sb; sb.calls.length=0; unsubbed=false;
      await C.unsubscribePush(); await wait(30);
      const del=sb.calls.find(c=>c.table==="push_subscriptions" && c.ops[0][0]==="delete");
      ok("D1b: unsubscribePush wist de rij op endpoint en zegt het browser-abonnement op",
         !!del && del.ops.some(x=>x[0]==="eq" && x[1]==="endpoint" && x[2]===sub.endpoint) && unsubbed===true && stored(W).settings.pushOn===false);

      // D8: de service worker stuurt de melding door als het venster zichtbaar is → in-app toast
      ok("D8: de pagina luistert naar berichten van de service worker", swMsg.length>=1);
      swMsg.forEach(fn=>fn({data:{type:"PUSH_IN_APP", title:"Gedeeld", body:"Sanne: melk is op"}}));
      await wait(40);
      ok("D8: PUSH_IN_APP toont een in-app toast i.p.v. een OS-melding",
         /Sanne: melk is op/.test(D.querySelector("#toast").textContent + D.querySelector("#toast2").textContent));

      // D1b: toestel wissen doet hetzelfde (het abonnement overleeft een wis en zou anders meelopen)
      const wOrder=[];
      C.unsubscribePush=function(){ wOrder.push("unsub"); return Promise.resolve(true); };
      sb.auth.signOut=function(){ wOrder.push("auth"); return Promise.resolve({error:null}); };
      W.wipeDevice(); await wait(80);
      ok("D1b: wipeDevice zegt push op vóór auth.signOut", wOrder.join()==="unsub,auth");
      dD.window.close();   // vóór de herlaad-timer van wipeDevice (200 ms)
    }
    // 17. Pakket E — prestaties: stempelen alleen waar iets veranderde, lichtere user_state-push, snellere scanlus
    {
      const seedE={version:3,settings:{theme:"light",showPrices:true,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1},
        list:[item("a1","appels","groente-fruit")],
        catalog:{ "melk":{name:"melk",category:"zuivel-eieren",defaultPrice:1.2,purchaseDates:[],timesAdded:3,lastAddedAt:null,cadenceMode:"auto",manualIntervalDays:null},
                  "kaas":{name:"kaas",category:"kaas-vleeswaren",defaultPrice:2.5,purchaseDates:[],timesAdded:2,lastAddedAt:null,cadenceMode:"auto",manualIntervalDays:null} },
        coBuy:{},meals:{},history:[],
        localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit")]}],activeLocalId:"l_boodschappen"};
      const dE=mk(seedE); await wait(160); const W=dE.window, D=W.document, C=W.Cloud;
      // E1: een bestaand catalogusproduct dat wordt aangeraakt, krijgt nog steeds een stempel
      W.addToList("melk", null, {silent:true}); await wait(40);
      let st=stored(W);
      const uMelk=st.catalog["melk"].u;
      ok("E1: toevoegen telt door en stempelt de lijst, maar herstempelt de cataloguspost niet (voorkeuren ongemoeid)",
        uMelk===undefined && st.catalog["melk"].timesAdded===4 && !!st.localLists[0].updatedAt);
      ok("E1: een product dat niet meedeed, blijft ongestempeld", st.catalog["kaas"].u===undefined);
      // wél stempelen zodra een voorkeur verandert — en alleen bij dat ene product
      const melkRow=[...D.querySelectorAll("#open-list li.row")].find(li=>/melk/i.test(li.textContent));
      melkRow.querySelector(".card").click(); await wait(60);
      D.querySelector('#sheet #s-cad .cadchip[data-v="m14"]').click();
      D.querySelector("#sheet #s-save").click(); await wait(60); W.saveNow(); await wait(20);
      st=stored(W);
      ok("E1: een voorkeurwijziging stempelt het aangeraakte product wél", typeof st.catalog["melk"].u==="number" && st.catalog["kaas"].u===undefined);
      const uMelk2=st.catalog["melk"].u;
      // E1: een in-place wijziging via een andere schrijver stempelt ook
      W.snoozeDue("kaas", 7); await wait(40); st=stored(W);
      ok("E1: uitstellen stempelt het uitgestelde product en laat de rest met rust", typeof st.catalog["kaas"].u==="number" && !!st.catalog["kaas"].snoozeUntil && st.catalog["melk"].u===uMelk2);
      // E1: verdwenen sleutels krijgen nog steeds een grafsteen
      W.renameCatalogEntry("melk", "karnemelk"); await wait(40); st=stored(W);
      ok("E1: verwijderde sleutel houdt een grafsteen, de nieuwe sleutel krijgt een stempel", !st.catalog["melk"] && !!st.sync.tomb.catalog["melk"] && typeof st.catalog["karnemelk"].u==="number");
      // E2: de geschiedenis gaat uitgekleed de lucht in, lokaal blijft de rit compleet
      W.recordTrip([{name:"karnemelk",qty:2,unit:"",price:1.5,category:"zuivel-eieren"}]); W.saveNow(); await wait(20);
      const trip=W.buildUserStatePayload().history[0];
      ok("E2: rit in de payload houdt id/at/count/total/paid/list maar draagt geen items-array mee",
        !!trip && !("items" in trip) && !!trip.id && !!trip.at && trip.count===1 && trip.total===3 && trip.paid===null && trip.list==="local");
      ok("E2: lokaal blijft de rit compleet (bron voor 'Herhaal vorige lijst')", (stored(W).history[0].items||[]).length===1);
      const sbE=mkStub2(); C.sb=sbE; C.enabled=true; C.ready=true; C.mode="cloud"; C.userId="u1"; C.lists=[];
      sbE.calls.length=0;
      const okPushE=await C.pushUserState(true); await wait(30);
      const upE=sbE.calls.find(c=>c.table==="user_state" && (c.ops[0][0]==="update" || c.ops[0][0]==="upsert"));
      ok("E2: ook de gepushte rij bevat de geschiedenis zonder items", okPushE===true && !!upE && upE.ops[0][1].history.length===1 && upE.ops[0][1].history.every(h=>!("items" in h)));
      // E3: scanronden — standaard alleen 1D zonder TRY_HARDER
      ok("E3: standaardronde zoekt 1D zonder grondige (trage) pass", W.bcScanPass(1,0,"").hard===false && W.bcScanPass(1,0,"").qr===false && W.bcScanPass(3,9000,"").hard===false);
      ok("E3: QR alleen elk 4e beeld", W.bcScanPass(4,0,"").qr===true && W.bcScanPass(5,0,"").qr===false);
      ok("E3: grondige ronde pas na 3 s zonder treffer, en dan om de 5 beelden", W.bcScanPass(5,1000,"").hard===false && W.bcScanPass(5,4000,"").hard===true && W.bcScanPass(6,4000,"").hard===false && W.bcScanPass(5,4000,"8712345678901").hard===false);
      ok("E3: het kader wordt naar 800 px geschaald, niet meer naar 1600", html.indexOf("800/Math.max(1,r.w)")!==-1 && html.indexOf("1600/Math.max(1,r.w)")===-1);
      dE.window.close();
    }
    // 17. Verificatie-sweep (Fase 3-5): kale omgeving, Meer-tab, account-bladen, kaarten die niet mogen verschijnen
    {
      const jsdomLib=require("jsdom");
      const seedV={version:3,settings:{theme:"light",showPrices:false,seenIntro:true,categoryOrder:null,minPurchases:3,cvThreshold:.6,dueWindowDays:1,onboardDismissed:true},list:[item("a1","appels","groente-fruit"),item("m1","melk","zuivel-eieren")],catalog:{},coBuy:{},meals:{},history:[],
        localLists:[{id:"l_boodschappen",name:"Boodschappen",type:"grocery",preset:"grocery",glyph:"🧺",finish:"opruimen",items:[item("a1","appels","groente-fruit"),item("m1","melk","zuivel-eieren")]}],activeLocalId:"l_boodschappen"};
      // a) kale jsdom: geen Notification, PushManager, setAppBadge of serviceWorker — de app hoort gewoon te starten
      const errs=[]; const vc=new jsdomLib.VirtualConsole();
      vc.on("error",()=>{}); vc.on("warn",()=>{});
      vc.on("jsdomError", e=>{ const m=String((e&&e.message)||e); if(/not a function|not defined|Cannot read|undefined is not/i.test(m)) errs.push(m); });
      const dV=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){ w.localStorage.setItem("mandje.v2", JSON.stringify(seedV)); }});
      await wait(240); const W=dV.window, D=W.document, C=W.Cloud;
      ok("F: kale omgeving zonder Notification/PushManager/setAppBadge/serviceWorker", typeof W.Notification==="undefined" && typeof W.PushManager==="undefined" && typeof W.navigator.setAppBadge!=="function" && !("serviceWorker" in W.navigator));
      ok("F: app start en rendert de lijst zonder scriptfout", errs.length===0 && D.querySelectorAll("#open-list li.row").length===2 && D.querySelector("#title").textContent==="Boodschappen");
      W.syncBadge(); W.addToList("kaas", null, {silent:true}); await wait(40);
      ok("F: opslaan werkt zonder app-badge-API; pushPrefs standaard aan/aan", stored(W).list.some(i=>i.name==="kaas") && errs.length===0 && W.pushPrefs().op===true && W.pushPrefs().shopping===true);
      // b) Meer-tab: elke sectie rendert; zonder push-ondersteuning geen Meldingen-blok
      D.querySelector("#gear-btn").click(); await wait(80);
      const secs=[...D.querySelectorAll("#meer-content .section span")].map(s=>s.textContent.trim());
      const btn=(t)=>[...D.querySelectorAll("#meer-content button")].find(b=>b.textContent.trim()===t);
      ok("F: Meer-tab rendert alle secties zonder fout ("+secs.length+")", errs.length===0 && secs.length>=5 && ["Account","Back-up & privacy","Diagnose"].every(s=>secs.indexOf(s)!==-1) && secs.indexOf("Meldingen")===-1);
      ok("F: zonder cloudverbinding staan de account-knoppen uit, met uitleg", !!btn("Account maken met e-mail") && btn("Account maken met e-mail").disabled===true && !!btn("Ik heb al een account") && /Zodra er verbinding met de cloud is/.test(D.querySelector("#meer-content").textContent));
      // c) account-blad: gelabelde velden, verborgen codestap, werkende annuleren
      W.openAccountSheet("link"); await wait(60);
      const sh=D.querySelector("#sheet");
      ok("F: account-blad heeft gelabelde velden en een verborgen codestap", sh.classList.contains("show") && sh.querySelector("#acc-email").getAttribute("aria-label")==="E-mailadres" && sh.querySelector("#acc-code").getAttribute("aria-label")==="Code uit de mail" && sh.querySelector("#acc-step2").hidden===true && sh.querySelector("#acc-warn").hidden===true);
      sh.querySelector("#acc-cancel").click(); await wait(100);
      ok("F: Annuleren sluit het account-blad", !sh.classList.contains("show"));
      C.lists=[{id:"c1",name:"Gedeeld",member_count:2}];
      W.openAccountSheet("login"); await wait(60);
      const introOne=sh.querySelector("#acc-intro").textContent;
      sh.querySelector("#acc-cancel").click(); await wait(100);
      C.lists=[{id:"c1",name:"Gedeeld"},{id:"c2",name:"Ook gedeeld"}];
      W.openAccountSheet("login"); await wait(60);
      const introTwo=sh.querySelector("#acc-intro").textContent;
      sh.querySelector("#acc-cancel").click(); await wait(100); C.lists=[];
      ok("F: inlog-uitleg klopt in enkelvoud én meervoud", /de gedeelde lijst van dit toestel hoort bij/.test(introOne) && !/1 gedeelde/.test(introOne) && /de 2 gedeelde lijsten van dit toestel horen bij/.test(introTwo));
      // d) verwijder-blad: gelabeld bevestigingsveld, knop pas actief na VERWIJDER, annuleren wist niets
      C.ready=true; C.authEmail="florian@voorbeeld.nl";
      D.querySelector("#gear-btn").click(); await wait(30); D.querySelector("#gear-btn").click(); await wait(80);
      ok("F: Meer toont het gekoppelde account met verwijder-knop", /Ingelogd als/.test(D.querySelector("#meer-content").textContent) && !!btn("Verwijder mijn account en cloudgegevens"));
      btn("Verwijder mijn account en cloudgegevens").click(); await wait(60);
      const dInp=sh.querySelector("#del-acc-input"), dGo=sh.querySelector("#del-acc-go");
      ok("F: verwijder-blad heeft een gelabeld bevestigingsveld en een knop die uit staat", sh.classList.contains("show") && dInp.getAttribute("aria-label")==="Typ VERWIJDER om te bevestigen" && dGo.disabled===true);
      dInp.value="verwijder"; dInp.dispatchEvent(new W.Event("input",{bubbles:true})); await wait(20);
      ok("F: 'verwijder' bevestigt ook in kleine letters", dGo.disabled===false);
      sh.querySelector("#del-acc-cancel").click(); await wait(100);
      ok("F: Annuleren sluit het verwijder-blad en laat de opslag intact", !sh.classList.contains("show") && !!W.localStorage.getItem("mandje.v2") && errs.length===0);
      ok("F: copy: overal 'Meldingen', nergens nog 'Herinneringen'", !/Herinneringen/.test(html));
      dV.window.close();

      // e) koude start zonder cloud: cache-balk zonder "NaN"; meldingen-kaart alleen op een gedeelde lijst mét huisgenoten
      const seedQ=Object.assign({}, seedV, {cloudCache:{c1:{name:"Gedeeld", at:"kapot", items:[{id:"c1",name:"Cloudkaas",category:"kaas-vleeswaren",qty:1,unit:"",note:"",done:false,added_by_name:"Sanne"}]}}});
      const subQ={endpoint:"https://push.example/q", toJSON:()=>({keys:{p256dh:"k",auth:"a"}}), unsubscribe:async()=>true};
      const regQ={pushManager:{getSubscription:async()=>subQ, subscribe:async()=>subQ}};
      const dQ=new JSDOM(html,{url:"https://example.com/",runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w){
        w.localStorage.setItem("mandje.v2", JSON.stringify(seedQ)); w.localStorage.setItem("mandje.activeList","c1");
        w.PushManager=function(){}; w.Notification={permission:"default", requestPermission:()=>Promise.resolve("default")};
        Object.defineProperty(w.navigator,"serviceWorker",{value:{ready:Promise.resolve(regQ), register:()=>Promise.resolve(regQ), addEventListener(){}, controller:null}});
      }});
      await wait(700); const WQ=dQ.window, DQ=WQ.document, CQ=WQ.Cloud;
      const bar=DQ.querySelector("#cloud-cache-bar .cache-bar");
      ok("F: cache-balk toont nooit 'NaN' bij een onbruikbare tijdstempel", !!bar && !/NaN/.test(bar.textContent) && /1 te halen/.test(bar.textContent));
      CQ.enabled=true; CQ.ready=true; CQ.mode="cloud"; CQ.userId="u1"; CQ.active=null; CQ.members=[]; CQ.lists=[{id:"c1",name:"Gedeeld",member_count:2}];
      const toLijst=()=>{ DQ.querySelector('[data-tab="vaste"]').click(); DQ.querySelector('[data-tab="lijst"]').click(); };
      toLijst(); await wait(60);
      ok("F: geen meldingen-kaart op een persoonlijke lijst", CQ.pushEnabled()===true && !DQ.querySelector("#push-nudge .ritual.push"));
      CQ.active="c1"; CQ.lists=[{id:"c1",name:"Solo",member_count:1}]; CQ.members=[{user_id:"u1",display_name:"Ik"}];
      toLijst(); await wait(60);
      ok("F: geen meldingen-kaart op een gedeelde lijst zonder huisgenoten", !DQ.querySelector("#push-nudge .ritual.push"));
      CQ.lists=[{id:"c1",name:"Samen",member_count:2}];
      toLijst(); await wait(60);
      ok("F: wél een meldingen-kaart zodra er een huisgenoot is", !!DQ.querySelector("#push-nudge .ritual.push"));
      dQ.window.close();
    }
  }

  console.log("\nt5: "+pass+" geslaagd, "+fail+" gefaald");
  process.exit(fail?1:0);
})().catch(e=>{ console.error("t5 TESTFOUT:", e); process.exit(2); });
