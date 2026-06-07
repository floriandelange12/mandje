"use strict";
(function(){

/* ============================================================
   CATEGORIEËN + classificatie (NL-schappen)
   ============================================================ */
var CATS = [
  {id:"groente-fruit",   label:"Groente & fruit",       glyph:"🥬"},
  {id:"brood-banket",    label:"Brood & banket",        glyph:"🥖"},
  {id:"zuivel-eieren",   label:"Zuivel & eieren",       glyph:"🥛"},
  {id:"kaas-vleeswaren", label:"Kaas & vleeswaren",     glyph:"🧀"},
  {id:"vlees-vis",       label:"Vlees & vis",           glyph:"🍗"},
  {id:"diepvries",       label:"Diepvries",             glyph:"🧊"},
  {id:"ontbijt-beleg",   label:"Ontbijt & beleg",       glyph:"🍯"},
  {id:"houdbaar",        label:"Houdbaar",              glyph:"🥫"},
  {id:"snoep-snacks",    label:"Snoep & snacks",        glyph:"🍫"},
  {id:"dranken",         label:"Dranken",               glyph:"🧃"},
  {id:"huishouden",      label:"Huishouden",            glyph:"🧽"},
  {id:"verzorging",      label:"Verzorging",            glyph:"🧴"},
  {id:"baby-kind",       label:"Baby & kind",           glyph:"👶"},
  {id:"huisdier",        label:"Huisdier",              glyph:"🐾"},
  {id:"klussen",         label:"Klussen & gereedschap", glyph:"🔧"},
  {id:"tuin-planten",    label:"Tuin & planten",        glyph:"🌱"},
  {id:"apotheek",        label:"Apotheek",              glyph:"💊"},
  {id:"kantoor-school",  label:"Kantoor & school",      glyph:"📎"},
  {id:"kleding-textiel", label:"Kleding & textiel",     glyph:"🧦"},
  {id:"overig",          label:"Overig",                glyph:"🛒"}
];
var CAT_BY_ID = {}; CATS.forEach(function(c){ CAT_BY_ID[c.id]=c; });

/* Emoji-set voor de picker bij eigen schap / emoji-wijzigen.
   Niet uitputtend — een handige selectie die past bij een boodschappenlijst. */
var EMOJI_SET = ["🥬","🥖","🥛","🧀","🍗","🧊","🍯","🥫","🍫","🧃","🧽","🧴","👶","🐾","🔧","🌱","💊","📎","🧦","🛒","🎂","🍕","🥗","🌿","☕","🍷","💄","💡","📱","🍔","🍣","🎮","📚","🎨","🧸","🏠","🚗","✏️","🪴","🛁","🧻","🛠️","🔩","🌻","🥃","🍺","🍩","🍪","🍦","🍰","🎁","🎈","🎄","🕯️","🧼","🚰","🪞","🪥","🧯","🪟","🧹","🪒","🩹","💊","👕","👖","🩳","🧤","🧣","🧢","👟","👞","👜","🎒","🏀","⚽","🎾","🏊","🚲","🪴","🌾","🐶","🐱","🐰","🐭","🐦","🐠","🦴","🍙","🍱","🍝","🥡","☘️","🌴","🍂"];

/* Verbeterde lookup die custom categorieën + emoji-overrides meeneemt.
   Sneller dan inline checks elke plek. Wordt gebruikt door render-paden. */
function getCatById(id){
  return CAT_BY_ID[id] || CAT_BY_ID["overig"];
}
function getAllCats(){
  if(state && state.settings && Array.isArray(state.settings.customCategories) && state.settings.customCategories.length){
    return CATS.concat(state.settings.customCategories);
  }
  return CATS.slice();
}
function rebuildCatIndex(){
  CAT_BY_ID = {};
  CATS.forEach(function(c){ CAT_BY_ID[c.id]=c; });
  if(state && state.settings){
    (state.settings.customCategories||[]).forEach(function(c){
      CAT_BY_ID[c.id] = { id:c.id, label:c.label, glyph:c.glyph, isCustom:true };
    });
    var em = state.settings.customCatEmoji || {};
    Object.keys(em).forEach(function(id){
      if(CAT_BY_ID[id]){
        CAT_BY_ID[id] = Object.assign({}, CAT_BY_ID[id], {glyph: em[id]});
      }
    });
  }
}

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
  "huishouden":["wc papier","toiletpapier","wc-papier","keukenrol","vuilniszak","afwasmiddel","afwas","vaatwastablet","vaatwas","wasmiddel","wasverzachter","allesreiniger","schoonmaak","spons","schuurspons","vochtige doekjes","aluminiumfolie","vershoudfolie","bakpapier","kaars","theelicht","zakdoek","tissue","afwasborstel","vaatwasmiddel"],
  "verzorging":["shampoo","conditioner","zeep","handzeep","douchegel","tandpasta","tandenborstel","floss","deodorant","deo","scheermes","scheerschuim","bodylotion","handcreme","creme","maandverband","tampon","watten","wattenstaafje","mondwater","zonnebrand","make-up","makeup","mascara","foundation","lippenstift","oogschaduw","nagellak","parfum","eau de toilette"],
  "baby-kind":["luier","luiers","babyluier","trainerbroek","babyvoeding","flesvoeding","melkpoeder","fopspeen","babyflesje","babydoekjes","billendoekjes","babybillendoekjes","babyzalf","sudocrem","babyzeep","babyshampoo","babyolie","baby-olie","knijpfruit","knijpyoghurt","babyhapje","babyhap","slabbetje","spuugdoekje","spuugdoek","kindertandpasta","kindertandborstel","kinderzeep","kindershampoo","babykleding","rompertje","romper","babymutsje","speen","spenen","puzzel","kleurboek","kleurpotloden voor kinderen"],
  "huisdier":["hondenvoer","hondenbrokken","hondensnacks","kauwbot","kauwbotje","hondensnoep","kattenvoer","kattenbrokken","kattenpaté","kattenpate","kattennat","kattenbakvulling","kattengrit","vogelvoer","muizenvoer","konijnenvoer","caviavoer","hamstervoer","vissenvoer","aquariumvoer","dierenvoer","dierenshampoo","dierenkam","kattenkam","vlooienband","wormenkuur","tekenspray","kattenbakje","hondenriem","halsband","hondenpoepzakje","poepzakje","poepzakjes","kattenspeeltje","hondenspeeltje","krabpaal"],
  "klussen":["schroef","schroeven","spijker","spijkers","moeren","bouten","tieraps","tie-rap","schroefje","secondelijm","montagelijm","houtlijm","behangerslijm","siliconenkit","silicone","alleslijm","plakband","duct tape","ducttape","masking tape","schilderstape","isolatietape","batterij","batterijen","aa batterij","aaa batterij","aa-batterij","9v batterij","knoopcel","knoopbatterij","gloeilamp","ledlamp","spaarlamp","fitting","stekker","verlengsnoer","stekkerdoos","schuurpapier","staalwol","kwast","verfrol","verfemmer","verf","grondverf","beits","schroevendraaier","hamer","tang","boormachine","accuboor","sleutelset","steeksleutel","ijzerdraad","nylondraad","houten plank","latje","mdf","piepschuim","isolatie","tochtstrip","stofzuigerzak","stofzuigerfilter"],
  "tuin-planten":["potgrond","tuinaarde","compost","plantengrond","substraat","zaden","zaadjes","bloembol","bloembollen","stekken","plantenvoeding","plantenmest","kunstmest","koemest","groeikorrels","snijbloemen","boeket","kamerplant","hangplant","cactus","vetplant","orchidee","perkplant","perkplantjes","balkonplant","viooltjes","geranium","plantenpot","bloempot","onderschotel","hangmand","tuinslang","gieter","sproeier","graszaad","grassemen","gazonmest","tuinhandschoenen","snoeischaar","schoffel","spade","tuinbezem","plantensteun","plantenstok","bamboestok","plantentouw","vogelhuisje","vogelzaad","strooizout","strooizand"],
  "apotheek":["paracetamol","ibuprofen","aspirine","brufen","advil","neusspray","neusdruppels","oogdruppels","keelpastilles","keelpastille","hoestdrank","hoeststroop","slijmoplosser","multivitamine","vitamine c","vitamine d","vitamine b","ijzertabletten","magnesium","calcium","zink","vitaminen","vitamine","ehbo","ehbo-doos","jodium","betadine","desinfecterend","kompres","steriel kompres","pleister","pleisters","blarenpleister","wondpleister","verband","zwachtel","koortsthermometer","thermometer","bloeddrukmeter","antihistaminicum","loratadine","cetirizine","neusspoeling","zoutoplossing","ibuprofengel","spierzalf","arnica","tijgerbalsem","biotine"],
  "kantoor-school":["balpen","bic","viltstift","stift","markeerstift","fineliner","potlood","kleurpotlood","kleurpotloden","puntenslijper","liniaal","passer","geodriehoek","gradenboog","schrift","schriftje","ringband","ordner","tabbladen","insteekhoes","post-it","plakbriefje","plakbriefjes","memoblok","notitieblok","notitieboekje","paperclip","paperclips","nietmachine","nietjes","perforator","schaar","schaartje","prittstift","lijmstift","lijmstaaf","etiketten","etiket","printerinkt","cartridge","tonercartridge","printerpapier","kopieerpapier","a4-papier","papier a4","a4 papier","rekenmachine","calculator","agenda","planner","prikbord","punaise","punaises","rugzak","schooltas","etui","pennenbakje","pen","pennen","stickers"],
  "kleding-textiel":["sok","sokken","sportsok","damessok","ondergoed","onderbroek","beha","slipje","string","boxer","panty","panty's","kous","kousen","t-shirt","tshirt","hemd","blouse","topje","spijkerbroek","joggingbroek","jeans","short","winterjas","regenjas","trui","sweater","hoodie","schoenen","laarzen","sneakers","sandalen","slippers","riem","handschoen","handschoenen","muts","sjaal","das","zwemkleding","zwembroek","badpak","bikini","theedoek","theedoeken","vaatdoek","vaatdoeken","dweil","dweilen","sponsdoek","washandje","washand","washandjes","badhanddoek","gastendoekje","handdoek","handdoeken","hoeslaken","laken","kussensloop","sloop","dekbedovertrek","overtrek","plaid"]
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
var COMMON = ["Melk","Brood","Eieren","Kaas","Boter","Yoghurt","Kwark","Karnemelk","Slagroom","Kipfilet","Gehakt","Zalm","Tonijn","Ham","Salami","Bananen","Appels","Sinaasappels","Druiven","Citroen","Tomaten","Komkommer","Sla","Paprika","Avocado","Aardappels","Uien","Knoflook","Wortels","Broccoli","Spinazie","Champignons","Courgette","Pasta","Spaghetti","Rijst","Couscous","Bloem","Suiker","Zout","Olijfolie","Azijn","Pastasaus","Tomatenblokjes","Kokosmelk","Kidneybonen","Linzen","Soep","Pindakaas","Hagelslag","Jam","Honing","Muesli","Havermout","Cornflakes","Koffie","Thee","Water","Spa","Cola","Sinaasappelsap","Bier","Wijn","Chips","Chocolade","Stroopwafels","Crackers","Beschuit","Croissants","Stokbrood","Mozzarella","Feta","Pizza","IJs","Mayonaise","Ketchup","Mosterd","Wc-papier","Keukenrol","Vuilniszakken","Afwasmiddel","Wasmiddel","Allesreiniger","Shampoo","Tandpasta","Deodorant","Luiers","Babydoekjes","Hondenvoer","Kattenvoer","Kattenbakvulling","Batterijen","Gloeilampen","Plakband","Schroeven","Potgrond","Snijbloemen","Paracetamol","Ibuprofen","Pleisters","Multivitamine","Pen","Schrift","Post-its","Printerpapier","Sokken","Theedoeken","Washandjes","Handdoek","Hoeslaken"];

/* ============================================================
   STORE — localStorage + migratie
   ============================================================ */
var NS = "mandje.v2";
var DEFAULTS = {
  version:2,
  settings:{ theme:"auto", showPrices:false, seenIntro:false, categoryOrder:CATS.map(function(c){return c.id;}), minPurchases:3, cvThreshold:0.6, dueWindowDays:1, customCategories:[], customCatEmoji:{}, collapsedCats:{} },
  list:[],
  catalog:{},
  coBuy:{}
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
    if(!state.coBuy || typeof state.coBuy!=="object") state.coBuy={};
    if(!Array.isArray(state.settings.categoryOrder)) state.settings.categoryOrder = DEFAULTS.settings.categoryOrder.slice();
    if(!Array.isArray(state.settings.customCategories)) state.settings.customCategories = [];
    if(!state.settings.customCatEmoji || typeof state.settings.customCatEmoji!=="object") state.settings.customCatEmoji = {};
    CATS.forEach(function(c){ if(state.settings.categoryOrder.indexOf(c.id)===-1) state.settings.categoryOrder.push(c.id); });
    state.settings.customCategories.forEach(function(c){ if(state.settings.categoryOrder.indexOf(c.id)===-1) state.settings.categoryOrder.push(c.id); });
    rebuildCatIndex();
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
  rebuildCatIndex();
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

/* Co-purchase: alle paren in dezelfde finish-sessie krijgen +1 count.
   Gebruikt om "Vaak samen: + brood"-suggesties te tonen. */
function recordCoBuy(names){
  if(!Array.isArray(names) || names.length < 2) return;
  state.coBuy = state.coBuy || {};
  var keys = names.map(norm).filter(Boolean);
  // unique
  var seen={}, uniq=[];
  keys.forEach(function(k){ if(!seen[k]){ seen[k]=1; uniq.push(k); } });
  for(var i=0; i<uniq.length; i++){
    for(var j=0; j<uniq.length; j++){
      if(i===j) continue;
      state.coBuy[uniq[i]] = state.coBuy[uniq[i]] || {};
      state.coBuy[uniq[i]][uniq[j]] = (state.coBuy[uniq[i]][uniq[j]]||0) + 1;
    }
  }
}
function getCoSuggestions(key, limit){
  var co = (state.coBuy||{})[key];
  if(!co) return [];
  var onListKeys = state.list.filter(function(i){return !i.done;}).map(function(i){return norm(i.name);});
  var out = [];
  Object.keys(co).forEach(function(k){
    if(co[k] < 3) return;
    if(onListKeys.indexOf(k) !== -1) return;
    var cat = state.catalog[k]; if(!cat) return;
    out.push({key:k, name:cat.name, count:co[k]});
  });
  out.sort(function(a,b){ return b.count - a.count; });
  return out.slice(0, limit||2);
}
var _coSuggestT;
function renderCoSuggest(triggerKey){
  var wrap = $("#co-suggest"); if(!wrap) return;
  if(activeTab!=="lijst" || !triggerKey){ wrap.classList.add("hide"); wrap.innerHTML=""; return; }
  var sugg = getCoSuggestions(triggerKey, 2);
  if(!sugg.length){ wrap.classList.add("hide"); wrap.innerHTML=""; return; }
  var html = '<span class="cs-lbl">Vaak samen:</span>';
  sugg.forEach(function(s){
    html += '<button class="cs-pill" data-name="'+escapeAttr(s.name)+'" type="button"><span class="plus">+</span>'+escapeHtml(s.name)+'</button>';
  });
  html += '<button class="cs-close" aria-label="Verberg" type="button">✕</button>';
  wrap.innerHTML = html;
  wrap.classList.remove("hide");
  wrap.querySelectorAll(".cs-pill").forEach(function(b){
    b.addEventListener("click", function(){
      addToList(b.dataset.name, null);
      wrap.classList.add("hide");
    });
  });
  wrap.querySelector(".cs-close").addEventListener("click", function(){ wrap.classList.add("hide"); });
  clearTimeout(_coSuggestT);
  _coSuggestT = setTimeout(function(){ wrap.classList.add("hide"); }, 8000);
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

/* Auto-add: items met autoAdd=true die NU due zijn, max 1× per dag,
   nooit dubbel toevoegen wanneer al op de lijst. Lokaal alleen. */
function runAutoAddDueItems(){
  if(typeof Cloud!=="undefined" && Cloud.active) return;
  var due = getDueItems(); if(!due.length) return;
  var addedNames = [];
  var nowMs = (typeof Date !== "undefined" && Date.now) ? Date.now() : 0;
  due.forEach(function(d){
    var e = d.e; if(!e.autoAdd) return;
    var k = norm(e.name);
    if(state.list.some(function(i){ return !i.done && norm(i.name)===k; })) return;
    var last = e.lastAutoAddAt ? new Date(e.lastAutoAddAt).getTime() : 0;
    if(nowMs - last < 86400 * 1000) return;
    state.list.unshift({
      id:uid(), name:e.name, category:e.category||"overig", qty:1,
      price:(state.settings.showPrices?e.defaultPrice:null),
      note:"", done:false, addedAt:nowISO()
    });
    e.lastAutoAddAt = nowISO();
    addedNames.push(e.name);
  });
  if(addedNames.length){
    save(); renderLijst(); renderDueBanner();
    var msg = addedNames.length===1
      ? addedNames[0]+" automatisch toegevoegd"
      : addedNames.length+" vaste boodschappen automatisch toegevoegd";
    toast(msg);
  }
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

/* "melk", "melk 2", "melk x3", "melk ×4" → {name, qty}.
   qty alleen overgenomen als ondubbelzinnig (x/×/* prefix of >=2). */
function parseQtyFromInput(s){
  var raw = (s||"").trim();
  if(!raw) return {name:"", qty:1};
  var m = raw.match(/^(.+?)\s*[x×*]\s*(\d{1,3})$/i);
  if(m){
    var q = parseInt(m[2],10);
    if(q >= 1) return { name: m[1].trim(), qty: q };
  }
  m = raw.match(/^(.+?)\s+(\d{1,3})$/);
  if(m){
    var q2 = parseInt(m[2],10);
    if(q2 >= 2) return { name: m[1].trim(), qty: q2 };
  }
  return { name: raw, qty: 1 };
}
function $(s){ return document.querySelector(s); }
function el(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
function vibrate(ms){ if(navigator.vibrate){ try{navigator.vibrate(ms);}catch(e){} } }
/* Haptic-layers — kies semantisch ipv elke keer een getal kiezen.
   tap=micro (qty+/-), tick=hoofd-actie (afvinken/toevoegen), nudge=warning. */
function vibe(level){
  var map = { tap:6, tick:12, nudge:20 };
  vibrate(map[level] || 10);
}

var CHECK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="var(--on-green)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path pathLength="24" d="M20 6 9 17l-5-5"/></svg>';

/* ============================================================
   TOAST
   ============================================================ */
var toastT;
function toast(msg, opts){
  opts = opts || {};
  var t = $("#toast");
  t.className = "toast";
  t.innerHTML = "";
  var span = document.createElement("span");
  span.className = "toast-msg";
  span.textContent = msg;
  t.appendChild(span);
  var duration = opts.duration || 1500;
  // Pause-on-hover/touch zodat user 'm niet mist tijdens lezen
  var paused = false, remaining = duration, startedAt = 0;
  var hide = function(){ t.classList.remove("show"); };
  var schedule = function(ms){
    clearTimeout(toastT);
    startedAt = Date.now();
    toastT = setTimeout(hide, ms);
  };
  if(opts.action && typeof opts.onAction === "function"){
    t.classList.add("has-action");
    var btn = document.createElement("button");
    btn.className = "toast-action";
    btn.type = "button";
    btn.textContent = opts.action;
    btn.addEventListener("click", function(){
      try{ opts.onAction(); }catch(e){}
      hide(); clearTimeout(toastT);
    });
    t.appendChild(btn);
    // Pauze auto-hide bij hover/touch
    var pause = function(){
      if(paused) return;
      paused = true;
      var elapsed = Date.now() - startedAt;
      remaining = Math.max(800, remaining - elapsed);
      clearTimeout(toastT);
    };
    var resume = function(){
      if(!paused) return;
      paused = false;
      schedule(remaining);
    };
    t.addEventListener("mouseenter", pause);
    t.addEventListener("mouseleave", resume);
    t.addEventListener("touchstart", pause, {passive:true});
    t.addEventListener("touchend", resume);
  }
  t.classList.add("show");
  schedule(duration);
}
function undoToast(label, restoreFn){
  toast(label, { action:"Ongedaan", onAction:restoreFn, duration:10000 });
}

/* ============================================================
   LIJST — acties
   ============================================================ */
function addToList(name, price, opts){
  name=(name||"").trim(); if(!name) return false;
  opts=opts||{};
  var addQty = Math.max(1, opts.qty || 1);
  var silent = !!opts.silent;
  if(Cloud.active){
    Cloud.addItem(name, (state.settings.showPrices?price:null), addQty, {silent:silent});
    touchCatalog(name, price); save();
    return true;
  }
  var k=norm(name);
  var existing = state.list.find(function(i){ return !i.done && norm(i.name)===k; });
  if(existing){
    existing.qty += addQty;
    if(price!=null) existing.price=price;
    if(!silent) toast(name + " → " + existing.qty + "×");
  } else{
    var cat = (state.catalog[k] && state.catalog[k].category) || classify(name);
    var defPrice = price!=null ? price : (state.catalog[k] ? state.catalog[k].defaultPrice : null);
    state.list.unshift({ id:uid(), name:name, category:cat, qty:addQty, price:(state.settings.showPrices?defPrice:null), note:"", done:false, addedAt:nowISO() });
    if(!silent && addQty>1) toast(name + " ×" + addQty);
  }
  touchCatalog(name, price);
  save(); renderLijst(); renderDueBanner();
  if(!silent) renderCoSuggest(norm(name));
  return true;
}
function toggleDone(id){
  if(Cloud.active){ Cloud.toggle(id); vibe("tick"); return; }
  var it=state.list.find(function(i){return i.id===id;}); if(!it) return;
  var wasDone = it.done;
  it.done = !it.done;
  if(it.done) vibe("tick");
  save(); renderLijst();
  if(!wasDone && it.done){
    undoToast(it.name + " afgevinkt", function(){
      var i2 = state.list.find(function(x){return x.id===id;});
      if(i2){ i2.done = false; save(); renderLijst(); }
    });
  }
}
function setQty(id,delta){
  vibe("tap");
  if(Cloud.active){ Cloud.qty(id,delta); return; }
  var it=state.list.find(function(i){return i.id===id;}); if(!it) return;
  it.qty=Math.max(1,it.qty+delta); save(); renderLijst();
}
function removeFromList(id){
  if(Cloud.active){ Cloud.remove(id); return; }
  var idx = state.list.findIndex(function(i){return i.id===id;});
  if(idx === -1) return;
  var snap = Object.assign({}, state.list[idx]);
  state.list.splice(idx, 1); save(); renderLijst(); renderDueBanner();
  undoToast(snap.name + " verwijderd", function(){
    state.list.splice(Math.min(idx, state.list.length), 0, snap);
    save(); renderLijst(); renderDueBanner();
  });
}
function finishShopping(){
  if(Cloud.active){ Cloud.finish(); return; }
  var done=state.list.filter(function(i){return i.done;});
  if(!done.length) return;
  done.forEach(function(it){ recordPurchase(it.name, it.price); });
  recordCoBuy(done.map(function(it){return it.name;}));
  state.list=state.list.filter(function(i){return !i.done;});
  save(); renderLijst(); renderDueBanner(); renderVaste();
  toast(done.length+(done.length===1?" boodschap gekocht":" boodschappen gekocht"));
  vibe("nudge");
}

/* ============================================================
   RENDER — Lijst-tab
   ============================================================ */
function renderLijst(){
  var open = state.list.filter(function(i){return !i.done;});
  var done = state.list.filter(function(i){return i.done;});
  var openWrap=$("#open-list"); openWrap.innerHTML="";
  var doneWrap=$("#done-list"); doneWrap.innerHTML="";
  toggleSearchBar();
  // Bouw in DocumentFragment om reflows te minimaliseren bij grote lijsten
  var openFrag = document.createDocumentFragment();
  var doneFrag = document.createDocumentFragment();

  if(state.list.length===0){
    if(typeof Cloud!=="undefined" && Cloud.active){
      openFrag.appendChild(emptyState(
        "bag",
        "Je mandje is leeg",
        "Tik hieronder om iets toe te voegen — of deel de stuur-link zodat anderen items voor je droppen.",
        "Delen",
        function(){ if(typeof openShareSheet==="function") openShareSheet(Cloud.active); }
      ));
    } else {
      openFrag.appendChild(emptyState("bag","Je mandje is leeg","Typ hieronder wat je nodig hebt. Producten landen vanzelf in het juiste schap."));
    }
  } else {
    // groepeer open per categorie volgens categoryOrder
    var byCat={}; open.forEach(function(it){ (byCat[it.category]=byCat[it.category]||[]).push(it); });
    state.settings.categoryOrder.forEach(function(cid){
      var arr=byCat[cid]; if(!arr || !arr.length) return;
      var c=CAT_BY_ID[cid]||CAT_BY_ID["overig"];
      var collapsed = !!(state.settings.collapsedCats && state.settings.collapsedCats[cid]);
      var sec=el("div","section collapsible"+(collapsed?" collapsed":""));
      sec.innerHTML='<span class="cat-emoji emoji">'+c.glyph+'</span><span>'+c.label+'</span><span class="count">'+arr.length+'</span><svg class="sec-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
      openFrag.appendChild(sec);
      var ul=el("ul","list"+(collapsed?" collapsed":""));
      arr.forEach(function(it){ ul.appendChild(itemRow(it)); });
      openFrag.appendChild(ul);
      sec.addEventListener("click", function(){
        state.settings.collapsedCats = state.settings.collapsedCats || {};
        state.settings.collapsedCats[cid] = !state.settings.collapsedCats[cid];
        save();
        sec.classList.toggle("collapsed");
        ul.classList.toggle("collapsed");
      });
    });
    if(done.length){
      var s2=el("div","section");
      s2.innerHTML='<span>In mandje</span><span class="count">'+done.length+'</span>';
      doneFrag.appendChild(s2);
      var ul2=el("ul","list"); done.forEach(function(it){ ul2.appendChild(itemRow(it)); });
      doneFrag.appendChild(ul2);
    }
  }
  // Single append per wrap = minimum reflows
  openWrap.appendChild(openFrag);
  doneWrap.appendChild(doneFrag);
  updateTotals();
  updateSubhead();
}

function itemRow(it){
  var li=el("li","row"+(it.done?" done":""));
  // Slide-in als item < 600ms geleden toegevoegd
  var addedMs = it.addedAt ? new Date(it.addedAt).getTime() : 0;
  if(addedMs && (Date.now() - addedMs) < 600){
    li.classList.add("entering");
    setTimeout(function(){ li.classList.remove("entering"); }, 360);
  }
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
  var doneItems=state.list.filter(function(i){return i.done;});
  var done=doneItems.length;
  $("#t-total").textContent=euro(total);
  $("#t-cart").textContent=euro(cart)+" in mandje";
  $("#t-prog").style.width=(total>0?Math.round(cart/total*100):0)+"%";
  $("#t-finish").style.display=done?"inline-flex":"none";
  var hint=$("#t-hint"); if(hint) hint.style.display=(state.settings.showPrices && !hasPrices && state.list.length>0)?"block":"none";
  var progWrap=$("#t-prog-wrap"); if(progWrap) progWrap.style.display=hasPrices?"block":"none";
  var show = activeTab==="lijst" && state.list.length>0 && state.settings.showPrices;
  $("#totals").classList.toggle("hide", !show);
  $("#pad-lijst").className = "pad-bottom"+(show?" with-total":"");
  renderForgottenSuggest(doneItems);
}

/* "Wat ben je vergeten?" — toon co-buy-suggesties wanneer er items in 'in mandje'
   zijn. Subtiele chip-rij in de totals-bar. */
function renderForgottenSuggest(doneItems){
  var wrap = $("#t-forgot"); if(!wrap) return;
  if(!doneItems || !doneItems.length || activeTab!=="lijst"){ wrap.style.display="none"; wrap.innerHTML=""; return; }
  // Aggregeer co-suggesties van alle done-items
  var scores = {};
  var listKeys = state.list.filter(function(i){return !i.done;}).map(function(i){return norm(i.name);});
  var doneKeys = doneItems.map(function(i){return norm(i.name);});
  doneItems.forEach(function(it){
    var sugg = getCoSuggestions(norm(it.name), 5);
    sugg.forEach(function(s){
      // Skip items die al op de lijst of in mandje staan
      if(listKeys.indexOf(s.key)!==-1) return;
      if(doneKeys.indexOf(s.key)!==-1) return;
      scores[s.key] = (scores[s.key]||0) + s.count;
    });
  });
  var keys = Object.keys(scores);
  if(!keys.length){ wrap.style.display="none"; wrap.innerHTML=""; return; }
  keys.sort(function(a,b){ return scores[b]-scores[a]; });
  var top = keys.slice(0, 3);
  var html = '<span class="forgot-lbl">Vergeten?</span>';
  top.forEach(function(k){
    var cat = state.catalog[k]; if(!cat) return;
    html += '<button class="forgot-pill" data-name="'+escapeAttr(cat.name)+'" type="button"><span class="plus">+</span>'+escapeHtml(cat.name)+'</button>';
  });
  wrap.innerHTML = html;
  wrap.style.display = "flex";
  wrap.querySelectorAll(".forgot-pill").forEach(function(b){
    b.addEventListener("click", function(e){
      e.stopPropagation();
      addToList(b.dataset.name, null);
    });
  });
}

function updateSubhead(){
  if(activeTab!=="lijst") return;
  var open=state.list.filter(function(i){return !i.done;}).length;
  var done=state.list.filter(function(i){return i.done;}).length;
  var base = state.list.length===0 ? "Je mandje is leeg" : (open+" te halen · "+done+" in mandje");
  $("#subhead").textContent = base;
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
  if(due.length > 6){
    var more = el("button","chip",'<span>Toon alles ('+due.length+')</span><span class="plus">→</span>');
    more.style.background="transparent"; more.style.borderColor="var(--line)"; more.style.color="var(--ink-soft)";
    more.addEventListener("click", function(){ switchTab("vaste"); });
    chips.appendChild(more);
  }
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
  var autoBadge = r.e.autoAdd ? '<span class="vauto">Auto</span>' : '';
  div.innerHTML=
    '<div class="vemoji">'+c.glyph+'</div>'+
    '<div class="vmeta"><div class="vname"></div><div class="vcad">'+info+'</div></div>'+
    autoBadge+
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

  // Schap-volgorde + eigen schappen
  wrap.appendChild(el("div","section",'<span>Schap-volgorde</span><span class="count">'+state.settings.categoryOrder.length+'</span>'));
  wrap.appendChild(el("div","hint","Sleep om de volgorde te wijzigen waarin schappen op de Lijst-tab verschijnen. Lege schappen worden vanzelf verborgen."));
  var sortWrap = el("div","sort-list");
  var sortItems = [];
  state.settings.categoryOrder.forEach(function(cid){
    var c = CAT_BY_ID[cid]; if(!c) return;
    var isCustom = (state.settings.customCategories||[]).some(function(cc){return cc.id===cid;});
    sortItems.push({id:cid, label:c.label, glyph:c.glyph, isCustom:isCustom});
  });
  makeSortableList(sortWrap, sortItems, function(newOrder){
    state.settings.categoryOrder = newOrder; save();
    if(activeTab==="lijst") renderLijst();
  });
  wrap.appendChild(sortWrap);

  var addCat = el("button","mbtn","+ Eigen schap toevoegen");
  addCat.style.marginTop = "10px";
  addCat.addEventListener("click", openAddCategorySheet);
  wrap.appendChild(addCat);

  // Back-up
  wrap.appendChild(el("div","section",'<span>Back-up</span>'));
  wrap.appendChild(el("div","hint","Gedeelde lijsten staan veilig online. Je persoonlijke lijst staat op dit toestel — exporteer 'm af en toe als back-up, of zet 'm terug op een nieuw toestel."));
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
    else if(d.a.count){
      var togo = state.settings.minPurchases - d.a.count;
      if(togo <= 1) statusLine = "Bijna! Nog 1× kopen en ik herken je ritme";
      else statusLine = "Nog "+togo+"× kopen, dan leer ik je ritme";
    }
  }

  var html='<div class="grip"></div><h3></h3>';

  if(!d.catalogOnly){
    html+='<div class="frow"><div class="fl">Aantal</div><div class="qty" style="background:var(--surface-2);border:1px solid var(--line)"><button class="s-qminus">–</button><span id="s-qty">'+d.qty+'</span><button class="s-qplus">+</button></div></div>';
    if(state.settings.showPrices){
      html+='<div class="frow"><div class="fl">Prijs</div><input class="num" id="s-price" inputmode="decimal" placeholder="0,00" value="'+(d.price!=null?String(d.price).replace(".",","):"")+'"></div>';
      // "vorige keer"-hint — geleerd uit catalog. Tap = overnemen.
      var _hintKey = (sheetCtx && sheetCtx.key) || norm(d.name||"");
      var lastPriceCat = (state.catalog[_hintKey] && state.catalog[_hintKey].defaultPrice);
      if(lastPriceCat != null && (d.price == null || Number(d.price) !== Number(lastPriceCat))){
        html += '<div class="price-hint" id="s-price-hint" role="button">Vorige keer <b>'+euro(lastPriceCat)+'</b> — tik om te gebruiken</div>';
      }
    }
    html+='<div class="frow"><div class="fl">Notitie</div><input class="txt" id="s-note" placeholder="bijv. 1 liter, merk…" value="'+escapeAttr(d.note||"")+'"></div>';
  }

  var showAssign = (!d.catalogOnly && Cloud.active && Cloud.members.length>0);
  if(showAssign){
    html+='<div class="sheet-label"><span class="lbl-cap">Wie haalt het?</span></div>';
    html+='<div class="cadrow" id="s-assign"><button class="cadchip'+(!d.assigned_to?" on":"")+'" data-m="">Niemand</button>';
    Cloud.members.forEach(function(m){
      html+='<button class="cadchip'+(d.assigned_to===m.id?" on":"")+'" data-m="'+m.id+'" style="'+(d.assigned_to===m.id?'background:'+m.color+';border-color:transparent':'')+'">'+escapeHtml(m.display_name)+'</button>';
    });
    html+='</div>';
  }

  html+='<div class="sheet-label"><span class="lbl-cap">Schap</span><span class="lbl-hint">Lang indrukken voor ander pictogram</span></div>';
  html+='<div class="catscroll" id="s-cats"></div>';

  html+='<div class="sheet-label"><span class="lbl-cap">Herinner me — vaste boodschap</span></div>';
  if(statusLine) html+='<div class="hint" style="margin:0 6px 10px">'+statusLine+'</div>';
  html+='<div class="cadrow" id="s-cad">'+
        cadChip("auto","Automatisch",selCad)+
        cadChip("m7","Wekelijks",selCad)+
        cadChip("m14","2-wekelijks",selCad)+
        cadChip("m30","Maandelijks",selCad)+
        cadChip("off","Uit",selCad)+
        '</div>';

  // Auto-add toggle (alleen tonen als er een ritme bekend of in te stellen is)
  var _autoAdd = !!(state.catalog[(sheetCtx&&sheetCtx.key)||""] && state.catalog[(sheetCtx&&sheetCtx.key)||""].autoAdd);
  html+='<div class="auto-add-toggle">'+
    '<div class="aat-label">Automatisch toevoegen<small>Verschijnt vanzelf op je lijst zodra het ritme zegt "bijna op".</small></div>'+
    '<button class="switch'+(_autoAdd?" on":"")+'" id="s-auto-toggle" type="button" aria-label="Auto-toevoegen wisselen"></button>'+
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
  var renderCatChips = function(){
    catWrap.innerHTML="";
    getAllCats().forEach(function(c){
      var b=el("button","catchip"+(c.id===chosenCat?" on":""),'<span class="emoji">'+c.glyph+'</span><span>'+escapeHtml(c.label)+'</span>');
      b.addEventListener("click",function(){ chosenCat=c.id; catWrap.querySelectorAll(".catchip").forEach(function(x){x.classList.remove("on");}); b.classList.add("on"); });
      // Long-press: pictogram wijzigen via emoji-picker (in 2e sheet, blijft buildSheet open)
      attachLongPress(b, function(){
        openEmojiPickerForCat(c.id, function(){ renderCatChips(); });
      });
      catWrap.appendChild(b);
    });
  };
  renderCatChips();

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

  var phEl = sheet.querySelector("#s-price-hint");
  if(phEl){
    phEl.addEventListener("click", function(){
      var inp = sheet.querySelector("#s-price");
      if(inp){ inp.value = String(lastPriceCat).replace(".",","); inp.focus(); }
      phEl.style.display = "none";
    });
  }

  var autoToggle = sheet.querySelector("#s-auto-toggle");
  if(autoToggle){
    autoToggle.addEventListener("click", function(){ autoToggle.classList.toggle("on"); });
  }

  sheet.querySelector("#s-save").addEventListener("click",function(){
    var price = state.settings.showPrices ? parsePrice((sheet.querySelector("#s-price")||{}).value) : null;
    var note = (sheet.querySelector("#s-note")||{}).value || "";
    var autoAdd = !!(autoToggle && autoToggle.classList.contains("on"));
    saveSheet(chosenCat, chosenCad, qty, price, note, d.catalogOnly, chosenAssignee, autoAdd);
  });

  openSheetUI();
}

function cadChip(v,label,sel){ return '<button class="cadchip'+(sel===v?" on":"")+'" data-v="'+v+'">'+label+'</button>'; }

function saveSheet(cat, cad, qty, price, note, catalogOnly, assignee, autoAdd){
  var key = sheetCtx.key;
  // categorie + cadans naar (lokale) catalog — cadans blijft persoonlijk
  var e = state.catalog[key];
  if(!e){ e = touchCatalog(sheetCtx.type==="list" ? (state.list.find(function(i){return i.id===sheetCtx.id;})||{}).name : key, price); e.timesAdded=Math.max(0,(e.timesAdded||1)-1); }
  if(e){
    // Catalog leert van correcties — handmatige cat-wijziging blokkeert toekomstige overschrijving door classifier.
    if(cat !== e.category) e.userOverrideCat = true;
    e.category = cat;
    if(cad==="auto"){ e.cadenceMode="auto"; e.manualIntervalDays=null; }
    else if(cad==="off"){ e.cadenceMode="off"; e.manualIntervalDays=null; }
    else { e.cadenceMode="manual"; e.manualIntervalDays=parseInt(cad.slice(1),10); }
    if(price!=null) e.defaultPrice=price;
    if(typeof autoAdd === "boolean") e.autoAdd = autoAdd;
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

function openSheetUI(){ $("#scrim").classList.add("show"); $("#sheet").classList.add("show"); document.body.classList.add("sheet-open"); }
function closeSheet(){
  $("#scrim").classList.remove("show"); $("#sheet").classList.remove("show"); sheetCtx=null;
  if(!$("#sheet2").classList.contains("show")) document.body.classList.remove("sheet-open");
}
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
  var raw = $("#add-name").value;
  var p = parseQtyFromInput(raw);
  if(!p.name) return;
  hideAC();  // direct sluiten zodat AC-popover niet "kort flikkert" tussen items
  if(addToList(p.name, null, {qty: p.qty})){
    $("#add-name").value="";
    $("#add-name").focus();
    vibe("tick");
  }
}
function buildAC(q){
  // strip qty-syntax voor ac-zoekopdracht (zodat "melk 2" ook 'melk' suggereert)
  var stripped = parseQtyFromInput(q||"").name;
  var nq=norm(stripped);
  if(!nq){ hideAC(); return; }
  var seen={}, prefix=[], partial=[];
  // catalog: prefix-matches eerst, dan partial; binnen elke groep op timesAdded desc
  Object.keys(state.catalog).forEach(function(k){
    var e=state.catalog[k]; var en=norm(e.name);
    if(en===nq) return;
    if(en.indexOf(nq)===0) prefix.push(e);
    else if(en.indexOf(nq)!==-1) partial.push(e);
  });
  var byTimes=function(a,b){ return (b.timesAdded||0)-(a.timesAdded||0); };
  prefix.sort(byTimes); partial.sort(byTimes);
  var results=[];
  prefix.concat(partial).forEach(function(e){ var k=norm(e.name); if(!seen[k]){ seen[k]=1; results.push({name:e.name,cat:e.category,own:true}); } });
  // dan COMMON die niet al voorkomt
  var commonPrefix=[], commonPartial=[];
  COMMON.forEach(function(n){ var k=norm(n); if(seen[k]) return;
    if(k.indexOf(nq)===0) commonPrefix.push(n);
    else if(k.indexOf(nq)!==-1) commonPartial.push(n);
  });
  commonPrefix.concat(commonPartial).forEach(function(n){ var k=norm(n); if(!seen[k]){ seen[k]=1; results.push({name:n,cat:classify(n),own:false}); } });

  results=results.slice(0,6);
  var list=$("#ac-list");
  if(!results.length){ hideAC(); return; }
  list.innerHTML="";
  results.forEach(function(r){
    var c=CAT_BY_ID[r.cat]||CAT_BY_ID["overig"];
    var row=el("div","ac-item",'<span class="ac-emoji emoji">'+c.glyph+'</span><span class="ac-name">'+escapeHtml(r.name)+'</span><span class="ac-add">+</span>');
    row.addEventListener("click",function(){
      // gebruik de qty die in het invoerveld stond als die er was
      var pq = parseQtyFromInput($("#add-name").value || "").qty;
      addToList(r.name, null, {qty: pq});
      $("#add-name").value=""; hideAC(); $("#add-name").focus();
    });
    list.appendChild(row);
  });
  list.classList.add("show");
}
function hideAC(){ $("#ac-list").classList.remove("show"); $("#ac-list").innerHTML=""; }

/* ============================================================
   LONG-PRESS (touch + muis), SEARCH, BULK-PASTE
   ============================================================ */
function attachLongPress(elm, cb, ms){
  ms = ms || 500;
  var timer = null;
  var clear = function(){ if(timer){ clearTimeout(timer); timer=null; } };
  var start = function(){ clear(); timer = setTimeout(function(){ timer=null; vibrate(14); cb(); }, ms); };
  elm.addEventListener("touchstart", start, {passive:true});
  elm.addEventListener("touchend", clear);
  elm.addEventListener("touchmove", clear);
  elm.addEventListener("touchcancel", clear);
  elm.addEventListener("mousedown", start);
  elm.addEventListener("mouseup", clear);
  elm.addEventListener("mouseleave", clear);
  elm.addEventListener("contextmenu", function(e){ e.preventDefault(); });
}

function setupSearchBar(){
  var input = $("#search-input"); if(!input) return;
  var bar = $("#search-bar"); var clear = $("#search-clear");
  input.addEventListener("input", function(){
    var q=(input.value||"").trim().toLowerCase();
    bar.classList.toggle("empty", !q);
    applySearchFilter(q);
  });
  clear.addEventListener("click", function(){
    input.value=""; bar.classList.add("empty");
    applySearchFilter(""); input.focus();
  });
}
function toggleSearchBar(){
  var bar = $("#search-bar"); if(!bar) return;
  var visible = activeTab==="lijst" && state.list.length >= 10;
  bar.style.display = visible ? "" : "none";
  if(!visible){
    var input = $("#search-input");
    if(input && input.value){ input.value=""; bar.classList.add("empty"); applySearchFilter(""); }
  }
}
function applySearchFilter(q){
  q = (q||"").trim().toLowerCase();
  var open = $("#open-list"); var done = $("#done-list");
  if(!open) return;
  if(!q){
    open.querySelectorAll(".row, .section, ul.list").forEach(function(n){ n.style.display=""; });
    if(done) done.style.display = "";
    return;
  }
  if(done) done.style.display = "none";
  open.querySelectorAll("ul.list").forEach(function(ul){
    var any = false;
    ul.querySelectorAll(".row").forEach(function(r){
      var nm = r.querySelector(".nm");
      var name = nm ? nm.textContent.toLowerCase() : "";
      var match = name.indexOf(q) !== -1;
      r.style.display = match ? "" : "none";
      if(match) any = true;
    });
    ul.style.display = any ? "" : "none";
    var sec = ul.previousElementSibling;
    if(sec && sec.classList.contains("section")) sec.style.display = any ? "" : "none";
  });
}

/* Sleepbare lijst van schap-rijen. Globale move/end-listeners worden eenmalig gebonden. */
var _sortState = { dragging:null, items:null, dragIdx:-1, startY:0, offset:0, onReorder:null };
var _sortBound = false;
function _sortMove(clientY){
  var d = _sortState; if(!d.dragging) return;
  d.offset = clientY - d.startY;
  d.dragging.style.transform = "translateY("+d.offset+"px) scale(1.02)";
  var rowH = d.dragging.offsetHeight + 6;
  var newIdx = Math.max(0, Math.min(d.items.length-1, d.dragIdx + Math.round(d.offset/rowH)));
  d.items.forEach(function(r,i){
    if(r===d.dragging) return;
    var shift=0;
    if(d.dragIdx<newIdx && i>d.dragIdx && i<=newIdx) shift = -rowH;
    else if(d.dragIdx>newIdx && i>=newIdx && i<d.dragIdx) shift = rowH;
    r.style.transform = "translateY("+shift+"px)";
  });
}
function _sortEnd(){
  var d = _sortState; if(!d.dragging) return;
  var rowH = d.dragging.offsetHeight + 6;
  var newIdx = Math.max(0, Math.min(d.items.length-1, d.dragIdx + Math.round(d.offset/rowH)));
  d.items.forEach(function(r){ r.style.transform=""; r.classList.remove("dragging"); });
  if(newIdx !== d.dragIdx){
    var ids = d.items.map(function(r){return r.dataset.id;});
    var moved = ids.splice(d.dragIdx, 1)[0];
    ids.splice(newIdx, 0, moved);
    d.onReorder(ids);
  }
  _sortState = { dragging:null, items:null, dragIdx:-1, startY:0, offset:0, onReorder:null };
}
function _ensureSortListeners(){
  if(_sortBound) return;
  _sortBound = true;
  document.addEventListener("touchmove", function(e){
    if(_sortState.dragging){ _sortMove(e.touches[0].clientY); e.preventDefault(); }
  }, {passive:false});
  document.addEventListener("touchend", _sortEnd);
  document.addEventListener("touchcancel", _sortEnd);
  document.addEventListener("mousemove", function(e){ if(_sortState.dragging) _sortMove(e.clientY); });
  document.addEventListener("mouseup", _sortEnd);
}
function makeSortableList(container, items, onReorder){
  _ensureSortListeners();
  var rows = [];
  items.forEach(function(item){
    var row = el("div","sort-row");
    row.dataset.id = item.id;
    row.innerHTML =
      '<span class="sr-emoji emoji">'+item.glyph+'</span>'+
      '<span class="sr-label"></span>'+
      (item.isCustom?'<button class="sr-del" type="button">Verwijder</button>':'')+
      '<span class="sr-handle" aria-label="Sleep"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></span>';
    row.querySelector(".sr-label").textContent = item.label;
    if(item.isCustom){
      row.querySelector(".sr-del").addEventListener("click", function(e){
        e.stopPropagation();
        if(confirm('"'+item.label+'" verwijderen als schap?')) deleteCustomCategory(item.id);
      });
    }
    container.appendChild(row);
    rows.push(row);
  });
  rows.forEach(function(row){
    var handle = row.querySelector(".sr-handle");
    var startDrag = function(clientY){
      _sortState.dragging = row;
      _sortState.items = rows;
      _sortState.dragIdx = rows.indexOf(row);
      _sortState.startY = clientY; _sortState.offset = 0;
      _sortState.onReorder = onReorder;
      row.classList.add("dragging");
      vibrate(8);
    };
    handle.addEventListener("touchstart", function(e){ startDrag(e.touches[0].clientY); e.preventDefault(); }, {passive:false});
    handle.addEventListener("mousedown", function(e){ startDrag(e.clientY); e.preventDefault(); });
  });
}

function openAddCategorySheet(){
  var picked = EMOJI_SET[0];
  var sh = $("#sheet"); if(!sh) return;
  var emojis = EMOJI_SET.map(function(em){
    return '<button class="ep-cell'+(em===picked?" on":"")+'" data-em="'+em+'" type="button">'+em+'</button>';
  }).join("");
  sh.innerHTML = '<div class="grip"></div>'+
    '<h3>Eigen schap</h3>'+
    '<div class="sheet-label"><span class="lbl-cap">Naam</span></div>'+
    '<div class="frow"><input class="txt" id="nc-name" placeholder="Bijv. Klusspullen, Bakker, Boeken" autocapitalize="words" autocomplete="off"></div>'+
    '<div class="sheet-label"><span class="lbl-cap">Pictogram</span><span class="lbl-hint">Tik om te kiezen</span></div>'+
    '<div class="emoji-picker" id="nc-emojis">'+emojis+'</div>'+
    '<div class="hint" style="margin:14px 4px 0">Auto-categorisering werkt niet voor je eigen schappen. Open een product en kies dit schap handmatig.</div>'+
    '<div class="sheet-actions">'+
      '<button class="save" id="nc-go">Toevoegen</button>'+
      '<button class="del" id="nc-cancel">Annuleren</button>'+
    '</div>';
  $("#scrim").classList.add("show"); sh.classList.add("show");
  setTimeout(function(){ var i=$("#nc-name"); if(i) i.focus(); }, 260);
  sh.querySelectorAll("#nc-emojis .ep-cell").forEach(function(b){
    b.addEventListener("click", function(){
      sh.querySelectorAll("#nc-emojis .ep-cell").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on"); picked = b.dataset.em;
    });
  });
  $("#nc-cancel").addEventListener("click", closeSheet);
  $("#nc-go").addEventListener("click", function(){
    var name = ($("#nc-name").value||"").trim();
    if(!name){ toast("Geef een naam"); return; }
    var id = "custom-"+norm(name).replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")+"-"+Date.now().toString(36).slice(-4);
    state.settings.customCategories = state.settings.customCategories || [];
    state.settings.customCategories.push({id:id, label:name, glyph:picked});
    state.settings.categoryOrder.push(id);
    rebuildCatIndex(); save();
    closeSheet(); renderMeer(); toast(name+" toegevoegd");
  });
}

function deleteCustomCategory(id){
  state.settings.customCategories = (state.settings.customCategories||[]).filter(function(c){return c.id!==id;});
  state.settings.categoryOrder = state.settings.categoryOrder.filter(function(cid){return cid!==id;});
  state.list.forEach(function(it){ if(it.category===id) it.category="overig"; });
  Object.keys(state.catalog).forEach(function(k){ if(state.catalog[k].category===id) state.catalog[k].category="overig"; });
  if(state.settings.customCatEmoji) delete state.settings.customCatEmoji[id];
  rebuildCatIndex(); save();
  renderMeer(); renderLijst();
  toast("Schap verwijderd");
}

function openEmojiPickerForCat(catId, onPick){
  var current = (CAT_BY_ID[catId] || {}).glyph || "🛒";
  var picked = current;
  var sh = $("#sheet2") || $("#sheet"); if(!sh) return;
  var useSheet2 = (sh.id === "sheet2");
  var scrim = useSheet2 ? $("#scrim2") : $("#scrim");
  var emojis = EMOJI_SET.map(function(em){
    return '<button class="ep-cell'+(em===picked?" on":"")+'" data-em="'+em+'" type="button">'+em+'</button>';
  }).join("");
  sh.innerHTML = '<div class="grip"></div>'+
    '<h3>Kies pictogram</h3>'+
    '<div class="emoji-picker" id="em-pick">'+emojis+'</div>'+
    '<div class="sheet-actions">'+
      '<button class="save" id="em-go">Opslaan</button>'+
      '<button class="del" id="em-cancel">Annuleren</button>'+
    '</div>';
  scrim.classList.add("show"); sh.classList.add("show");
  sh.querySelectorAll("#em-pick .ep-cell").forEach(function(b){
    b.addEventListener("click", function(){
      sh.querySelectorAll("#em-pick .ep-cell").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on"); picked = b.dataset.em;
    });
  });
  var close = function(){ scrim.classList.remove("show"); sh.classList.remove("show"); };
  $("#em-cancel").addEventListener("click", close);
  $("#em-go").addEventListener("click", function(){
    state.settings.customCatEmoji = state.settings.customCatEmoji || {};
    state.settings.customCatEmoji[catId] = picked;
    rebuildCatIndex(); save();
    close(); onPick && onPick(picked);
  });
}

function openBulkPasteSheet(){
  var sh = $("#sheet"); if(!sh) return;
  sh.innerHTML = '<div class="grip"></div>'+
    '<h3>Plak meerdere</h3>'+
    '<div class="hint" style="margin:0 0 12px">Eén product per regel. Voeg achter een naam "x2" toe voor aantal.</div>'+
    '<textarea class="io" id="bulk-input" placeholder="Melk\nBrood x2\nWc-papier\nKaas 3" style="height:170px" autocapitalize="sentences" autocomplete="off" spellcheck="false"></textarea>'+
    '<div class="sheet-actions">'+
      '<button class="save" id="bulk-go">Toevoegen</button>'+
      '<button class="del" id="bulk-cancel">Annuleren</button>'+
    '</div>';
  $("#scrim").classList.add("show"); sh.classList.add("show");
  setTimeout(function(){ var i=$("#bulk-input"); if(i) i.focus(); }, 260);
  $("#bulk-cancel").addEventListener("click", closeSheet);
  $("#bulk-go").addEventListener("click", function(){
    var text = ($("#bulk-input").value||"");
    var lines = text.split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean);
    var added = 0;
    lines.forEach(function(line){
      var p = parseQtyFromInput(line);
      if(p.name && addToList(p.name, null, {qty:p.qty, silent:true})) added++;
    });
    closeSheet();
    if(added) toast(added + (added===1?" item toegevoegd":" items toegevoegd"));
  });
}

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
  // Add-bar alleen op Lijst — toggle body-class voor de pad-bottom CSS
  document.body.classList.toggle("no-addbar", tab !== "lijst");
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
function emptyState(icon,h,p,actionLabel,actionFn){
  // Hero-illustraties: rustige lijntekening met paar drijvende producten /
  // klok-met-refresh. Stroke is currentColor + .7 opacity (zie shell.html .empty.hero).
  var icons={
    bag:'<svg viewBox="0 0 120 110" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+
      '<path d="M28 50 L24 95 Q24 100 28 100 L92 100 Q96 100 96 95 L92 50 Z"/>'+
      '<path d="M22 50 L98 50"/>'+
      '<path d="M44 50 Q44 32 60 32 Q76 32 76 50"/>'+
      '<path d="M36 70 L84 70" opacity=".45" stroke-dasharray="2 3"/>'+
      '<path d="M40 84 L80 84" opacity=".35" stroke-dasharray="2 3"/>'+
      '<circle cx="22" cy="22" r="6"/>'+
      '<path d="M22 16 V13 M24 14 L27 11"/>'+
      '<ellipse cx="95" cy="20" rx="11" ry="6"/>'+
      '<path d="M88 18 Q92 14 95 18 Q98 14 102 18"/>'+
      '<rect x="55" y="6" width="11" height="18" rx="1.5"/>'+
      '<path d="M55 12 L66 12"/>'+
      '<path d="M58 6 L58 3 L63 3 L63 6"/>'+
    '</svg>',
    repeat:'<svg viewBox="0 0 120 110" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+
      '<circle cx="60" cy="55" r="34"/>'+
      '<path d="M60 30 V55 L78 65"/>'+
      '<path d="M22 36 Q12 55 22 74"/>'+
      '<path d="M20 40 L22 36 L26 38"/>'+
      '<path d="M98 36 Q108 55 98 74"/>'+
      '<path d="M100 40 L98 36 L94 38"/>'+
      '<path d="M60 25 L60 30" opacity=".5"/>'+
      '<path d="M60 80 L60 85" opacity=".5"/>'+
      '<path d="M86 55 L91 55" opacity=".5"/>'+
      '<path d="M29 55 L34 55" opacity=".5"/>'+
    '</svg>'
  };
  var e=el("div","empty hero");
  e.innerHTML='<div class="ico">'+(icons[icon]||icons.bag)+'</div><h2>'+h+'</h2><p>'+p+'</p>';
  if(actionLabel && typeof actionFn === "function"){
    var btn = el("button","mbtn", actionLabel);
    btn.style.maxWidth = "260px"; btn.style.margin = "20px auto 0";
    btn.style.background = "var(--green)"; btn.style.color = "var(--on-green)";
    btn.style.borderColor = "transparent";
    btn.addEventListener("click", actionFn);
    e.appendChild(btn);
  }
  return e;
}
function escapeHtml(s){ return (s||"").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
function escapeAttr(s){ return escapeHtml(s).replace(/'/g,"&#39;"); }

/* Event-delegated tap-ripples — Material-Design-light. Werkt op chips,
   menu-knoppen en sheet-acties. Hosts zijn al position:relative+overflow:hidden
   via shell.html CSS. */
var _rippleSelectors = ".chip, .catchip, .cadchip, .sc-chip, .mbtn, .sheet-actions .save, .sheet-actions .del";
function spawnRipple(host, clientX, clientY){
  var rect = host.getBoundingClientRect();
  var x = clientX - rect.left, y = clientY - rect.top;
  var size = Math.max(rect.width, rect.height) * 0.95;
  var r = document.createElement("span");
  r.className = "ripple";
  r.style.width = r.style.height = size + "px";
  r.style.left = (x - size/2) + "px";
  r.style.top = (y - size/2) + "px";
  host.appendChild(r);
  setTimeout(function(){ if(r.parentNode) r.parentNode.removeChild(r); }, 620);
}
function setupRipples(){
  document.addEventListener("touchstart", function(e){
    var t = e.target && e.target.closest && e.target.closest(_rippleSelectors);
    if(!t) return;
    var p = e.touches && e.touches[0]; if(!p) return;
    spawnRipple(t, p.clientX, p.clientY);
  }, {passive:true});
  document.addEventListener("pointerdown", function(e){
    if(e.pointerType === "touch") return;
    var t = e.target && e.target.closest && e.target.closest(_rippleSelectors);
    if(!t) return;
    spawnRipple(t, e.clientX, e.clientY);
  });
}

/* Toont een topbar-badge wanneer het netwerk wegvalt. Cloud writes happen
   alsnog optimistisch — bij online weer doorgaan reconcilieert realtime. */
function setupOfflineIndicator(){
  var badge = $("#offline-badge"); if(!badge) return;
  var update = function(){
    if(!navigator.onLine) badge.classList.add("show");
    else badge.classList.remove("show");
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function setupTopShareBtn(){
  var btn = $("#share-top-btn"); if(!btn) return;
  btn.addEventListener("click", function(){
    if(typeof Cloud!=="undefined" && Cloud.active && typeof openShareSheet === "function"){
      openShareSheet(Cloud.active);
    }
  });
}

/* iOS-stijl pull-to-refresh. Werkt alleen op de Lijst-tab in een Cloud-lijst.
   Bij sleep >70px → Cloud.refreshItems() + Cloud.refreshMembers(). */
function setupPullToRefresh(){
  var main = $("#main"), ptr = $("#ptr");
  if(!main || !ptr) return;
  var startY = 0, currentDy = 0, pulling = false, locked = false;
  main.addEventListener("touchstart", function(e){
    if(locked) return;
    if(main.scrollTop > 2) { pulling = false; return; }
    if(activeTab!=="lijst" || !(typeof Cloud!=="undefined" && Cloud.active)) { pulling = false; return; }
    startY = e.touches[0].clientY;
    currentDy = 0;
    pulling = true;
  }, {passive:true});
  main.addEventListener("touchmove", function(e){
    if(!pulling) return;
    currentDy = e.touches[0].clientY - startY;
    if(currentDy <= 0){ ptr.classList.remove("show"); return; }
    var y = Math.min(28, currentDy * 0.4);
    ptr.style.setProperty("--ptr-y", y+"px");
    ptr.classList.add("show");
  }, {passive:true});
  main.addEventListener("touchend", function(){
    if(!pulling) return;
    var dy = currentDy;
    pulling = false;
    if(dy > 70 && typeof Cloud!=="undefined" && Cloud.active){
      locked = true;
      ptr.classList.add("spin");
      Promise.all([Cloud.refreshItems(), Cloud.refreshMembers()])
        .catch(function(){})
        .then(function(){
          setTimeout(function(){
            ptr.classList.remove("spin");
            ptr.classList.remove("show");
            locked = false;
          }, 320);
        });
    } else {
      ptr.classList.remove("show");
    }
  });
}

function maybeIntro(){
  if(!state || !state.settings || state.settings.seenIntro) return;
  if(state.list.length>0 || Object.keys(state.catalog).length>0){ state.settings.seenIntro=true; save(); return; }
  var sh=$("#sheet"); if(!sh) return;
  var stages = [
    {glyph:"📝", title:"Typ wat je nodig hebt", body:"Producten landen automatisch in het juiste schap. Eén veld, geen formulier."},
    {glyph:"🔁", title:"Vaste leert mee", body:"Vink af, rond af. Na een paar keer herkent Mandje wat 'bijna op' is — zonder dat je iets hoeft in te stellen."},
    {glyph:"👥", title:"Samen of solo", body:"Maak meerdere lijsten — privé of gedeeld. Deel een stuur-link en iemand kan items naar jou droppen zonder app."}
  ];
  var idx = 0;
  var dismiss = function(){
    state.settings.seenIntro=true; save(); closeSheet();
    setTimeout(function(){ var i=$("#add-name"); if(i) i.focus(); }, 320);
  };
  var render = function(){
    var s = stages[idx];
    var isLast = (idx === stages.length-1);
    sh.innerHTML = '<div class="grip"></div>'+
      '<button id="intro-skip" type="button" aria-label="Sla over" style="position:absolute;top:14px;right:14px;border:0;background:transparent;color:var(--ink-faint);font-size:14px;font-weight:600;padding:6px 10px;border-radius:8px">Sla over</button>'+
      '<div class="intro-stage">'+
        '<div class="intro-card">'+
          '<div class="ic-glyph emoji">'+s.glyph+'</div>'+
          '<h4>'+escapeHtml(s.title)+'</h4>'+
          '<p>'+escapeHtml(s.body)+'</p>'+
        '</div>'+
        '<div class="intro-dots">'+stages.map(function(_,i){return '<span class="id-dot'+(i===idx?" on":"")+'"></span>';}).join("")+'</div>'+
      '</div>'+
      '<div class="sheet-actions">'+
        (isLast
          ? '<button class="save" id="intro-go">Aan de slag</button>'
          : '<button class="save" id="intro-next">Volgende</button>')+
      '</div>';
    $("#intro-skip").addEventListener("click", dismiss);
    if(isLast){
      $("#intro-go").addEventListener("click", dismiss);
    } else {
      $("#intro-next").addEventListener("click", function(){ idx++; render(); });
    }
  };
  $("#scrim").classList.add("show"); sh.classList.add("show");
  render();
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
  attachLongPress($("#add-btn"), openBulkPasteSheet);
  setupSearchBar();
  setupOfflineIndicator();
  setupTopShareBtn();
  setupPullToRefresh();
  setupRipples();
  window.addEventListener("beforeunload", function(){
    if(typeof Cloud!=="undefined" && Cloud.stop) Cloud.stop();
  });
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

  // requestAnimationFrame-debounce zodat we niet 60×/sec class togglen tijdens scroll
  var _scrollRaf = 0;
  var _wasScrolled = false;
  $("#main").addEventListener("scroll",function(){
    if(_scrollRaf) return;
    var main = this;
    _scrollRaf = requestAnimationFrame(function(){
      _scrollRaf = 0;
      var isScrolled = main.scrollTop > 26;
      if(isScrolled !== _wasScrolled){
        $("#topbar").classList.toggle("scrolled", isScrolled);
        _wasScrolled = isScrolled;
      }
    });
  },{passive:true});

  document.addEventListener("dblclick",function(e){ e.preventDefault(); },{passive:false});

  renderLijst(); renderDueBanner();
  switchTab("lijst");
  maybeIntro();
  // 1× per dag: voeg autoAdd-vaste-items met "bijna op"-status automatisch toe
  try{ runAutoAddDueItems(); }catch(e){}
}

/* Tests: zorg dat pure helpers ook via window.* bereikbaar zijn (sommige
   JSDOM-configuraties zetten function-declaraties niet automatisch op window). */
if(typeof window!=="undefined"){
  window.parseQtyFromInput = parseQtyFromInput;
  window.openBulkPasteSheet = openBulkPasteSheet;
  window.recordCoBuy = recordCoBuy;
  window.getCoSuggestions = getCoSuggestions;
  window.touchCatalog = touchCatalog;
  window.removeFromList = removeFromList;
  window.runAutoAddDueItems = runAutoAddDueItems;
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
else init();

})();
