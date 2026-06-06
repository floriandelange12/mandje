"use strict";
(function(){

/* ============================================================
   CATEGORIEËN + classificatie (NL-schappen)
   ============================================================ */
var CATS = [
  {id:"groente-fruit",  label:"Groente & fruit",   glyph:"🥬"},
  {id:"brood-banket",   label:"Brood & banket",    glyph:"🥖"},
  {id:"zuivel-eieren",  label:"Zuivel & eieren",   glyph:"🥛"},
  {id:"kaas-vleeswaren",label:"Kaas & vleeswaren", glyph:"🧀"},
  {id:"vlees-vis",      label:"Vlees & vis",       glyph:"🍗"},
  {id:"diepvries",      label:"Diepvries",         glyph:"🧊"},
  {id:"ontbijt-beleg",  label:"Ontbijt & beleg",   glyph:"🍯"},
  {id:"houdbaar",       label:"Houdbaar",          glyph:"🥫"},
  {id:"snoep-snacks",   label:"Snoep & snacks",    glyph:"🍫"},
  {id:"dranken",        label:"Dranken",           glyph:"🧃"},
  {id:"huishouden",     label:"Huishouden",        glyph:"🧽"},
  {id:"verzorging",     label:"Verzorging",        glyph:"🧴"},
  {id:"overig",         label:"Overig",            glyph:"🛒"}
];
var CAT_BY_ID = {}; CATS.forEach(function(c){ CAT_BY_ID[c.id]=c; });

var KW = {
  "groente-fruit":["appel","appels","banaan","bananen","peer","peren","sinaasappel","mandarijn","druif","druiven","aardbei","framboos","bes","blauwe bes","kiwi","mango","ananas","citroen","limoen","avocado","tomaat","tomaten","cherrytomaat","komkommer","paprika","sla","ijsbergsla","andijvie","spinazie","broccoli","bloemkool","wortel","wortels","peen","ui","uien","rode ui","knoflook","aardappel","aardappels","krieltjes","prei","courgette","aubergine","champignon","paddenstoel","sperziebon","erwt","mais","pompoen","radijs","biet","bleekselderij","venkel","asperge","witlof","rucola","pruim","perzik","nectarine","meloen","granaatappel","gember","verse kruiden","basilicum","peterselie"],
  "brood-banket":["brood","bruinbrood","witbrood","volkorenbrood","volkoren","stokbrood","baguette","croissant","broodje","bolletje","pistolet","krentenbol","beschuit","cracker","ontbijtkoek","cake","taart","gebak","koek","koekje","wrap","tortilla","pita","naan","muffin","donut","appeltaart"],
  "zuivel-eieren":["melk","halfvolle melk","volle melk","karnemelk","yoghurt","griekse yoghurt","kwark","vla","room","slagroom","creme fraiche","zure room","boter","roomboter","margarine","ei","eieren","sojamelk","havermelk","amandelmelk","kefir","pudding","drinkyoghurt","koffiemelk"],
  "kaas-vleeswaren":["kaas","jong belegen","oude kaas","geraspte kaas","mozzarella","parmezaan","brie","feta","ham","kipfilet vleeswaren","achterham","salami","cervelaat","worst","rookworst","spek","bacon","pate","leverworst","rosbief","gerookte kip","smeerkaas","roomkaas"],
  "vlees-vis":["vlees","gehakt","rundergehakt","biefstuk","kip","kipfilet","kipdij","kippenpoot","varkenshaas","speklap","rund","lamsvlees","worstjes","braadworst","hamburger","schnitzel","shoarma","vis","zalm","tonijn","kabeljauw","garnaal","garnalen","mossel","haring","makreel","forel","kibbeling","tilapia","pangasius","tofu","tempeh","vegaburger","gerookte zalm"],
  "diepvries":["diepvries","ijs","ijsje","magnum","pizza","diepvriespizza","friet","frites","frikandel","kroket","bitterbal","vissticks","loempia","spinazie diepvries","doperwten","tuinbonen","bladerdeeg","ijsblokjes"],
  "ontbijt-beleg":["hagelslag","vlokken","pindakaas","jam","aardbeienjam","honing","stroop","appelstroop","muesli","cruesli","cornflakes","havermout","granola","nutella","chocopasta","sambal","tahini","appelmoes","speculoospasta"],
  "houdbaar":["pasta","spaghetti","macaroni","penne","rijst","basmati","noedels","mie","couscous","bulgur","quinoa","meel","bloem","suiker","basterdsuiker","zout","peper","kruiden","kerrie","paprikapoeder","olie","olijfolie","zonnebloemolie","azijn","balsamico","saus","pastasaus","ketchup","mayonaise","mayo","mosterd","soep","bouillon","blik","conserven","tomatenblokjes","passata","tomatenpuree","kokosmelk","linzen","kikkererwt","kidneybonen","bruine bonen","augurk","olijf","pesto","currypasta","gist","cacao","rozijnen","noten ongezouten"],
  "snoep-snacks":["chocola","chocolade","reep","snoep","drop","chips","naturel chips","paprikachips","nootjes","noten","pinda","cashew","popcorn","mars","snickers","twix","winegum","zoutjes","toastje","borrelnoot","koekjes","stroopwafel","pepernoten","zoute krakeling"],
  "dranken":["water","spa","bruiswater","cola","fris","frisdrank","sap","sinaasappelsap","appelsap","limonade","ranja","siroop","ice tea","icetea","thee","groene thee","koffie","koffiebonen","espresso","cappuccino","oploskoffie","bier","wijn","rode wijn","witte wijn","prosecco","energiedrank","red bull","tonic","kombucha","smoothie","chocomel"],
  "huishouden":["wc papier","toiletpapier","wc-papier","keukenrol","vuilniszak","afwasmiddel","afwas","vaatwastablet","vaatwas","wasmiddel","wasverzachter","allesreiniger","schoonmaak","spons","schuurspons","vochtige doekjes","aluminiumfolie","vershoudfolie","bakpapier","batterij","batterijen","lamp","kaars","theelicht","luier","zakdoek","tissue","afwasborstel","vaatwasmiddel"],
  "verzorging":["shampoo","conditioner","zeep","handzeep","douchegel","tandpasta","tandenborstel","floss","deodorant","deo","scheermes","scheerschuim","bodylotion","handcreme","creme","maandverband","tampon","watten","wattenstaafje","mondwater","zonnebrand","vitamine","paracetamol","pleister","verband"]
};
// vlakke lijst {kw, cat}, gesorteerd op lengte aflopend voor specificiteit
var FLAT_KW = [];
Object.keys(KW).forEach(function(cat){ KW[cat].forEach(function(w){ FLAT_KW.push({w:w, cat:cat}); }); });
FLAT_KW.sort(function(a,b){ return b.w.length - a.w.length; });

function norm(s){ return (s||"").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

function lev(a,b){
  var m=a.length,n=b.length; if(Math.abs(m-n)>1) return 2;
  var prev=[],cur=[],i,j;
  for(j=0;j<=n;j++) prev[j]=j;
  for(i=1;i<=m;i++){
    cur[0]=i;
    for(j=1;j<=n;j++){
      var c=a.charAt(i-1)===b.charAt(j-1)?0:1;
      cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+c);
    }
    for(j=0;j<=n;j++) prev[j]=cur[j];
  }
  return prev[n];
}
function classify(name){
  var n = norm(name);
  if(!n) return "overig";
  var words = n.split(/\s+/);
  for(var i=0;i<FLAT_KW.length;i++){
    var w = FLAT_KW[i].w;
    if(w.length >= 4){
      if(n.indexOf(w) !== -1) return FLAT_KW[i].cat;
    } else {
      if(words.indexOf(w) !== -1) return FLAT_KW[i].cat;
    }
  }
  // typefout-tolerant: 1 teken verschil op een heel woord (min. 5 tekens)
  for(var wi=0;wi<words.length;wi++){
    var word=words[wi]; if(word.length<5) continue;
    for(var k=0;k<FLAT_KW.length;k++){
      var kw=FLAT_KW[k].w;
      if(kw.length<5) continue;
      if(Math.abs(kw.length-word.length)<=1 && lev(word,kw)<=1) return FLAT_KW[k].cat;
    }
  }
  return "overig";
}

// Veelgekochte producten voor autocomplete (geen vaste lijst, alleen suggesties bij typen)
var COMMON = ["Melk","Brood","Eieren","Kaas","Boter","Yoghurt","Kwark","Karnemelk","Slagroom","Kipfilet","Gehakt","Zalm","Tonijn","Ham","Salami","Bananen","Appels","Sinaasappels","Druiven","Citroen","Tomaten","Komkommer","Sla","Paprika","Avocado","Aardappels","Uien","Knoflook","Wortels","Broccoli","Spinazie","Champignons","Courgette","Pasta","Spaghetti","Rijst","Couscous","Bloem","Suiker","Zout","Olijfolie","Azijn","Pastasaus","Tomatenblokjes","Kokosmelk","Kidneybonen","Linzen","Soep","Pindakaas","Hagelslag","Jam","Honing","Muesli","Havermout","Cornflakes","Koffie","Thee","Water","Spa","Cola","Sinaasappelsap","Bier","Wijn","Chips","Chocolade","Stroopwafels","Crackers","Beschuit","Croissants","Stokbrood","Mozzarella","Feta","Pizza","IJs","Mayonaise","Ketchup","Mosterd","Wc-papier","Keukenrol","Vuilniszakken","Afwasmiddel","Wasmiddel","Allesreiniger","Shampoo","Tandpasta","Deodorant"];

/* ============================================================
   STORE — localStorage + migratie
   ============================================================ */
var NS = "mandje.v2";
var DEFAULTS = {
  version:2,
  settings:{ theme:"auto", showPrices:false, seenIntro:false, categoryOrder:CATS.map(function(c){return c.id;}), minPurchases:3, cvThreshold:0.6, dueWindowDays:1 },
  list:[],
  catalog:{}
};

var state = null;

function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

function load(){
  var raw = null, parsed = null;
  try{ raw = localStorage.getItem(NS); }catch(e){}
  if(raw){
    try{ parsed = JSON.parse(raw); }catch(e){ parsed = null; }
  }
  if(parsed && typeof parsed === "object"){
    state = Object.assign(deepClone(DEFAULTS), parsed);
    state.settings = Object.assign(deepClone(DEFAULTS.settings), state.settings||{});
    if(!Array.isArray(state.list)) state.list=[];
    if(!state.catalog || typeof state.catalog!=="object") state.catalog={};
    if(!Array.isArray(state.settings.categoryOrder)) state.settings.categoryOrder = DEFAULTS.settings.categoryOrder.slice();
    CATS.forEach(function(c){ if(state.settings.categoryOrder.indexOf(c.id)===-1) state.settings.categoryOrder.push(c.id); });
    return;
  }
  // geen geldige v2-data → eenmalige migratie vanaf v1
  state = deepClone(DEFAULTS);
  try{
    var oldItems = JSON.parse(localStorage.getItem("mandje.items.v1")||"null");
    if(Array.isArray(oldItems)){
      oldItems.forEach(function(it){
        state.list.push({ id:uid(), name:it.name, category:classify(it.name), qty:it.qty||1, price:(it.price==null?null:it.price), note:"", done:!!it.done, addedAt:nowISO() });
        touchCatalog(it.name, it.price);
      });
    }
  }catch(e){}
  save();
}

function save(){
  try{ localStorage.setItem(NS, JSON.stringify(state)); }catch(e){}
}

/* ============================================================
   CATALOG — leer-database per product
   ============================================================ */
function touchCatalog(name, price){
  var k = norm(name);
  if(!k) return null;
  var e = state.catalog[k];
  if(!e){
    e = { name:name.trim(), category:classify(name), defaultPrice:(price==null?null:price), purchaseDates:[], timesAdded:0, lastAddedAt:null, cadenceMode:"auto", manualIntervalDays:null };
    state.catalog[k]=e;
  }
  e.name = name.trim();
  if(price!=null) e.defaultPrice = price;
  e.timesAdded = (e.timesAdded||0)+1;
  e.lastAddedAt = nowISO();
  return e;
}

function recordPurchase(name, price){
  var k = norm(name); var e = state.catalog[k];
  if(!e){ e = touchCatalog(name, price); }
  var today = todayStr();
  e.purchaseDates = e.purchaseDates||[];
  // niet dubbel op dezelfde dag
  if(e.purchaseDates[e.purchaseDates.length-1] !== today) e.purchaseDates.push(today);
  if(price!=null) e.defaultPrice = price;
}

/* ============================================================
   CADENCE — analyse + due-detectie
   ============================================================ */
function todayStr(){ var d=new Date(); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function pad(n){ return (n<10?"0":"")+n; }
function parseDay(s){ return new Date(s+"T00:00:00"); }
function dayDiff(a,b){ return Math.round((b-a)/86400000); }
function addDays(d,n){ return new Date(d.getTime()+n*86400000); }
function nowISO(){ return new Date().toISOString(); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

function analyse(e){
  var s = state.settings;
  var ds = (e.purchaseDates||[]).slice().sort();
  var last = ds.length ? parseDay(ds[ds.length-1]) : null;
  var today = parseDay(todayStr());

  if(e.cadenceMode === "off"){ return {mode:"off", regular:false, last:last}; }

  if(e.cadenceMode === "manual" && e.manualIntervalDays){
    var iv = e.manualIntervalDays;
    var next = last ? addDays(last, iv) : today;
    var overdue = last ? (dayDiff(next, today))/iv : 1;
    return { mode:"manual", interval:iv, mean:iv, last:last, next:next, overdue:overdue, regular:true };
  }

  if(ds.length < 2){ return { mode:"auto", regular:false, last:last, count:ds.length }; }
  var gaps=[]; for(var i=1;i<ds.length;i++){ gaps.push(dayDiff(parseDay(ds[i-1]), parseDay(ds[i]))); }
  var mean = gaps.reduce(function(a,b){return a+b;},0)/gaps.length;
  var variance = gaps.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/gaps.length;
  var sd = Math.sqrt(variance);
  var cv = mean ? sd/mean : Infinity;
  var nextA = addDays(last, mean);
  var overdueA = mean ? (dayDiff(nextA, today))/mean : 0;
  var regular = (ds.length >= s.minPurchases) && (cv < s.cvThreshold) && mean >= 1;
  return { mode:"auto", mean:mean, cv:cv, last:last, next:nextA, overdue:overdueA, regular:regular, count:ds.length };
}

function isDue(a){
  if(!a.regular || !a.next) return false;
  var today = parseDay(todayStr());
  var threshold = addDays(a.next, -state.settings.dueWindowDays);
  return today.getTime() >= threshold.getTime();
}

// items die "bijna op" zijn en nog niet open op de lijst staan
function getDueItems(){
  var openKeys = {};
  state.list.forEach(function(it){ if(!it.done) openKeys[norm(it.name)]=true; });
  var out=[];
  Object.keys(state.catalog).forEach(function(k){
    if(openKeys[k]) return;
    var e=state.catalog[k]; var a=analyse(e);
    if(isDue(a)) out.push({key:k, e:e, a:a});
  });
  out.sort(function(x,y){ return y.a.overdue - x.a.overdue; });
  return out;
}

// alle "vaste" producten (handmatig of automatisch herkend als regelmatig)
function getRecurring(){
  var out=[];
  Object.keys(state.catalog).forEach(function(k){
    var e=state.catalog[k]; var a=analyse(e);
    var recurring = (a.mode==="manual") || (a.mode==="auto" && a.regular);
    if(recurring) out.push({key:k, e:e, a:a});
  });
  // due eerst, dan op naam
  out.sort(function(x,y){
    var dx=isDue(x.a)?1:0, dy=isDue(y.a)?1:0;
    if(dx!==dy) return dy-dx;
    return x.e.name.localeCompare(y.e.name,"nl");
  });
  return out;
}

function cadenceLabel(a){
  if(a.mode==="manual"){
    if(a.interval===7) return "Elke week";
    if(a.interval===14) return "Elke 2 weken";
    if(a.interval>=28 && a.interval<=31) return "Elke maand";
    return "Elke "+a.interval+" dagen";
  }
  if(a.mode==="auto" && a.regular){
    var n=Math.round(a.mean);
    if(n<=8 && n>=6) return "Meestal wekelijks";
    if(n>=13 && n<=15) return "Meestal 2-wekelijks";
    if(n>=28 && n<=31) return "Meestal maandelijks";
    return "Meestal elke ~"+n+" dagen";
  }
  return "";
}
function lastSeenLabel(a){
  if(!a.last) return "";
  var d = dayDiff(a.last, parseDay(todayStr()));
  if(d<=0) return "vandaag gekocht";
  if(d===1) return "gisteren gekocht";
  return d+" dagen geleden gekocht";
}

/* ============================================================
   FORMATTERS
   ============================================================ */
function euro(n){ return "€"+(n||0).toLocaleString("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function parsePrice(str){
  if(str==null || str==="") return null;
  str = String(str).replace(/[^0-9,.\-]/g,"").replace(/\./g,".").replace(",",".");
  // herstel: laatste punt is decimaal
  var n = parseFloat(str);
  return isNaN(n)?null:n;
}
function $(s){ return document.querySelector(s); }
function el(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
function vibrate(ms){ if(navigator.vibrate){ try{navigator.vibrate(ms);}catch(e){} } }

var CHECK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="var(--on-green)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

/* ============================================================
   TOAST
   ============================================================ */
var toastT;
function toast(msg){
  var t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove("show"); },1500);
}

/* ============================================================
   LIJST — acties
   ============================================================ */
function addToList(name, price, opts){
  name=(name||"").trim(); if(!name) return false;
  opts=opts||{};
  if(Cloud.active){ Cloud.addItem(name, (state.settings.showPrices?price:null)); touchCatalog(name, price); save(); return true; }
  var k=norm(name);
  var existing = state.list.find(function(i){ return !i.done && norm(i.name)===k; });
  if(existing){ existing.qty+=1; if(price!=null) existing.price=price; }
  else{
    var cat = (state.catalog[k] && state.catalog[k].category) || classify(name);
    var defPrice = price!=null ? price : (state.catalog[k] ? state.catalog[k].defaultPrice : null);
    state.list.unshift({ id:uid(), name:name, category:cat, qty:1, price:(state.settings.showPrices?defPrice:null), note:"", done:false, addedAt:nowISO() });
  }
  touchCatalog(name, price);
  save(); renderLijst(); renderDueBanner();
  return true;
}
function toggleDone(id){
  if(Cloud.active){ Cloud.toggle(id); vibrate(8); return; }
  var it=state.list.find(function(i){return i.id===id;}); if(!it) return;
  it.done=!it.done; if(it.done) vibrate(8);
  save(); renderLijst();
}
function setQty(id,delta){
  if(Cloud.active){ Cloud.qty(id,delta); return; }
  var it=state.list.find(function(i){return i.id===id;}); if(!it) return;
  it.qty=Math.max(1,it.qty+delta); save(); renderLijst();
}
function removeFromList(id){
  if(Cloud.active){ Cloud.remove(id); return; }
  state.list=state.list.filter(function(i){return i.id!==id;}); save(); renderLijst(); renderDueBanner();
}
function finishShopping(){
  if(Cloud.active){ Cloud.finish(); return; }
  var done=state.list.filter(function(i){return i.done;});
  if(!done.length) return;
  done.forEach(function(it){ recordPurchase(it.name, it.price); });
  state.list=state.list.filter(function(i){return !i.done;});
  save(); renderLijst(); renderDueBanner(); renderVaste();
  toast(done.length+(done.length===1?" boodschap gekocht":" boodschappen gekocht"));
  vibrate(12);
}

/* ============================================================
   RENDER — Lijst-tab
   ============================================================ */
function renderLijst(){
  var open = state.list.filter(function(i){return !i.done;});
  var done = state.list.filter(function(i){return i.done;});
  var openWrap=$("#open-list"); openWrap.innerHTML="";
  var doneWrap=$("#done-list"); doneWrap.innerHTML="";

  if(state.list.length===0){
    openWrap.appendChild(emptyState("bag","Leeg mandje","Typ hierboven wat je nodig hebt. Producten landen vanzelf in het juiste schap."));
  } else {
    // groepeer open per categorie volgens categoryOrder
    var byCat={}; open.forEach(function(it){ (byCat[it.category]=byCat[it.category]||[]).push(it); });
    state.settings.categoryOrder.forEach(function(cid){
      var arr=byCat[cid]; if(!arr || !arr.length) return;
      var c=CAT_BY_ID[cid]||CAT_BY_ID["overig"];
      var sec=el("div","section");
      sec.innerHTML='<span class="cat-emoji">'+c.glyph+'</span><span>'+c.label+'</span><span class="count">'+arr.length+'</span>';
      openWrap.appendChild(sec);
      var ul=el("ul","list");
      arr.forEach(function(it){ ul.appendChild(itemRow(it)); });
      openWrap.appendChild(ul);
    });
    if(done.length){
      var s2=el("div","section");
      s2.innerHTML='<span>In mandje</span><span class="count">'+done.length+'</span>';
      doneWrap.appendChild(s2);
      var ul2=el("ul","list"); done.forEach(function(it){ ul2.appendChild(itemRow(it)); });
      doneWrap.appendChild(ul2);
    }
  }
  updateTotals();
  updateSubhead();
}

function itemRow(it){
  var li=el("li","row"+(it.done?" done":""));
  li.appendChild(el("div","behind",'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg><span>Verwijder</span>'));
  var card=el("div","card");

  var a = state.catalog[norm(it.name)] ? analyse(state.catalog[norm(it.name)]) : null;
  var sub="";
  if(it.note) sub+='<span>'+escapeHtml(it.note)+'</span>';
  if(state.settings.showPrices && it.price!=null) sub+=(sub?' · ':'')+'<span>'+euro(it.price)+(it.qty>1?' × '+it.qty:'')+'</span>';
  if(Cloud.active){
    var asg = it.assigned_to ? Cloud.memberById(it.assigned_to) : null;
    if(asg) sub+=(sub?' · ':'')+'<span style="color:'+asg.color+';font-weight:700">→ '+escapeHtml(asg.display_name)+'</span>';
    else if(it.added_by_name) sub+=(sub?' · ':'')+'<span style="color:var(--ink-faint)">+ '+escapeHtml(it.added_by_name)+'</span>';
  }

  card.innerHTML =
    '<div class="check">'+CHECK_SVG+'</div>'+
    '<div class="meta"><div class="nm"></div>'+(sub?'<div class="sub2">'+sub+'</div>':'')+'</div>'+
    '<div class="qty"><button class="q-minus" aria-label="minder">–</button><span>'+it.qty+'</span><button class="q-plus" aria-label="meer">+</button></div>'+
    (state.settings.showPrices && it.price!=null ? '<div class="price">'+euro(it.price*it.qty)+'</div>' : '');
  card.querySelector(".nm").textContent=it.name;

  card.querySelector(".check").addEventListener("click",function(e){ e.stopPropagation(); toggleDone(it.id); });
  card.querySelector(".q-minus").addEventListener("click",function(e){ e.stopPropagation(); setQty(it.id,-1); });
  card.querySelector(".q-plus").addEventListener("click",function(e){ e.stopPropagation(); setQty(it.id,1); });
  card.addEventListener("click",function(){ if(card._suppressClick) return; openSheet(it.id); });

  li.appendChild(card);
  attachSwipe(card, function(){ removeFromList(it.id); });
  return li;
}

function updateTotals(){
  var total=0, cart=0, hasPrices=false;
  state.list.forEach(function(i){ var v=(i.price||0)*i.qty; total+=v; if(i.done) cart+=v; if(i.price!=null) hasPrices=true; });
  var done=state.list.filter(function(i){return i.done;}).length;
  $("#t-total").textContent=euro(total);
  $("#t-cart").textContent=euro(cart)+" in mandje";
  $("#t-prog").style.width=(total>0?Math.round(cart/total*100):0)+"%";
  $("#t-finish").style.display=done?"inline-flex":"none";
  var hint=$("#t-hint"); if(hint) hint.style.display=(state.settings.showPrices && !hasPrices && state.list.length>0)?"block":"none";
  var progWrap=$("#t-prog-wrap"); if(progWrap) progWrap.style.display=hasPrices?"block":"none";
  var show = activeTab==="lijst" && state.list.length>0 && state.settings.showPrices;
  $("#totals").classList.toggle("hide", !show);
  $("#pad-lijst").className = "pad-bottom"+(show?" with-total":"");
}

function updateSubhead(){
  if(activeTab!=="lijst") return;
  var open=state.list.filter(function(i){return !i.done;}).length;
  var done=state.list.filter(function(i){return i.done;}).length;
  var base = state.list.length===0 ? "Niets op de lijst" : (open+" te halen · "+done+" in mandje");
  var b = (window.MANDJE_CONFIG && window.MANDJE_CONFIG.BUILD) || "dev";
  $("#subhead").textContent = base + " · v" + b;
}

/* ---------- "Bijna op" banner ---------- */
function renderDueBanner(){
  var wrap=$("#due-banner"); wrap.innerHTML="";
  if(activeTab!=="lijst") return;
  var due=getDueItems(); if(!due.length) return;
  var top=due.slice(0,6);
  var b=el("div","banner");
  b.innerHTML='<div class="b-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>Bijna op — koop je waarschijnlijk weer</div>';
  var chips=el("div","chips");
  top.forEach(function(d){
    var c=CAT_BY_ID[d.e.category]||CAT_BY_ID["overig"];
    var chip=el("button","chip amber",'<span class="emoji">'+c.glyph+'</span><span>'+escapeHtml(d.e.name)+'</span><span class="plus">+</span>');
    chip.addEventListener("click",function(){ addToList(d.e.name, d.e.defaultPrice); toast(d.e.name+" toegevoegd"); });
    chips.appendChild(chip);
  });
  b.appendChild(chips);
  wrap.appendChild(b);
}

/* ============================================================
   RENDER — Vaste-tab
   ============================================================ */
function renderVaste(){
  var wrap=$("#vaste-content"); wrap.innerHTML="";
  var rec=getRecurring();
  var due=rec.filter(function(r){return isDue(r.a);});
  var rest=rec.filter(function(r){return !isDue(r.a);});

  if(rec.length===0){
    wrap.appendChild(emptyState("repeat","Nog geen vaste boodschappen","Mandje leert vanzelf wat je vaak koopt. Streep items af en rond je boodschappen af — na een paar keer verschijnen ze hier op jouw ritme. Of stel zelf een ritme in via een product op je lijst."));
    return;
  }
  if(due.length){
    wrap.appendChild(sectionLabel("🔔","Bijna op",due.length));
    var u1=el("ul","list"); due.forEach(function(r){ u1.appendChild(vasteRow(r)); }); wrap.appendChild(u1);
  }
  if(rest.length){
    wrap.appendChild(sectionLabel("🔁","Jouw vaste boodschappen",rest.length));
    var u2=el("ul","list"); rest.forEach(function(r){ u2.appendChild(vasteRow(r)); }); wrap.appendChild(u2);
  }
}
function sectionLabel(glyph,label,count){
  var s=el("div","section"); s.innerHTML='<span class="cat-emoji">'+glyph+'</span><span>'+label+'</span><span class="count">'+count+'</span>'; return s;
}
function vasteRow(r){
  var c=CAT_BY_ID[r.e.category]||CAT_BY_ID["overig"];
  var onList = state.list.some(function(i){ return !i.done && norm(i.name)===r.key; });
  var li=el("li");
  var div=el("div","vrow"+(onList?" onlist":""));
  var cad=cadenceLabel(r.a); var seen=lastSeenLabel(r.a);
  var info = cad + (seen?(' · '+seen):'');
  if(isDue(r.a)) info='<b>Bijna op</b> · '+info;
  div.innerHTML=
    '<div class="vemoji">'+c.glyph+'</div>'+
    '<div class="vmeta"><div class="vname"></div><div class="vcad">'+info+'</div></div>'+
    '<button class="vadd" aria-label="Toevoegen">'+(onList?'✓':'+')+'</button>';
  div.querySelector(".vname").textContent=r.e.name;
  div.querySelector(".vadd").addEventListener("click",function(e){
    e.stopPropagation();
    addToList(r.e.name, r.e.defaultPrice); toast(r.e.name+" toegevoegd"); renderVaste();
  });
  div.addEventListener("click",function(){ openSheetForCatalog(r.key); });
  li.appendChild(div);
  return li;
}

/* ============================================================
   RENDER — Meer-tab
   ============================================================ */
function renderMeer(){
  var wrap=$("#meer-content"); wrap.innerHTML="";

  // Weergave
  var g1=el("div","group");
  var themeRow=el("div","grow");
  themeRow.innerHTML='<div><div class="glabel">Thema</div></div><div class="spacer" style="flex:1"></div>';
  var seg=el("div","seg");
  [["auto","Auto"],["light","Licht"],["dark","Donker"]].forEach(function(o){
    var b=el("button",state.settings.theme===o[0]?"on":"",o[1]);
    b.addEventListener("click",function(){ state.settings.theme=o[0]; save(); applyTheme(); renderMeer(); });
    seg.appendChild(b);
  });
  themeRow.appendChild(seg);
  g1.appendChild(themeRow);

  var priceRow=el("div","grow");
  priceRow.innerHTML='<div class="glabel">Prijzen bijhouden<div class="gsub">Toon een prijs per product en een lopend totaal</div></div>';
  var sw=el("button","switch"+(state.settings.showPrices?" on":""));
  sw.addEventListener("click",function(){ state.settings.showPrices=!state.settings.showPrices; save(); applyPriceVisibility(); renderLijst(); renderMeer(); });
  priceRow.appendChild(sw);
  g1.appendChild(priceRow);
  wrap.appendChild(g1);

  // Back-up
  wrap.appendChild(el("div","section",'<span>Back-up</span>'));
  wrap.appendChild(el("div","hint","Gedeelde lijsten staan veilig in de cloud. Je persoonlijke lijst staat op dit toestel — exporteer 'm af en toe als back-up, of zet 'm terug op een nieuw toestel."));
  var expf=el("button","mbtn","Exporteer mijn lijst (bestand)");
  expf.addEventListener("click",exportFile);
  wrap.appendChild(expf);
  var impf=el("button","mbtn","Importeer uit bestand");
  impf.addEventListener("click",importFromFile);
  wrap.appendChild(impf);

  var reset=el("button","mbtn danger","Alles wissen");
  reset.addEventListener("click",function(){
    if(confirm("Weet je zeker dat je alle lijsten, vaste boodschappen en geschiedenis wilt wissen?")){
      state=deepClone(DEFAULTS); state.settings.seenIntro=true; save(); applyTheme(); applyPriceVisibility();
      renderLijst(); renderDueBanner(); renderVaste(); renderMeer(); toast("Alles gewist");
    }
  });
  wrap.appendChild(reset);

  // info
  var n=Object.keys(state.catalog).length;
  wrap.appendChild(el("div","hint","Mandje kent inmiddels "+n+" "+(n===1?"product":"producten")+" uit jouw geschiedenis. Hoe vaker je afrondt, hoe slimmer de vaste boodschappen worden."));

  // build/verbinding-vingerafdruk (helpt cache-versie verifiëren)
  var cfg = window.MANDJE_CONFIG || {};
  var ref = (cfg.SUPABASE_URL || "").match(/\/\/([a-z0-9]+)\./);
  var refStr = ref ? ref[1].slice(0, 8) : "(geen)";
  var buildStr = cfg.BUILD || "dev";
  wrap.appendChild(el("div","hint","Verbonden met "+refStr+" · build "+buildStr));
}

/* ---------- Export / import (bestand) ---------- */
function exportFile(){
  try{
    var blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a"); a.href=url; a.download="mandje-backup.json"; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); },500);
    toast("Bestand geëxporteerd");
  }catch(e){ toast("Exporteren lukte niet"); }
}
function importFromFile(){
  var inp=document.createElement("input"); inp.type="file"; inp.accept="application/json,.json";
  inp.addEventListener("change",function(){
    var f=inp.files&&inp.files[0]; if(!f) return;
    var r=new FileReader();
    r.onload=function(){
      try{
        var data=JSON.parse(r.result);
        if(!data || typeof data!=="object" || !("catalog" in data)) throw new Error("ongeldig");
        state=Object.assign(deepClone(DEFAULTS),data);
        state.settings=Object.assign(deepClone(DEFAULTS.settings),data.settings||{});
        save(); applyTheme(); applyPriceVisibility();
        renderLijst(); renderDueBanner(); renderVaste(); renderMeer();
        toast("Back-up hersteld");
      }catch(e){ toast("Kon bestand niet lezen"); }
    };
    r.readAsText(f);
  });
  inp.click();
}

/* ============================================================
   BOTTOM SHEET
   ============================================================ */
var sheetCtx=null; // {type:'list'|'catalog', id|key}

function openSheet(listId){
  var it=state.list.find(function(i){return i.id===listId;}); if(!it) return;
  var k=norm(it.name);
  var e=state.catalog[k]; var a=e?analyse(e):null;
  sheetCtx={type:"list", id:listId, key:k};
  buildSheet({ name:it.name, qty:it.qty, price:it.price, note:it.note, category:it.category, assigned_to:it.assigned_to||null, cadenceMode:e?e.cadenceMode:"auto", manualIntervalDays:e?e.manualIntervalDays:null, a:a });
}
function openSheetForCatalog(key){
  var e=state.catalog[key]; if(!e) return; var a=analyse(e);
  sheetCtx={type:"catalog", key:key};
  buildSheet({ name:e.name, qty:null, price:e.defaultPrice, note:"", category:e.category, cadenceMode:e.cadenceMode, manualIntervalDays:e.manualIntervalDays, a:a, catalogOnly:true });
}

function buildSheet(d){
  var sheet=$("#sheet");
  var cadMode = d.cadenceMode || "auto";
  var manual = d.manualIntervalDays;
  var selCad = (cadMode==="off")?"off":(cadMode==="manual"? ("m"+manual) : "auto");

  var statusLine="";
  if(d.a){
    if(d.a.mode==="auto" && d.a.regular) statusLine=cadenceLabel(d.a)+" · "+lastSeenLabel(d.a);
    else if(d.a.mode==="manual") statusLine=cadenceLabel(d.a)+(d.a.last?(" · "+lastSeenLabel(d.a)):"");
    else if(d.a.count) statusLine="Nog "+(state.settings.minPurchases-d.a.count)+"× kopen voor een automatisch ritme";
  }

  var html='<div class="grip"></div><h3></h3>';

  if(!d.catalogOnly){
    html+='<div class="frow"><div class="fl">Aantal</div><div class="qty" style="background:var(--surface-2);border:1px solid var(--line)"><button class="s-qminus">–</button><span id="s-qty">'+d.qty+'</span><button class="s-qplus">+</button></div></div>';
    if(state.settings.showPrices){
      html+='<div class="frow"><div class="fl">Prijs</div><input class="num" id="s-price" inputmode="decimal" placeholder="0,00" value="'+(d.price!=null?String(d.price).replace(".",","):"")+'"></div>';
    }
    html+='<div class="frow"><div class="fl">Notitie</div><input class="txt" id="s-note" placeholder="bijv. 1 liter, merk…" value="'+escapeAttr(d.note||"")+'"></div>';
  }

  var showAssign = (!d.catalogOnly && Cloud.active && Cloud.members.length>0);
  if(showAssign){
    html+='<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);margin:6px 6px 8px">Wie haalt het?</div>';
    html+='<div class="cadrow" id="s-assign"><button class="cadchip'+(!d.assigned_to?" on":"")+'" data-m="">Niemand</button>';
    Cloud.members.forEach(function(m){
      html+='<button class="cadchip'+(d.assigned_to===m.id?" on":"")+'" data-m="'+m.id+'" style="'+(d.assigned_to===m.id?'background:'+m.color+';border-color:transparent':'')+'">'+escapeHtml(m.display_name)+'</button>';
    });
    html+='</div>';
  }

  html+='<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);margin:6px 6px 8px">Schap</div>';
  html+='<div class="catscroll" id="s-cats"></div>';

  html+='<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);margin:10px 6px 8px">Herinner me — vaste boodschap</div>';
  if(statusLine) html+='<div class="hint" style="margin:0 6px 10px">'+statusLine+'</div>';
  html+='<div class="cadrow" id="s-cad">'+
        cadChip("auto","Automatisch",selCad)+
        cadChip("m7","Wekelijks",selCad)+
        cadChip("m14","2-wekelijks",selCad)+
        cadChip("m30","Maandelijks",selCad)+
        cadChip("off","Uit",selCad)+
        '</div>';

  html+='<div class="sheet-actions">'+
        '<button class="save" id="s-save">'+(d.catalogOnly?"Opslaan":"Klaar")+'</button>'+
        (d.catalogOnly?'':'<button class="del" id="s-del">Verwijder</button>')+
        '</div>';

  sheet.innerHTML=html;
  sheet.querySelector("h3").textContent=d.name;

  // categorie-chips
  var catWrap=sheet.querySelector("#s-cats");
  var chosenCat=d.category||"overig";
  CATS.forEach(function(c){
    var b=el("button","catchip"+(c.id===chosenCat?" on":""),'<span>'+c.glyph+'</span><span>'+c.label+'</span>');
    b.addEventListener("click",function(){ chosenCat=c.id; catWrap.querySelectorAll(".catchip").forEach(function(x){x.classList.remove("on");}); b.classList.add("on"); });
    catWrap.appendChild(b);
  });

  // cadans-chips
  var chosenCad=selCad;
  sheet.querySelectorAll("#s-cad .cadchip").forEach(function(b){
    b.addEventListener("click",function(){ chosenCad=b.dataset.v; sheet.querySelectorAll("#s-cad .cadchip").forEach(function(x){x.classList.remove("on");}); b.classList.add("on"); });
  });

  // toewijzing-chips (cloud)
  var chosenAssignee = d.assigned_to || null;
  if(showAssign){
    sheet.querySelectorAll("#s-assign .cadchip").forEach(function(b){
      b.addEventListener("click",function(){
        chosenAssignee = b.dataset.m || null;
        sheet.querySelectorAll("#s-assign .cadchip").forEach(function(x){ x.classList.remove("on"); x.style.background=""; x.style.borderColor=""; });
        b.classList.add("on");
        if(chosenAssignee){ var m=Cloud.memberById(chosenAssignee); if(m){ b.style.background=m.color; b.style.borderColor="transparent"; } }
      });
    });
  }

  // qty
  var qty=d.qty;
  if(!d.catalogOnly){
    sheet.querySelector(".s-qminus").addEventListener("click",function(){ qty=Math.max(1,qty-1); sheet.querySelector("#s-qty").textContent=qty; });
    sheet.querySelector(".s-qplus").addEventListener("click",function(){ qty+=1; sheet.querySelector("#s-qty").textContent=qty; });
    var del=sheet.querySelector("#s-del");
    if(del) del.addEventListener("click",function(){ if(sheetCtx.type==="list") removeFromList(sheetCtx.id); closeSheet(); });
  }

  sheet.querySelector("#s-save").addEventListener("click",function(){
    var price = state.settings.showPrices ? parsePrice((sheet.querySelector("#s-price")||{}).value) : null;
    var note = (sheet.querySelector("#s-note")||{}).value || "";
    saveSheet(chosenCat, chosenCad, qty, price, note, d.catalogOnly, chosenAssignee);
  });

  openSheetUI();
}

function cadChip(v,label,sel){ return '<button class="cadchip'+(sel===v?" on":"")+'" data-v="'+v+'">'+label+'</button>'; }

function saveSheet(cat, cad, qty, price, note, catalogOnly, assignee){
  var key = sheetCtx.key;
  // categorie + cadans naar (lokale) catalog — cadans blijft persoonlijk
  var e = state.catalog[key];
  if(!e){ e = touchCatalog(sheetCtx.type==="list" ? (state.list.find(function(i){return i.id===sheetCtx.id;})||{}).name : key, price); e.timesAdded=Math.max(0,(e.timesAdded||1)-1); }
  if(e){
    e.category = cat;
    if(cad==="auto"){ e.cadenceMode="auto"; e.manualIntervalDays=null; }
    else if(cad==="off"){ e.cadenceMode="off"; e.manualIntervalDays=null; }
    else { e.cadenceMode="manual"; e.manualIntervalDays=parseInt(cad.slice(1),10); }
    if(price!=null) e.defaultPrice=price;
  }
  save();
  if(Cloud.active && !catalogOnly && sheetCtx.type==="list"){
    Cloud.setFields(sheetCtx.id, { category:cat, qty:qty, price:(state.settings.showPrices?price:null), note:note, assigned_to:(assignee||null) });
    closeSheet(); renderVaste(); toast("Opgeslagen"); return;
  }
  if(!catalogOnly && sheetCtx.type==="list"){
    var it=state.list.find(function(i){return i.id===sheetCtx.id;});
    if(it){ it.category=cat; it.qty=qty; it.price=(state.settings.showPrices?price:it.price); it.note=note; }
  }
  closeSheet();
  renderLijst(); renderDueBanner(); renderVaste();
  toast("Opgeslagen");
}

function openSheetUI(){ $("#scrim").classList.add("show"); $("#sheet").classList.add("show"); }
function closeSheet(){ $("#scrim").classList.remove("show"); $("#sheet").classList.remove("show"); sheetCtx=null; }
$("#scrim").addEventListener("click",closeSheet);

/* ============================================================
   SWIPE-TO-DELETE
   ============================================================ */
function attachSwipe(card,onDelete){
  var startX=0,startY=0,curX=0,dragging=false,decided=false,horiz=false;
  var THRESH=78, MAX=92;
  card.addEventListener("touchstart",function(e){
    startX=e.touches[0].clientX; startY=e.touches[0].clientY; curX=0; dragging=true; decided=false; horiz=false;
    card.style.transition="none"; card._suppressClick=false;
  },{passive:true});
  card.addEventListener("touchmove",function(e){
    if(!dragging) return;
    var dx=e.touches[0].clientX-startX, dy=e.touches[0].clientY-startY;
    if(!decided){ if(Math.abs(dx)>8||Math.abs(dy)>8){ decided=true; horiz=Math.abs(dx)>Math.abs(dy); } }
    if(horiz){ e.preventDefault(); curX=Math.min(0,Math.max(-MAX,dx)); card.style.transform="translateX("+curX+"px)"; if(curX<-6) card._suppressClick=true; }
  },{passive:false});
  card.addEventListener("touchend",function(){
    if(!dragging) return; dragging=false; card.style.transition="";
    if(curX<=-THRESH){ card.style.transform="translateX(-100%)"; vibrate(10); setTimeout(onDelete,180); }
    else{ card.style.transform="translateX(0)"; setTimeout(function(){ card._suppressClick=false; },60); }
  });
}

/* ============================================================
   ADD-FIELD + AUTOCOMPLETE
   ============================================================ */
function doAdd(){
  var name=$("#add-name").value;
  if(addToList(name,null)){
    $("#add-name").value="";
    hideAC(); $("#add-name").focus();
  }
}
function buildAC(q){
  var nq=norm(q);
  if(!nq){ hideAC(); return; }
  var seen={}, results=[];
  // catalog eerst (eigen historie), gerangschikt
  Object.keys(state.catalog).map(function(k){ return state.catalog[k]; })
    .filter(function(e){ return norm(e.name).indexOf(nq)!==-1; })
    .sort(function(a,b){ return (b.timesAdded||0)-(a.timesAdded||0); })
    .forEach(function(e){ var k=norm(e.name); if(!seen[k]){ seen[k]=1; results.push({name:e.name,cat:e.category,own:true}); } });
  // dan COMMON
  COMMON.filter(function(n){ return norm(n).indexOf(nq)!==-1; })
    .forEach(function(n){ var k=norm(n); if(!seen[k]){ seen[k]=1; results.push({name:n,cat:classify(n),own:false}); } });

  results=results.slice(0,6);
  var list=$("#ac-list");
  if(!results.length){ hideAC(); return; }
  list.innerHTML="";
  results.forEach(function(r){
    var c=CAT_BY_ID[r.cat]||CAT_BY_ID["overig"];
    var row=el("div","ac-item",'<span class="ac-emoji">'+c.glyph+'</span><span class="ac-name">'+escapeHtml(r.name)+'</span><span class="ac-add">+</span>');
    row.addEventListener("click",function(){
      addToList(r.name, null);
      $("#add-name").value=""; hideAC(); $("#add-name").focus();
    });
    list.appendChild(row);
  });
  list.classList.add("show");
}
function hideAC(){ $("#ac-list").classList.remove("show"); $("#ac-list").innerHTML=""; }

/* ============================================================
   TABS + SCROLL
   ============================================================ */
var activeTab="lijst";
var TAB_META={ lijst:{title:"Boodschappen"}, vaste:{title:"Vaste"}, meer:{title:"Instellingen"} };
var COG_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
var CLOSE_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

function switchTab(tab){
  activeTab=tab;
  document.querySelectorAll(".tab").forEach(function(b){ b.classList.toggle("active",b.dataset.tab===tab); });
  $("#view-lijst").classList.toggle("active",tab==="lijst");
  $("#view-vaste").classList.toggle("active",tab==="vaste");
  $("#view-meer").classList.toggle("active",tab==="meer");
  var m=TAB_META[tab];
  $("#title").textContent=m.title; $("#ctitle").textContent=m.title;
  var gear=$("#gear-btn");
  if(gear){ gear.innerHTML=(tab==="meer")?CLOSE_SVG:COG_SVG; gear.setAttribute("aria-label",tab==="meer"?"Sluiten":"Instellingen"); }
  $("#main").scrollTop=0; $("#topbar").classList.remove("scrolled");
  hideAC();
  if(tab==="vaste") renderVaste();
  if(tab==="meer") renderMeer();
  if(tab==="lijst"){ renderLijst(); renderDueBanner(); applyListHeader(); }
  if(tab==="vaste"){ var n=getRecurring().length; $("#subhead").textContent=n?(n+" "+(n===1?"vast product":"vaste producten")):""; }
  if(tab==="meer"){ $("#subhead").textContent=""; }
  renderListSwitch(); renderMembersRow();
  if(typeof renderShortcutsRow==="function") renderShortcutsRow();
  updateTotals();
}

/* ============================================================
   THEMA
   ============================================================ */
var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function effectiveTheme(){
  var t=state.settings.theme;
  if(t==="auto") return (mq && mq.matches)?"dark":"light";
  return t;
}
function applyTheme(){
  var eff=effectiveTheme();
  document.documentElement.setAttribute("data-theme",eff);
  var meta=document.querySelector('meta[name="theme-color"]:not([media])');
  var color=eff==="dark"?"#141410":"#F6F4EF";
  // forceer een enkele actuele theme-color
  var m=document.querySelector('meta[name="theme-color"][data-active]');
  if(!m){ m=document.createElement("meta"); m.name="theme-color"; m.setAttribute("data-active","1"); document.head.appendChild(m); }
  m.content=color;
}
if(mq){ try{ mq.addEventListener("change",function(){ if(state.settings.theme==="auto") applyTheme(); }); }catch(e){ mq.addListener(function(){ if(state.settings.theme==="auto") applyTheme(); }); } }

function applyPriceVisibility(){
  var show=state.settings.showPrices;
  var pw=$("#add-pw"); if(pw) pw.style.display=show?"":"none";
  updateTotals();
}

/* ============================================================
   HELPERS
   ============================================================ */
function emptyState(icon,h,p){
  var icons={
    bag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    repeat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>'
  };
  var e=el("div","empty");
  e.innerHTML='<div class="ico">'+(icons[icon]||icons.bag)+'</div><h2>'+h+'</h2><p>'+p+'</p>';
  return e;
}
function escapeHtml(s){ return (s||"").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
function escapeAttr(s){ return escapeHtml(s).replace(/'/g,"&#39;"); }

function maybeIntro(){
  if(!state || !state.settings || state.settings.seenIntro) return;
  if(state.list.length>0 || Object.keys(state.catalog).length>0){ state.settings.seenIntro=true; save(); return; }
  var sh=$("#sheet"); if(!sh) return;
  sh.innerHTML='<div class="grip"></div><h3>Welkom bij Mandje</h3>'+
    '<div class="intro-pt"><span class="ip-em">📝</span><div><b>Typ wat je nodig hebt.</b> Producten sorteren zichzelf in het juiste schap.</div></div>'+
    '<div class="intro-pt"><span class="ip-em">🔁</span><div><b>Vaste</b> leert wat je vaak koopt en tipt je wanneer iets bijna op is.</div></div>'+
    '<div class="intro-pt"><span class="ip-em">👥</span><div><b>Samen sturen?</b> Op je Lijst-tab kun je iemand toevoegen of iemand naar jou laten sturen — beide met 1 tap.</div></div>'+
    '<div class="sheet-actions"><button class="save" id="intro-go">Aan de slag</button></div>';
  $("#scrim").classList.add("show"); sh.classList.add("show");
  var go=$("#intro-go"); if(go) go.addEventListener("click",function(){ state.settings.seenIntro=true; save(); closeSheet(); });
}

/* ============================================================
   INIT
   ============================================================ */
function init(){
  load();
  applyTheme();
  applyPriceVisibility();
  if(typeof Cloud!=="undefined" && Cloud.cfg && Cloud.cfg()){ Cloud.init(); }

  $("#add-btn").addEventListener("click",doAdd);
  $("#add-name").addEventListener("keydown",function(e){ if(e.key==="Enter") doAdd(); });
  $("#add-name").addEventListener("input",function(){ buildAC(this.value); });
  $("#add-name").addEventListener("blur",function(){ setTimeout(hideAC,180); });
  var gb=$("#gear-btn"); if(gb) gb.addEventListener("click",function(){ switchTab(activeTab==="meer"?"lijst":"meer"); });

  // Keyboard-avoidance via visualViewport (iOS PWA)
  if(window.visualViewport){
    var onVP=function(){
      var vv=window.visualViewport;
      var app=document.getElementById("app");
      if(app){ app.style.height=vv.height+"px"; app.style.transform="translateY("+(vv.offsetTop||0)+"px)"; }
    };
    window.visualViewport.addEventListener("resize",onVP,{passive:true});
    window.visualViewport.addEventListener("scroll",onVP,{passive:true});
  }

  $("#t-finish").addEventListener("click",finishShopping);

  document.querySelectorAll(".tab").forEach(function(b){ b.addEventListener("click",function(){ switchTab(b.dataset.tab); }); });

  $("#main").addEventListener("scroll",function(){
    var s=this.scrollTop;
    $("#topbar").classList.toggle("scrolled", s>26);
    var aw=document.getElementById("addwrap");
    if(aw) aw.classList.toggle("stuck", s>6);
  },{passive:true});

  document.addEventListener("dblclick",function(e){ e.preventDefault(); },{passive:false});

  renderLijst(); renderDueBanner();
  switchTab("lijst");
  maybeIntro();
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
else init();

})();
