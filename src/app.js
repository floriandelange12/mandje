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
  "kaas-vleeswaren":["boterhamworst","boterham worst","kruidenboter","kaas","jong belegen","oude kaas","geraspte kaas","mozzarella","parmezaan","brie","feta","ham","kipfilet vleeswaren","achterham","salami","cervelaat","worst","rookworst","spek","bacon","pate","leverworst","rosbief","gerookte kip","smeerkaas","roomkaas"],
  "vlees-vis":["vlees","gehakt","rundergehakt","biefstuk","kip","kipfilet","kipdij","kippenpoot","varkenshaas","speklap","rund","lamsvlees","worstjes","braadworst","hamburger","schnitzel","shoarma","vis","zalm","tonijn","kabeljauw","garnaal","garnalen","mossel","haring","makreel","forel","kibbeling","tilapia","pangasius","tofu","tempeh","vegaburger","gerookte zalm"],
  "diepvries":["roomijs","diepvries","ijs","ijsje","magnum","pizza","diepvriespizza","friet","frites","frikandel","kroket","bitterbal","vissticks","loempia","spinazie diepvries","doperwten","tuinbonen","bladerdeeg","ijsblokjes"],
  "ontbijt-beleg":["hagelslag","vlokken","pindakaas","jam","aardbeienjam","honing","stroop","appelstroop","muesli","cruesli","cornflakes","havermout","granola","nutella","chocopasta","sambal","tahini","appelmoes","speculoospasta"],
  "houdbaar":["pasta","spaghetti","macaroni","penne","rijst","basmati","noedels","mie","couscous","bulgur","quinoa","meel","bloem","suiker","basterdsuiker","zout","peper","kruiden","kerrie","paprikapoeder","olie","olijfolie","zonnebloemolie","azijn","balsamico","saus","pastasaus","ketchup","mayonaise","mayo","mosterd","soep","bouillon","blik","conserven","tomatenblokjes","passata","tomatenpuree","kokosmelk","linzen","kikkererwt","kidneybonen","bruine bonen","augurk","olijf","pesto","currypasta","gist","cacao","rozijnen","noten ongezouten"],
  "snoep-snacks":["tortillachips","tortilla chips","chocola","chocolade","reep","snoep","drop","chips","naturel chips","paprikachips","nootjes","noten","pinda","cashew","popcorn","mars","snickers","twix","winegum","zoutjes","toastje","borrelnoot","koekjes","stroopwafel","pepernoten","zoute krakeling"],
  "dranken":["water","spa","bruiswater","cola","fris","frisdrank","sap","sinaasappelsap","appelsap","limonade","ranja","siroop","ice tea","icetea","thee","groene thee","koffie","koffiebonen","espresso","cappuccino","oploskoffie","bier","wijn","rode wijn","witte wijn","prosecco","energiedrank","red bull","tonic","kombucha","smoothie","chocomel"],
  "huishouden":["wc papier","toiletpapier","wc-papier","keukenrol","vuilniszak","afwasmiddel","afwas","vaatwastablet","vaatwas","wasmiddel","wasverzachter","allesreiniger","schoonmaak","spons","schuurspons","vochtige doekjes","aluminiumfolie","vershoudfolie","bakpapier","kaars","theelicht","zakdoek","tissue","afwasborstel","vaatwasmiddel"],
  "verzorging":["shampoo","conditioner","zeep","handzeep","douchegel","tandpasta","tandenborstel","floss","deodorant","deo","scheermes","scheerschuim","bodylotion","handcreme","creme","maandverband","tampon","watten","wattenstaafje","mondwater","zonnebrand","make-up","makeup","mascara","foundation","lippenstift","oogschaduw","nagellak","parfum","eau de toilette"],
  "baby-kind":["luier","luiers","babyluier","trainerbroek","babyvoeding","flesvoeding","melkpoeder","fopspeen","babyflesje","babydoekjes","billendoekjes","babybillendoekjes","babyzalf","sudocrem","babyzeep","babyshampoo","babyolie","baby-olie","knijpfruit","knijpyoghurt","babyhapje","babyhap","slabbetje","spuugdoekje","spuugdoek","kindertandpasta","kindertandborstel","kinderzeep","kindershampoo","babykleding","rompertje","romper","babymutsje","speen","spenen","puzzel","kleurboek","kleurpotloden voor kinderen"],
  "huisdier":["hondenvoer","hondenbrokken","hondensnacks","kauwbot","kauwbotje","hondensnoep","kattenvoer","kattenbrokken","kattenpaté","kattenpate","kattennat","kattenbakvulling","kattengrit","vogelvoer","muizenvoer","konijnenvoer","caviavoer","hamstervoer","vissenvoer","aquariumvoer","dierenvoer","dierenshampoo","dierenkam","kattenkam","vlooienband","wormenkuur","tekenspray","kattenbakje","hondenriem","halsband","hondenpoepzakje","poepzakje","poepzakjes","kattenspeeltje","hondenspeeltje","krabpaal"],
  "klussen":["schroef","schroeven","spijker","spijkers","moeren","bouten","tieraps","tie-rap","schroefje","secondelijm","montagelijm","houtlijm","behangerslijm","siliconenkit","silicone","alleslijm","plakband","duct tape","ducttape","masking tape","schilderstape","isolatietape","batterij","batterijen","aa batterij","aaa batterij","aa-batterij","9v batterij","knoopcel","knoopbatterij","gloeilamp","ledlamp","spaarlamp","fitting","stekker","verlengsnoer","stekkerdoos","schuurpapier","staalwol","kwast","verfrol","verfemmer","verf","grondverf","beits","schroevendraaier","hamer","tang","boormachine","accuboor","sleutelset","steeksleutel","ijzerdraad","nylondraad","houten plank","latje","mdf","piepschuim","isolatie","tochtstrip","stofzuigerzak","stofzuigerfilter"],
  "tuin-planten":["bloemen","boeket","bos bloemen","tuinkruiden","potgrond","tuinaarde","compost","plantengrond","substraat","zaden","zaadjes","bloembol","bloembollen","stekken","plantenvoeding","plantenmest","kunstmest","koemest","groeikorrels","snijbloemen","boeket","kamerplant","hangplant","cactus","vetplant","orchidee","perkplant","perkplantjes","balkonplant","viooltjes","geranium","plantenpot","bloempot","onderschotel","hangmand","tuinslang","gieter","sproeier","graszaad","grassemen","gazonmest","tuinhandschoenen","snoeischaar","schoffel","spade","tuinbezem","plantensteun","plantenstok","bamboestok","plantentouw","vogelhuisje","vogelzaad","strooizout","strooizand"],
  "apotheek":["paracetamol","ibuprofen","aspirine","brufen","advil","neusspray","neusdruppels","oogdruppels","keelpastilles","keelpastille","hoestdrank","hoeststroop","slijmoplosser","multivitamine","vitamine c","vitamine d","vitamine b","ijzertabletten","magnesium","calcium","zink","vitaminen","vitamine","ehbo","ehbo-doos","jodium","betadine","desinfecterend","kompres","steriel kompres","pleister","pleisters","blarenpleister","wondpleister","verband","zwachtel","koortsthermometer","thermometer","bloeddrukmeter","antihistaminicum","loratadine","cetirizine","neusspoeling","zoutoplossing","ibuprofengel","spierzalf","arnica","tijgerbalsem","biotine"],
  "kantoor-school":["balpen","bic","viltstift","stift","markeerstift","fineliner","potlood","kleurpotlood","kleurpotloden","puntenslijper","liniaal","passer","geodriehoek","gradenboog","schrift","schriftje","ringband","ordner","tabbladen","insteekhoes","post-it","plakbriefje","plakbriefjes","memoblok","notitieblok","notitieboekje","paperclip","paperclips","nietmachine","nietjes","perforator","schaar","schaartje","prittstift","lijmstift","lijmstaaf","etiketten","etiket","printerinkt","cartridge","tonercartridge","printerpapier","kopieerpapier","a4-papier","papier a4","a4 papier","rekenmachine","calculator","agenda","planner","prikbord","punaise","punaises","rugzak","schooltas","etui","pennenbakje","pen","pennen","stickers"],
  "kleding-textiel":["sok","sokken","sportsok","damessok","ondergoed","onderbroek","beha","slipje","string","boxer","panty","panty's","kous","kousen","t-shirt","tshirt","hemd","blouse","topje","spijkerbroek","joggingbroek","jeans","short","winterjas","regenjas","trui","sweater","hoodie","schoenen","laarzen","sneakers","sandalen","slippers","riem","handschoen","handschoenen","muts","sjaal","das","zwemkleding","zwembroek","badpak","bikini","theedoek","theedoeken","vaatdoek","vaatdoeken","dweil","dweilen","sponsdoek","washandje","washand","washandjes","badhanddoek","gastendoekje","handdoek","handdoeken","hoeslaken","laken","kussensloop","sloop","dekbedovertrek","overtrek","plaid"]
};
// vlakke lijst {kw, cat}, gesorteerd op lengte aflopend voor specificiteit
var FLAT_KW = [];
Object.keys(KW).forEach(function(cat){ KW[cat].forEach(function(w){ FLAT_KW.push({w:w, cat:cat}); }); });
FLAT_KW.sort(function(a,b){ return b.w.length - a.w.length; });

function norm(s){ return (s||"").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
/* Vergelijkingssleutel voor dubbele regels: koppeltekens/underscores → spatie, meervoudige spaties → één */
function matchKey(s){ return norm(s).replace(/[-_\/]+/g," ").replace(/\s+/g," ").trim(); }

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
  // Respecteer een handmatige categorie-correctie (userOverrideCat) → corrigeren is blijvend
  if(typeof state!=="undefined" && state && state.catalog){
    var ce = state.catalog[n];
    if(ce && ce.userOverrideCat && ce.category) return ce.category;
  }
  var words = n.split(/\s+/);
  // Score elke treffer: exact +200, aan het einde van de naam +100 ("boterhamworst" → worst, "melkchocolade" → chocolade),
  // op een woordgrens +50, lengte als tiebreak. Korte woorden (<4) tellen alleen als heel woord.
  var best=null, bestScore=0;
  for(var i=0;i<FLAT_KW.length;i++){
    var w = FLAT_KW[i].w;
    var idx = n.indexOf(w); if(idx===-1) continue;
    var isWord = words.indexOf(w) !== -1;
    if(w.length < 4 && !isWord) continue;
    var endsAt = idx + w.length;
    var bStart = idx===0 || /[\s-]/.test(n.charAt(idx-1));
    var bEnd = endsAt===n.length || /[\s-]/.test(n.charAt(endsAt));
    var score = w.length;
    if(n===w) score += 200;
    if(endsAt===n.length) score += 100;
    if(bStart && bEnd) score += 50;
    if(score > bestScore){ bestScore=score; best=FLAT_KW[i].cat; }
  }
  if(best) return best;
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
var CURRENT_STATE_VERSION = 3;
var DEFAULTS = {
  version: CURRENT_STATE_VERSION,
  settings:{ theme:"auto", textScale:1, shopHideDone:false, haptics:true, showPrices:false, seenIntro:false, categoryOrder:CATS.map(function(c){return c.id;}), minPurchases:3, cvThreshold:0.6, dueWindowDays:1, customCategories:[], customCatEmoji:{}, collapsedCats:{}, seenQtyHint:false, seenBulkHint:false, seenPriceNudge:false, pushOn:null },
  history:[],
  syncQueue:[],
  lastSyncState:{ mode:"local", status:"not_started", ready:false, pendingMutations:0, offline:false, reason:null, lastError:null, lastUpdated:0 },
  offlinePendingFlags:{},
  list:[],
  catalog:{},
  coBuy:{},
  meals:{}
};

var state = null;
var _idbCheckpointAt = 0;
var _localMutationEpoch = 0;
var _cloudRestoreGuard = 0;
if(typeof window !== "undefined") window.__mandjeLocalMutationEpoch = 0;
/* Persoonlijke lijst bewaren terwijl een cloud-lijst actief is: state.list bevat dan de
   cloud-items, dus save() mag die NIET als persoonlijke lijst wegschrijven (BUG: contaminatie). */
var _personalList = null;

function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
function isPlainObject(o){ return !!o && typeof o==="object" && !Array.isArray(o); }
function safeParse(raw){ if(typeof raw !== "string") return null; try{ return JSON.parse(raw); }catch(e){ return null; } }
function normalizeItems(arr){
  var out=[]; if(!Array.isArray(arr)) return out;
  for(var i=0;i<arr.length;i++){
    var it=arr[i]; if(!isPlainObject(it)) continue;
    out.push({ id:it.id||uid(), name:(it.name||"").toString(), category:it.category||"overig", qty:Math.max(1, Number(it.qty)||1), price:(it.price==null?null:Number(it.price)),
      note:(it.note||"").toString(), unit:(it.unit||"").toString(), section:(it.section||"").toString().slice(0,40), done:!!it.done, assigned_to:it.assigned_to||null, added_by_name:it.added_by_name||"", addedAt:it.addedAt||nowISO() });
  }
  return out;
}
function normalizeState(raw){
  var inState = isPlainObject(raw) ? raw : {};
  var out = Object.assign({}, DEFAULTS, {
    version: CURRENT_STATE_VERSION,
    settings: Object.assign({}, DEFAULTS.settings, isPlainObject(inState.settings) ? inState.settings : {}),
    syncQueue: Array.isArray(inState.syncQueue) ? inState.syncQueue.slice() : [],
    lastSyncState: Object.assign({}, DEFAULTS.lastSyncState, isPlainObject(inState.lastSyncState) ? inState.lastSyncState : {}),
    offlinePendingFlags: isPlainObject(inState.offlinePendingFlags) ? inState.offlinePendingFlags : {},
    list: [],
    catalog: isPlainObject(inState.catalog) ? inState.catalog : {},
    coBuy: isPlainObject(inState.coBuy) ? inState.coBuy : {},
    meals: isPlainObject(inState.meals) ? inState.meals : {},
    history: Array.isArray(inState.history) ? inState.history.filter(isPlainObject).slice(0, 200) : []
  });
  out.localMutationEpoch = Number(inState.localMutationEpoch) || 0;
  out._cloudOpenEpoch = Number(inState._cloudOpenEpoch) || 0;
  if(Array.isArray(inState.list)){
    for(var i=0;i<inState.list.length;i++){
      var it = inState.list[i];
      if(!isPlainObject(it)) continue;
      out.list.push({
        id: it.id,
        name: (it.name||"").toString(),
        category: it.category || "overig",
        qty: Math.max(1, Number(it.qty) || 1),
        price: (it.price == null ? null : Number(it.price)),
        note: (it.note||"").toString(),
        unit: (it.unit||"").toString(),
        section: (it.section||"").toString().slice(0,40),
        done: !!it.done,
        assigned_to: it.assigned_to || null,
        added_by_name: it.added_by_name || "",
        addedAt: it.addedAt || nowISO()
      });
    }
  }
  // Meerdere lokale lijsten (Fase 6): index met items; de actieve lijst leeft in out.list (save() synct terug)
  var llIn = Array.isArray(inState.localLists) ? inState.localLists.filter(isPlainObject) : [];
  out.localLists = llIn.map(function(l){
    return { id:String(l.id||("l_"+uid())), name:String(l.name||"Lijst").slice(0,40), type:(l.type==="plain"?"plain":"grocery"),
      preset:String(l.preset||(l.type==="plain"?"check":"grocery")), glyph:String(l.glyph||"🧺").slice(0,4),
      finish:(l.finish==="terugzetten"?"terugzetten":"opruimen"), placeholder:(l.placeholder==null?null:String(l.placeholder).slice(0,80)),
      open:(l.open?String(l.open).slice(0,30):null), done:(l.done?String(l.done).slice(0,30):null), doneTitle:(l.doneTitle?String(l.doneTitle).slice(0,30):null),
      items:normalizeItems(l.items), createdAt:l.createdAt||nowISO() };
  });
  if(!out.localLists.length){
    out.localLists=[{ id:"l_boodschappen", name:"Boodschappen", type:"grocery", preset:"grocery", glyph:"🧺", finish:"opruimen", placeholder:null, open:null, done:null, doneTitle:null, items:[], createdAt:nowISO() }];
  }
  out.activeLocalId = (inState.activeLocalId && out.localLists.some(function(l){ return l.id===inState.activeLocalId; })) ? inState.activeLocalId : out.localLists[0].id;
  var actL = out.localLists.filter(function(l){ return l.id===out.activeLocalId; })[0];
  if(llIn.length && actL) out.list = actL.items;      // nieuwe opslag: items van de actieve lijst
  if(actL) actL.items = out.list;                      // oude opslag: de enige lijst wordt "Boodschappen"
  if(!Array.isArray(out.settings.categoryOrder)) out.settings.categoryOrder = DEFAULTS.settings.categoryOrder.slice();
  if(!Array.isArray(out.settings.customCategories)) out.settings.customCategories = [];
  if(!isPlainObject(out.settings.customCatEmoji)) out.settings.customCatEmoji = {};
  CATS.forEach(function(c){ if(out.settings.categoryOrder.indexOf(c.id)===-1) out.settings.categoryOrder.push(c.id); });
  out.settings.customCategories.forEach(function(c){ if(c && c.id && out.settings.categoryOrder.indexOf(c.id)===-1) out.settings.categoryOrder.push(c.id); });
  // winkels: geldige lijst, elke looproute bevat alle schappen (nieuwe schappen achteraan)
  out.settings.stores = (Array.isArray(out.settings.stores) ? out.settings.stores : []).filter(function(s){ return isPlainObject(s) && s.id && s.name; }).map(function(s){
    var order = Array.isArray(s.order) ? s.order.filter(function(cid){ return out.settings.categoryOrder.indexOf(cid)!==-1; }) : [];
    out.settings.categoryOrder.forEach(function(cid){ if(order.indexOf(cid)===-1) order.push(cid); });
    return { id:String(s.id), name:String(s.name).slice(0,40), order:order };
  });
  if(out.settings.activeStoreId && !out.settings.stores.some(function(s){ return s.id===out.settings.activeStoreId; })) out.settings.activeStoreId=null;
  return out;
}
function getCloudStateSummary(){
  if(typeof Cloud !== "undefined" && Cloud.getStateSummary){
    return Cloud.getStateSummary();
  }
  return { mode:(typeof Cloud!=="undefined" && Cloud.active)?"cloud":"local", status: "not_started", ready:false, activeListId:null, pendingMutations:0, offline:true };
}
function shouldAcceptCloudList(items, opts){
  opts = opts || {};
  var itemEpoch = Number(opts.openLocalEpoch || 0);
  var now = Date.now ? Date.now() : 0;
  var openStartedAt = Number(opts.openStartedAt || 0);
  var localEpoch = (typeof window !== "undefined" && typeof window.__mandjeLocalMutationEpoch === "number") ? window.__mandjeLocalMutationEpoch : _localMutationEpoch;
  if(itemEpoch && localEpoch && localEpoch > itemEpoch && openStartedAt && now - openStartedAt < 2500){
    return false;
  }
  if(Array.isArray(items) && state && items === state.list){
    return true;
  }
  return true;
}

/* ---- IndexedDB-vangnet (onzichtbaar): checkpoint van de hele state, voor het geval
   localStorage wordt gewist/gepurged (iOS 7-dagen, quota, reset). Faalt stil. ---- */
function idbSet(key, valStr){
  try{
    if(typeof indexedDB==="undefined") return;
    var req=indexedDB.open("mandje-bak",1);
    req.onupgradeneeded=function(){ try{ req.result.createObjectStore("kv"); }catch(e){} };
    req.onsuccess=function(){ try{ var db=req.result; db.transaction("kv","readwrite").objectStore("kv").put(valStr,key); }catch(e){} };
  }catch(e){}
}
function idbGet(key){
  return new Promise(function(res){
    try{
      if(typeof indexedDB==="undefined"){ res(null); return; }
      var req=indexedDB.open("mandje-bak",1);
      req.onupgradeneeded=function(){ try{ req.result.createObjectStore("kv"); }catch(e){} };
      req.onsuccess=function(){ try{ var g=req.result.transaction("kv","readonly").objectStore("kv").get(key); g.onsuccess=function(){res(g.result||null);}; g.onerror=function(){res(null);}; }catch(e){ res(null); } };
      req.onerror=function(){ res(null); };
    }catch(e){ res(null); }
  });
}
/* Herstel localStorage uit het IndexedDB-checkpoint als 't leeg/corrupt is — vóór load(). */
function ensureRestore(){
  return new Promise(function(res){
    var raw=null; try{ raw=localStorage.getItem(NS); }catch(e){}
    var parsed = safeParse(raw);
    if(parsed && isPlainObject(parsed)){ res(); return; }
    idbGet(NS).then(function(backup){
      if(backup){
        var restored = safeParse(backup);
        if(restored && isPlainObject(restored)){ try{ localStorage.setItem(NS, JSON.stringify(restored)); }catch(e){} }
      }
      res();
    });
  });
}

function load(){
  if(_savePending) saveNow();   // nooit een uitgestelde schrijfactie verliezen door een herlaad uit opslag
  var raw = null, parsed = null;
  try{ raw = localStorage.getItem(NS); }catch(e){}
  if(raw){
    try{ parsed = JSON.parse(raw); }catch(e){ parsed = null; }
  }
  if(parsed && typeof parsed === "object"){
    state = normalizeState(parsed);
    var loadedAt = Date.now ? Date.now() : 0;
    state._meta = Object.assign({}, state._meta || {}, {
      lastLoadedAt: loadedAt,
      restoreMode: typeof Cloud !== "undefined" && Cloud && Cloud.active ? "cloud-suspended" : "local"
    });
    var savedLocalMutation = Number(state._meta.localMutationEpoch) || 0;
    _cloudRestoreGuard = Math.max(_cloudRestoreGuard, savedLocalMutation);
    if(typeof state._meta.restoreMode === "string" && state._meta.restoreMode.indexOf("cloud") !== -1){
      var safeWindow = (loadedAt - Number(state._meta.lastCloudOpenAt || 0)) < 9000;
      if(safeWindow && Array.isArray(_personalList)){
        state.list = _personalList.slice();
      }
    }
    // Bescherming tegen init-race: bewaar een lokale snapshot wanneer cloud juist actief is.
    if(state._meta.restoreMode === "cloud-suspended" && typeof Cloud !== "undefined" && Cloud && Cloud.active && Array.isArray(_personalList) && savedLocalMutation >= _cloudRestoreGuard){
      state.list = _personalList.slice();
    }
    if(state._meta.localMutationEpoch){
      _localMutationEpoch = state._meta.localMutationEpoch;
      if(typeof window !== "undefined") window.__mandjeLocalMutationEpoch = _localMutationEpoch;
    }
    rebuildCatIndex();
    // Eenmalige migratie naar meerdere lijsten (Fase 6): oude opslag zonder index direct in de nieuwe vorm wegschrijven
    if(!Array.isArray(parsed.localLists)){ try{ save(); }catch(e){} }
    return;
  }
  // geen geldige v2-data -> eenmalige migratie vanaf v1
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

/* save() bundelt meerdere mutaties in dezelfde tick tot één schrijfactie (microtask); saveNow() schrijft direct */
var _savePending=false;
function save(){
  if(_savePending) return;
  _savePending=true;
  Promise.resolve().then(function(){ if(_savePending){ _savePending=false; _saveNow(); } });
}
function saveNow(){ _savePending=false; _saveNow(); }
function _saveNow(){
  try{
    if(typeof Cloud === "undefined" || !Cloud.active){
      _localMutationEpoch += 1;
      if(typeof window !== "undefined") window.__mandjeLocalMutationEpoch = _localMutationEpoch;
      state._meta = Object.assign({}, state._meta || {}, {
        localMutationEpoch: _localMutationEpoch,
        lastLocalWriteAt: Date.now ? Date.now() : 0,
        restoreMode: "local"
      });
    }else{
      state._meta = Object.assign({}, state._meta || {}, {
        restoreMode: "cloud"
      });
    }
    // Tijdens een actieve cloud-lijst staat de cloud-lijst in state.list → bewaar i.p.v.
    // daarvan de persoonlijke lijst, zodat terugschakelen naar Persoonlijk 'm intact houdt.
    var actList = activeLocalList();
    if(actList) actList.items = (typeof Cloud!=="undefined" && Cloud.active) ? (_personalList || []) : state.list;
    var snap = state;
    if(typeof Cloud!=="undefined" && Cloud.active){
      snap = Object.assign({}, state, { list: _personalList || [] });
    }
    var str = JSON.stringify(snap);
    localStorage.setItem(NS, str);
    // Onzichtbaar vangnet: hooguit elke ~8s naar IndexedDB checkpointen
    var now = (Date.now ? Date.now() : 0);
    if(now - _idbCheckpointAt > 8000){ _idbCheckpointAt = now; idbSet(NS, str); }
  }catch(e){}
  if(!navigator.onLine && typeof refreshOfflineBadge === "function") refreshOfflineBadge();
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
function addDays(d,n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()+Math.round(n)); }
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
  // Handmatig ritme zonder koopgeschiedenis: er is nog geen ankerpunt, dus nog niet "bijna op".
  // Het item blijft wel zichtbaar onder "Jouw vaste boodschappen" tot de eerste aankoop.
  if(a.mode==="manual" && !a.last) return false;
  var today = parseDay(todayStr());
  var threshold = addDays(a.next, -state.settings.dueWindowDays);
  return today.getTime() >= threshold.getTime();
}

// items die "bijna op" zijn en nog niet open op de lijst staan
function getDueItems(){
  var openKeys = {};
  state.list.forEach(function(it){ if(!it.done) openKeys[norm(it.name)]=true; });
  var today = todayStr();
  var dismissed = (state.settings && state.settings.dismissedDueItems) || {};
  var out=[];
  Object.keys(state.catalog).forEach(function(k){
    if(openKeys[k]) return;
    if(dismissed[k] === today) return; // vandaag weggetikt → niet tonen, morgen weer
    var e=state.catalog[k];
    if(e.hidden) return;                                   // "niet meer voorstellen"
    if(e.snoozeUntil && e.snoozeUntil >= today) return;   // uitgesteld (lang indrukken op de chip)
    var a=analyse(e);
    if(isDue(a)) out.push({key:k, e:e, a:a});
  });
  out.sort(function(x,y){ return y.a.overdue - x.a.overdue; });
  return out;
}
function dismissDueItem(k){
  if(!state.settings.dismissedDueItems) state.settings.dismissedDueItems = {};
  state.settings.dismissedDueItems[k] = todayStr();
  save(); renderDueBanner();
}
function snoozeDue(k, days){
  var e=state.catalog[k]; if(!e) return;
  var d=addDays(parseDay(todayStr()), days||7);
  e.snoozeUntil = d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  save(); renderDueBanner(); if(activeTab==="vaste") renderVaste();
  toast(e.name+" uitgesteld — "+(days===7?"volgende week":days+" dagen")+" niet meer vragen", {duration:2600, action:"Ongedaan", onAction:function(){ delete e.snoozeUntil; save(); renderDueBanner(); if(activeTab==="vaste") renderVaste(); }});
}
function dismissDueBanner(){
  var due = getDueItems(); if(!due.length) return;
  if(!state.settings.dismissedDueItems) state.settings.dismissedDueItems = {};
  var today = todayStr();
  due.forEach(function(d){ state.settings.dismissedDueItems[d.key] = today; });
  // oude dismissals van vorige dagen opruimen zodat het object niet groeit
  Object.keys(state.settings.dismissedDueItems).forEach(function(k){
    if(state.settings.dismissedDueItems[k] !== today) delete state.settings.dismissedDueItems[k];
  });
  save(); renderDueBanner();
}

/* Auto-add: items met autoAdd=true die NU due zijn, max 1× per dag,
   nooit dubbel toevoegen wanneer al op de lijst. Lokaal alleen. */
function runAutoAddDueItems(){
  if(typeof Cloud!=="undefined" && Cloud.active) return;
  if(!T().cadence) return;
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
/* Vaak gekocht: catalog-items op timesAdded × recency (laatst toegevoegd < 30 dagen weegt zwaarder), niet al open op de lijst */
function frequentItems(limit){
  var open={}; state.list.forEach(function(i){ if(!i.done) open[norm(i.name)]=1; });
  var now=Date.now(), out=[];
  Object.keys(state.catalog||{}).forEach(function(k){
    var e=state.catalog[k]; if(!e || e.hidden || open[k]) return;
    var times=(e.timesAdded||0) + (e.purchaseDates||[]).length;
    if(times < 2) return;
    var days = e.lastAddedAt ? (now - new Date(e.lastAddedAt).getTime())/86400000 : 365;
    var score = times * (1 / (1 + Math.max(0,days)/30));
    out.push({key:k, e:e, score:score});
  });
  out.sort(function(a,b){ return b.score - a.score; });
  return out.slice(0, limit||8).map(function(x){ return x.e; });
}
function quickChip(e){
  var c=CAT_BY_ID[e.category]||CAT_BY_ID["overig"];
  var b=el("button","chip",shelfIcon(c)+'<span>'+escapeHtml(e.name)+'</span><span class="plus">+</span>'); b.type="button";
  b.addEventListener("click",function(){ addToList(e.name, e.defaultPrice); if(activeTab==="vaste") renderVaste(); });
  return b;
}
/* Startzet bij een lege lijst: vaak gekocht, vorige lijst herhalen, bundels kiezen */
function renderQuickStart(wrap){
  if(!T().catalog) return;
  var freq=frequentItems(8);
  var last=(state.history||[])[0];
  var meals=(typeof mealList==="function") ? mealList() : [];
  if(!freq.length && !last && !meals.length) return;
  var q=el("div","quick-start");
  if(freq.length){
    q.appendChild(el("div","qs-lbl","Vaak gekocht"));
    var chips=el("div","chips"); freq.forEach(function(e){ chips.appendChild(quickChip(e)); }); q.appendChild(chips);
  }
  var acts=el("div","qs-actions");
  if(last && last.items && last.items.length){
    var rb=el("button","mbtn","Herhaal vorige lijst ("+last.items.length+")"); rb.type="button";
    rb.addEventListener("click", repeatLastTrip); acts.appendChild(rb);
  }
  if(meals.length){
    var mb=el("button","mbtn","Kies een bundel"); mb.type="button";
    mb.addEventListener("click", function(){ switchTab("vaste"); }); acts.appendChild(mb);
  }
  if(acts.children.length) q.appendChild(acts);
  wrap.appendChild(q);
}
function repeatLastTrip(){
  var last=(state.history||[])[0]; if(!last || !last.items) return;
  var n=0;
  last.items.forEach(function(i){ if(i && i.name && addToList(i.name, null, {qty:i.qty||1, unit:i.unit||"", silent:true})) n++; });
  toast(n+" items van je vorige lijst teruggezet");
}
/* ---------- Catalogusbeheer: hernoemen (met samenvoegen), verbergen, verwijderen ---------- */
function renameCatalogEntry(oldKey, newName){
  newName=(newName||"").trim(); if(!newName) return false;
  var e=state.catalog[oldKey]; if(!e) return false;
  var newKey=norm(newName);
  if(newKey===oldKey){ e.name=newName; save(); return true; }
  var t=state.catalog[newKey];
  if(t){
    var seen={}; t.purchaseDates=(t.purchaseDates||[]).concat(e.purchaseDates||[]).filter(function(d){ if(seen[d]) return false; seen[d]=1; return true; }).sort();
    t.timesAdded=(t.timesAdded||0)+(e.timesAdded||0);
    if(t.defaultPrice==null && e.defaultPrice!=null) t.defaultPrice=e.defaultPrice;
    if(!t.lastAddedAt || (e.lastAddedAt && e.lastAddedAt>t.lastAddedAt)) t.lastAddedAt=e.lastAddedAt;
    t.name=newName;
  } else { e.name=newName; state.catalog[newKey]=e; }
  delete state.catalog[oldKey];
  if(state.coBuy && state.coBuy[oldKey]){ var co=state.coBuy[oldKey]; delete state.coBuy[oldKey]; state.coBuy[newKey]=Object.assign(state.coBuy[newKey]||{}, co); }
  Object.keys(state.coBuy||{}).forEach(function(k){ var m=state.coBuy[k]; if(m && m[oldKey]!=null){ m[newKey]=(m[newKey]||0)+m[oldKey]; delete m[oldKey]; } });
  state.list.forEach(function(i){ if(norm(i.name)===oldKey) i.name=newName; });
  save();
  if(activeTab==="lijst") renderLijst();
  return true;
}
function renderCatalogSection(wrap){
  var n=Object.keys(state.catalog||{}).length; if(!n) return;
  var sec=el("div","section");
  sec.innerHTML='<span class="cat-emoji emoji">📚</span><span>Alles wat Mandje kent</span><span class="count">'+n+'</span><span class="spacer"></span>';
  var btn=el("button","more-link","Beheren"); btn.type="button"; btn.addEventListener("click", function(){ openCatalogSheet(); }); sec.appendChild(btn);
  wrap.appendChild(sec);
  wrap.appendChild(el("div","hint","Hernoem producten, voeg dubbele samen of verberg wat Mandje niet meer moet voorstellen."));
}
function openCatalogSheet(){
  var sh=$("#sheet"); if(!sh) return;
  sh.innerHTML='<div class="grip"></div><h3>Alles wat Mandje kent</h3>'+
    '<div class="frow"><input class="txt" id="cm-q" type="search" placeholder="Zoek een product…" autocomplete="off" autocorrect="off" autocapitalize="none"></div>'+
    '<div id="cm-list" class="cm-list"></div>'+
    '<div class="sheet-actions"><button class="save" id="cm-close" type="button">Klaar</button></div>';
  var list=sh.querySelector("#cm-list"), inp=sh.querySelector("#cm-q");
  var openKey=null;
  var render=function(){
    list.innerHTML="";
    var q=norm(inp.value||"");
    var keys=Object.keys(state.catalog||{}).filter(function(k){ return !q || k.indexOf(q)!==-1 || norm(state.catalog[k].name).indexOf(q)!==-1; });
    keys.sort(function(a,b){ return state.catalog[a].name.localeCompare(state.catalog[b].name,"nl"); });
    if(!keys.length){ list.appendChild(el("div","hint","Niets gevonden.")); return; }
    keys.slice(0,80).forEach(function(k){
      var e=state.catalog[k]; var c=CAT_BY_ID[e.category]||CAT_BY_ID["overig"];
      var bought=(e.purchaseDates||[]).length;
      var row=el("div","cm-row"+(e.hidden?" hidden-entry":""));
      row.innerHTML='<div class="cm-name"><div class="cm-title"></div><div class="cm-meta">'+escapeHtml(c.label)+(bought?' · '+bought+'× gekocht':'')+(e.hidden?' · verborgen':'')+'</div></div><button class="cm-more" type="button" aria-label="Acties" aria-expanded="false">⋯</button>';
      row.querySelector(".cm-title").textContent=e.name;
      var more=row.querySelector(".cm-more");
      more.addEventListener("click",function(){ openKey = (openKey===k) ? null : k; render(); });
      list.appendChild(row);
      if(openKey===k){
        more.setAttribute("aria-expanded","true");
        var acts=el("div","cm-acts");
        var mkA=function(label, fn, cls){ var b=el("button",cls||"",label); b.type="button"; b.addEventListener("click", fn); acts.appendChild(b); };
        mkA("Details", function(){ openSheetForCatalog(k); });
        mkA("Hernoem", function(){ var nn=prompt("Nieuwe naam voor "+e.name+" (bestaat de naam al, dan worden ze samengevoegd):", e.name); if(nn===null) return; if(renameCatalogEntry(k, nn)){ openKey=null; render(); renderLijst(); toast("Hernoemd"); } });
        mkA(e.hidden?"Weer voorstellen":"Niet meer voorstellen", function(){ e.hidden=!e.hidden; save(); render(); });
        mkA("Verwijder", function(){ if(!confirm(e.name+" uit de catalogus verwijderen? Koopgeschiedenis en ritme gaan verloren.")) return; delete state.catalog[k]; if(state.coBuy) delete state.coBuy[k]; save(); openKey=null; render(); }, "danger");
        list.appendChild(acts);
      }
    });
    if(keys.length>80) list.appendChild(el("div","hint","Nog "+(keys.length-80)+" meer — zoek om te verfijnen."));
  };
  inp.addEventListener("input", render);
  render();
  sh.querySelector("#cm-close").addEventListener("click", function(){ closeSheet(); renderVaste(); renderDueBanner(); });
  openSheetUI();
}
function getRecurring(){
  var out=[];
  Object.keys(state.catalog).forEach(function(k){
    var e=state.catalog[k]; if(e.hidden) return;
    var a=analyse(e);
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
  str = String(str).trim().replace(/[^0-9,.\-]/g,"");
  if(str==="") return null;
  var lastComma = str.lastIndexOf(","), lastDot = str.lastIndexOf(".");
  if(lastComma>-1 && lastDot>-1){
    // Beide aanwezig (bv. "1.234,56" of "1,234.56"): de rechtse is de decimaalscheiding,
    // de andere is duizendtalscheiding en valt weg.
    if(lastComma > lastDot) str = str.replace(/\./g,"").replace(",",".");
    else str = str.replace(/,/g,"");
  } else if(lastComma>-1){
    str = str.replace(/,/g,".");   // alleen komma → decimaalscheiding (NL)
  }
  // Alleen punt of niets: punt blijft de decimaalscheiding
  var n = parseFloat(str);
  return isNaN(n)?null:n;
}

/* "melk", "melk 2", "melk x3", "melk ×4" → {name, qty}.
   qty alleen overgenomen als ondubbelzinnig (x/×/* prefix of >=2).
   Daarnaast: hoeveelheid + eenheid → {name, qty:1, unit} ("500 g gehakt" of "melk 2 liter"). */
var UNIT_RE = "(mg|kg|kilo|gram|g|ml|cl|liter|l|stuks|stuk|st|pak|blik|fles|bos|tros|rol|zak)";
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
  // Eenheid als PREFIX: "500 g gehakt", "2 liter melk", "1 kg aardappels"
  var amt = "(\\d+(?:[.,]\\d+)?)";
  var pre = raw.match(new RegExp("^"+amt+"\\s*"+UNIT_RE+"\\s+(.+)$","i"));
  if(pre){ return { name: pre[3].trim(), qty:1, unit: pre[1]+" "+pre[2].toLowerCase() }; }
  // Eenheid als SUFFIX: "melk 2 liter", "gehakt 500g"
  var suf = raw.match(new RegExp("^(.+?)\\s+"+amt+"\\s*"+UNIT_RE+"$","i"));
  if(suf){ return { name: suf[1].trim(), qty:1, unit: suf[2]+" "+suf[3].toLowerCase() }; }
  return { name: raw, qty: 1 };
}
function $(s){ return document.querySelector(s); }
function el(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
function vibrate(ms){ if(typeof state!=="undefined" && state && state.settings && state.settings.haptics===false) return; if(navigator.vibrate){ try{navigator.vibrate(ms);}catch(e){} } }
/* Haptic-layers — kies semantisch ipv elke keer een getal kiezen.
   tap=micro (qty+/-), tick=hoofd-actie (afvinken/toevoegen), nudge=warning. */
function vibe(level){
  var map = { tap:6, tick:12, nudge:20 };
  vibrate(map[level] || 10);
}

/* Subtiele confetti — kort, weinig deeltjes, brand-kleuren. Respecteert reduce-motion. */
function celebrate(){
  try{
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var app=document.getElementById("app"); if(!app) return;
    var layer=document.createElement("div"); layer.className="confetti-layer";
    var colors=["#2F7A4F","#E0772E","#3D8BFF","#E5446D","#C9A227","#1FB6A8"];
    var N=16;
    for(var i=0;i<N;i++){
      var b=document.createElement("span"); b.className="confetti-bit";
      b.style.left=(8 + Math.random()*84)+"%";
      b.style.background=colors[i%colors.length];
      b.style.animationDelay=(Math.random()*120)+"ms";
      b.style.animationDuration=(800+Math.random()*500)+"ms";
      b.style.transform="translateY(-10px)";
      layer.appendChild(b);
    }
    app.appendChild(layer);
    setTimeout(function(){ if(layer.parentNode) layer.parentNode.removeChild(layer); }, 1600);
  }catch(e){}
}

/* Item "vliegt" van het invoerveld naar een doel-avatar (bij sturen naar vriend). */
function flyToAvatar(fromEl, toEl, label){
  try{
    if(!fromEl || !toEl) return;
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var a=fromEl.getBoundingClientRect(), b=toEl.getBoundingClientRect();
    var bit=document.createElement("div"); bit.className="fly-bit";
    bit.textContent=(label||"").slice(0,18);
    bit.style.left=(a.left+14)+"px"; bit.style.top=(a.top+a.height/2-14)+"px";
    bit.style.transition="transform .55s var(--ease,cubic-bezier(.24,.65,0,1)), opacity .55s ease";
    document.body.appendChild(bit);
    var dx=(b.left+b.width/2)-(a.left+14)-bit.offsetWidth/2;
    var dy=(b.top+b.height/2)-(a.top+a.height/2);
    requestAnimationFrame(function(){
      bit.style.transform="translate("+dx+"px,"+dy+"px) scale(.3)";
      bit.style.opacity="0";
    });
    // doel-avatar even laten "poppen"
    setTimeout(function(){ try{ toEl.style.transition="transform .2s var(--ease-out)"; toEl.style.transform="scale(1.18)"; setTimeout(function(){ toEl.style.transform=""; },200);}catch(e){} }, 430);
    setTimeout(function(){ if(bit.parentNode) bit.parentNode.removeChild(bit); }, 650);
  }catch(e){}
}

var CHECK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="var(--on-brand)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path pathLength="24" d="M20 6 9 17l-5-5"/></svg>';

/* ============================================================
   TOAST
   ============================================================ */
/* Toast-stapel: #toast is de hoofdplek (actie-toasts zoals "Ongedaan" hebben daar voorrang), #toast2 vangt een
   gewone melding op zolang een actie-toast zichtbaar is. Per slot een eigen timer; pauze-listeners worden één keer gebonden. */
var _toastSlots = {};
function _toastEl(opts){
  var t1 = $("#toast"), t2 = $("#toast2");
  if(!t2 || opts.action) return t1;
  var primaryBusy = t1.classList.contains("show") && t1.classList.contains("has-action");
  return primaryBusy ? t2 : t1;
}
function toast(msg, opts){
  opts = opts || {};
  var t = _toastEl(opts); if(!t) return;
  var slot = _toastSlots[t.id] || (_toastSlots[t.id] = {});
  clearTimeout(slot.timer);
  t.className = "toast" + (t.id === "toast2" ? " toast-2" : "");
  t.innerHTML = "";
  var span = document.createElement("span");
  span.className = "toast-msg";
  span.textContent = msg;
  t.appendChild(span);
  var duration = opts.duration || 1500;
  var paused = false, remaining = duration, startedAt = 0;
  var hide = function(){ t.classList.remove("show"); t._pause = null; t._resume = null; };
  var schedule = function(ms){ clearTimeout(slot.timer); startedAt = Date.now(); slot.timer = setTimeout(hide, ms); };
  if(typeof opts.onTap === "function"){
    t.classList.add("has-tap");
    t.onclick = function(e){ if(e.target && e.target.closest && e.target.closest(".toast-action")) return; try{ opts.onTap(); }catch(x){} hide(); clearTimeout(slot.timer); };
  } else { t.onclick = null; }
  if(opts.action && typeof opts.onAction === "function"){
    t.classList.add("has-action");
    var btn = document.createElement("button");
    btn.className = "toast-action"; btn.type = "button"; btn.textContent = opts.action;
    btn.addEventListener("click", function(){ try{ opts.onAction(); }catch(e){} hide(); clearTimeout(slot.timer); });
    t.appendChild(btn);
    // Pauze bij hover/aanraken zodat je 'm niet mist tijdens het lezen — listeners één keer per slot
    t._pause = function(){ if(paused) return; paused = true; remaining = Math.max(600, remaining - (Date.now() - startedAt)); clearTimeout(slot.timer); };
    t._resume = function(){ if(!paused) return; paused = false; schedule(remaining); };
    if(!t._pauseBound){
      t._pauseBound = true;
      t.addEventListener("mouseenter", function(){ if(t._pause) t._pause(); });
      t.addEventListener("mouseleave", function(){ if(t._resume) t._resume(); });
      t.addEventListener("touchstart", function(){ if(t._pause) t._pause(); }, {passive:true});
      t.addEventListener("touchend", function(){ if(t._resume) t._resume(); });
    }
  } else { t._pause = null; t._resume = null; }
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
  if(isPlainList()){
    // 'Kleding: sokken' → kopje Kleding; geen aantallen, geen catalogus, achteraan toevoegen
    var sec=(opts.section||"").trim();
    var mm=name.match(/^([^:]{1,30}):\s*(.+)$/);
    if(mm && !/^https?$/i.test(mm[1])){ sec=mm[1].trim(); name=mm[2].trim(); }
    if(!name) return false;
    var mk0=matchKey(name);
    if(state.list.some(function(i){ return !i.done && matchKey(i.name)===mk0; })){ if(!opts.silent) toast(name+" staat er al op"); return false; }
    state.list.push({ id:uid(), name:name, category:"overig", section:sec.slice(0,40), qty:1, price:null, note:"", unit:"", done:false, addedAt:nowISO() });
    save(); renderLijst();
    if(!opts.silent) toast(name+(sec?" → "+sec:""), {duration:1400});
    return true;
  }
  var addQty = Math.max(1, opts.qty || 1);
  var silent = !!opts.silent;
  var unit = opts.unit || "";
  if(Cloud.active){
    Cloud.addItem(name, (state.settings.showPrices?price:null), addQty, {silent:silent, unit:unit});
    touchCatalog(name, price); save();
    return true;
  }
  var k=norm(name), mk=matchKey(name);
  var existing = state.list.find(function(i){ return !i.done && matchKey(i.name)===mk; });
  if(existing){
    existing.qty += addQty;
    if(price!=null) existing.price=price;
    if(unit) existing.unit=unit;
    if(!silent) toast(name + " → " + existing.qty + "×");
  } else{
    var cat = (state.catalog[k] && state.catalog[k].category) || classify(name);
    var defPrice = price!=null ? price : (state.catalog[k] ? state.catalog[k].defaultPrice : null);
    var newId=uid();
    state.list.unshift({ id:newId, name:name, category:cat, qty:addQty, price:(state.settings.showPrices?defPrice:null), note:"", unit:unit, done:false, addedAt:nowISO() });
    if(!silent){ var cl=CAT_BY_ID[cat]||CAT_BY_ID["overig"]; toast((addQty>1 ? addQty+"× " : "") + name + " → " + cl.label, {duration:1600, onTap:function(){ scrollToRow(newId); }}); }
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
  save(); flipList(renderLijst);
  if(!wasDone && it.done){
    undoToast(it.name + " afgevinkt", function(){
      var i2 = state.list.find(function(x){return x.id===id;});
      if(i2){ i2.done = false; save(); flipList(renderLijst); }
    });
  }
}
var _qtyTapCount = {};
function setQty(id,delta){
  vibe("tap");
  // Eenmalige ontdek-hint: wie vaak +/- tikt weet de "melk 2"-syntax nog niet
  if(delta>0 && state && state.settings && !state.settings.seenQtyHint){
    _qtyTapCount[id] = (_qtyTapCount[id]||0) + 1;
    if(_qtyTapCount[id] >= 3){
      state.settings.seenQtyHint = true; save();
      toast("Tip: typ direct 'melk 2' om 2 stuks toe te voegen", {duration:3500});
    }
  }
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
  if(isPlainList()){ finishPlain(); return; }
  if(Cloud.active){ Cloud.finish(); return; }
  var done=state.list.filter(function(i){return i.done;});
  if(!done.length) return;
  var today=todayStr();
  // onthoud welke aankoopdatums nieuw zijn, zodat "Terug op de lijst" ze weer weghaalt
  var marks=done.map(function(it){ var k=norm(it.name), e=state.catalog[k]; return {k:k, had:!!(e && (e.purchaseDates||[]).indexOf(today)!==-1)}; });
  done.forEach(function(it){ recordPurchase(it.name, it.price); });
  recordCoBuy(done.map(function(it){return it.name;}));
  var entry=recordTrip(done);
  var snapshot=done.map(function(i){ return Object.assign({}, i); });
  state.list=state.list.filter(function(i){return !i.done;});
  save(); renderLijst(); renderDueBanner(); renderVaste();
  vibe("nudge"); celebrate();
  var undo=function(){
    snapshot.forEach(function(i){ if(!state.list.some(function(x){ return x.id===i.id; })) state.list.push(i); });
    marks.forEach(function(m){ var e=state.catalog[m.k]; if(e && !m.had){ var idx=(e.purchaseDates||[]).indexOf(today); if(idx!==-1) e.purchaseDates.splice(idx,1); } });
    state.history=(state.history||[]).filter(function(h){ return h.id!==entry.id; });
    save(); renderLijst(); renderDueBanner(); renderVaste();
    if(shopIsOpen()) renderShopBody();
    toast("Teruggezet op je lijst");
  };
  afterFinish(entry, undo, done.length);
}
/* Na afronden: in de winkel met resterende items → undo-toast en verder; anders (of alles klaar) → "Klaar!"-blad */
function afterFinish(entry, undoFn, n){
  var label=n+(n===1?" boodschap gekocht":" boodschappen gekocht");
  var remaining=state.list.filter(function(i){return !i.done;}).length;
  if(shopIsOpen()){
    if(remaining>0){ renderShopBody(); if(undoFn) undoToast(label, undoFn); else toast(label); return; }
    closeShoppingMode();
  }
  openFinishSheet(entry, undoFn);
}
/* Cloud.finish roept dit aan i.p.v. zelf te toasten (undo op cloud-lijsten komt in Fase 3 met soft-delete) */
function finishAfterCloud(done){
  var entry=recordTrip(done); save();
  afterFinish(entry, null, done.length);
}
/* Geschiedenis: laatste 200 afrondingen (datum, aantal, totaal, items) — bron voor "Herhaal vorige lijst" en uitgaven-inzicht */
function recordTrip(done){
  var total=0, has=false;
  done.forEach(function(i){ if(i.price!=null){ has=true; total+=(i.price||0)*(i.qty||1); } });
  var entry={ id:uid(), at:nowISO(), count:done.length, total:(has?Math.round(total*100)/100:null), paid:null,
    list:(typeof Cloud!=="undefined" && Cloud.active) ? Cloud.active : "local",
    items:done.map(function(i){ return {name:i.name, qty:i.qty||1, unit:i.unit||"", price:(i.price==null?null:i.price), category:i.category||"overig"}; }) };
  state.history=Array.isArray(state.history)?state.history:[];
  state.history.unshift(entry);
  if(state.history.length>200) state.history.length=200;
  return entry;
}
/* "Nog iets vergeten?" — co-buy-suggesties over alle gekochte items, niet al op de lijst */
function forgottenSuggestions(items, limit){
  var scores={}, listKeys={}, boughtKeys={};
  state.list.forEach(function(i){ if(!i.done) listKeys[norm(i.name)]=1; });
  items.forEach(function(i){ boughtKeys[norm(i.name)]=1; });
  items.forEach(function(it){
    getCoSuggestions(norm(it.name), 5).forEach(function(s){ if(listKeys[s.key]||boughtKeys[s.key]) return; scores[s.key]=(scores[s.key]||0)+s.count; });
  });
  return Object.keys(scores).sort(function(a,b){ return scores[b]-scores[a]; }).slice(0, limit||3).map(function(k){ return state.catalog[k]; }).filter(Boolean);
}
function openFinishSheet(entry, undoFn){
  var sh=$("#sheet"); if(!sh || !entry) return;
  var n=entry.count, total=entry.total;
  var forgot=forgottenSuggestions(entry.items||[], 3);
  sh.innerHTML='<div class="grip"></div><h3>Klaar!</h3>'+
    '<div class="fin-sum"><b>'+n+'</b> '+(n===1?"boodschap":"boodschappen")+' gekocht'+((total!=null && total>0)?' · <b>'+euro(total)+'</b>':'')+'</div>'+
    (state.settings.showPrices ? '<label class="fin-paid" for="fin-paid"><span>Wat heb je betaald?</span><span class="fin-paid-in"><span>€</span><input id="fin-paid" type="text" inputmode="decimal" placeholder="'+(total?euro(total).replace("€",""):"0,00")+'" autocomplete="off"></span></label>' : '')+
    (forgot.length ? '<div class="sheet-label"><span class="lbl-cap">Nog iets vergeten?</span></div><div class="chips" id="fin-forgot"></div>' : '')+
    '<div class="sheet-actions"><button class="save" id="fin-ok" type="button">Klaar</button>'+(undoFn?'<button class="del" id="fin-undo" type="button">Terug op de lijst</button>':'')+'</div>';
  var fc=sh.querySelector("#fin-forgot");
  if(fc){ forgot.forEach(function(e){ var b=quickChip(e); b.addEventListener("click", function(){ b.disabled=true; b.style.opacity=".5"; }); fc.appendChild(b); }); }
  var savePaid=function(){
    var inp=sh.querySelector("#fin-paid"); if(!inp || !inp.value.trim()) return;
    var v=parseFloat(inp.value.replace(",", ".")); if(isFinite(v) && v>=0){ entry.paid=Math.round(v*100)/100; save(); }
  };
  sh.querySelector("#fin-ok").addEventListener("click", function(){ savePaid(); closeSheet(); });
  var ub=sh.querySelector("#fin-undo"); if(ub) ub.addEventListener("click", function(){ closeSheet(); undoFn(); });
  openSheetUI();
}

/* ============================================================
   RENDER — Lijst-tab
   ============================================================ */
/* Schap-volgorde voor de render: eerst de ingestelde volgorde, daarna élk schap dat wél items
   heeft maar niet in categoryOrder staat (bv. een eigen schap van een ander lid op een gedeelde
   lijst). Zonder dit vangnet verdwenen die items geruisloos uit de lijst terwijl ze wél meetelden. */
/* ============================================================
   LIJSTEN & LIJSTTYPES — meerdere lokale lijsten; 'grocery' (alles wat er is) of 'plain'
   (geen aantal-parsing, geen prijzen/cadans/catalogus, vrije secties, handmatige volgorde)
   ============================================================ */
var LIST_TYPES = {
  grocery: { id:"grocery", qty:true,  prices:true,  cadence:true,  catalog:true,  shelves:true,  shop:true,  scan:true,  placeholder:"Wat heb je nodig?  ·  bijv. melk 2", open:"te halen", done:"in mandje", doneTitle:"In mandje" },
  plain:   { id:"plain",   qty:false, prices:false, cadence:false, catalog:false, shelves:false, shop:false, scan:false, placeholder:"Wat moet erop?  ·  bijv. Kleding: sokken", open:"open", done:"afgevinkt", doneTitle:"Afgevinkt" }
};
var LIST_PRESETS = [
  { key:"grocery", type:"grocery", name:"Boodschappen", glyph:"🧺", finish:"opruimen",    sub:"Schappen, aantallen, vaste boodschappen", placeholder:null, open:"te halen", done:"in mandje", doneTitle:"In mandje" },
  { key:"pack",    type:"plain",   name:"Paklijst",     glyph:"🧳", finish:"terugzetten", sub:"Kopjes als Kleding en Documenten, herbruikbaar", placeholder:"Wat gaat er mee?  ·  bijv. Kleding: sokken", open:"in te pakken", done:"ingepakt", doneTitle:"Ingepakt" },
  { key:"todo",    type:"plain",   name:"To-do",        glyph:"✅", finish:"opruimen",    sub:"Taken afstrepen en opruimen", placeholder:"Wat moet er gebeuren?", open:"te doen", done:"klaar", doneTitle:"Klaar" },
  { key:"check",   type:"plain",   name:"Checklist",    glyph:"📝", finish:"terugzetten", sub:"Steeds opnieuw afvinken", placeholder:"Volgende punt…", open:"open", done:"afgevinkt", doneTitle:"Afgevinkt" },
  { key:"notes",   type:"plain",   name:"Notities",     glyph:"🗒️", finish:"opruimen",    sub:"Losse aantekeningen, afstrepen als het klaar is", placeholder:"Schrijf een notitie…", open:"notities", done:"afgevinkt", doneTitle:"Afgevinkt" }
];
var LIST_TEMPLATES = {
  strand:      { name:"Strand", items:[["Kleding","zwemkleding","slippers","hoed of pet","zonnebril","luchtige kleding","vest voor 's avonds"],["Toiletspullen","zonnebrand","aftersun","lippenbalsem met SPF","tandenborstel en tandpasta","deodorant","shampoo"],["Documenten","paspoort of ID","verzekeringspas","boekingsbevestiging","pinpas en wat contant geld"],["Elektronica","telefoon en oplader","powerbank","oordopjes","e-reader of boek"],["Overig","strandlaken","strandtas","waterfles","snacks voor onderweg","kaartspel"]] },
  stedentrip:  { name:"Stedentrip", items:[["Kleding","comfortabele schoenen","regenjas","nette outfit","ondergoed en sokken","pyjama"],["Toiletspullen","tandenborstel en tandpasta","deodorant","reisformaat shampoo","medicijnen","pleisters"],["Documenten","paspoort of ID","boekingsbevestiging hotel","tickets","OV-kaart of app","pinpas en wat contant geld"],["Elektronica","telefoon en oplader","powerbank","oordopjes","wereldstekker"],["Overig","kleine rugzak","waterfles","reisgids of offline kaart","kauwgom"]] },
  wintersport: { name:"Wintersport", items:[["Kleding","skibroek","skijas","thermo-ondergoed","skisokken","handschoenen","muts en buff","fleece","après-ski schoenen"],["Uitrusting","skibril","helm","skipas","zonnebrand SPF50","lippenbalsem met SPF"],["Documenten","paspoort of ID","reisverzekering","boekingsbevestiging","rijbewijs"],["Elektronica","telefoon en oplader","powerbank","oordopjes"],["Overig","medicijnen en pleisters","dagrugzak","waterfles","snacks voor op de piste"]] },
  kamperen:    { name:"Kamperen", items:[["Slapen","tent","haringen en hamer","slaapzak","matje of luchtbed","kussen","zaklamp of hoofdlamp"],["Koken","gasstel en gas","aansteker","pannetje","bestek en borden","afwasmiddel en doek","koelbox","waterjerrycan"],["Kleding","regenjas","warme trui","stevige schoenen","slippers","zwemkleding"],["Verzorging","toilettas","zonnebrand","muggenspray","EHBO-setje","toiletpapier"],["Overig","campingstoelen","tafel","verlengsnoer","kaartspel","vuilniszakken"]] },
  weekend:     { name:"Weekend weg", items:[["Kleding","2× outfit","ondergoed en sokken","pyjama","jas","comfortabele schoenen"],["Toiletspullen","tandenborstel en tandpasta","deodorant","medicijnen","reisformaat shampoo"],["Documenten","ID","boekingsbevestiging","pinpas"],["Elektronica","telefoon en oplader","powerbank","oordopjes"],["Overig","boek","waterfles","snacks","cadeautje voor de gastheer"]] }
};
function templateItems(key){
  var t=LIST_TEMPLATES[key]; if(!t) return [];
  var out=[];
  t.items.forEach(function(sec){ var sname=sec[0]; sec.slice(1).forEach(function(n){ out.push({ id:uid(), name:n, category:"overig", section:sname, qty:1, price:null, note:"", unit:"", done:false, addedAt:nowISO() }); }); });
  return out;
}
function localLists(){ return (state && Array.isArray(state.localLists)) ? state.localLists : []; }
function localListById(id){ var ls=localLists(); for(var i=0;i<ls.length;i++){ if(ls[i].id===id) return ls[i]; } return null; }
function activeLocalList(){ return localListById(state && state.activeLocalId) || localLists()[0] || null; }
function presetOf(key){ for(var i=0;i<LIST_PRESETS.length;i++){ if(LIST_PRESETS[i].key===key) return LIST_PRESETS[i]; } return LIST_PRESETS[0]; }
/* Meta van de geopende lijst — een gedeelde (cloud-)lijst is voorlopig altijd 'grocery' (lists.type komt met migratie M6) */
function currentListMeta(){
  if(typeof Cloud!=="undefined" && Cloud && Cloud.active){
    var l = (typeof Cloud.activeList==="function") ? Cloud.activeList() : null;
    return { id:Cloud.active, name:(l && typeof listDisplayName==="function") ? listDisplayName(l) : "Gedeeld", type:(l && l.type==="plain") ? "plain" : "grocery", preset:"grocery", glyph:"🧺", finish:"opruimen", shared:true };
  }
  return activeLocalList() || { id:"l_boodschappen", name:"Boodschappen", type:"grocery", preset:"grocery", glyph:"🧺", finish:"opruimen" };
}
function T(){ var m=currentListMeta(); return LIST_TYPES[m.type] || LIST_TYPES.grocery; }
function isPlainList(){ return T().id==="plain"; }
function localListName(){ return currentListMeta().name || "Boodschappen"; }
function listLabels(){
  var m=currentListMeta(), p=presetOf(m.preset), t=T();
  return { open:m.open||p.open||t.open, done:m.done||p.done||t.done, doneTitle:m.doneTitle||p.doneTitle||t.doneTitle, placeholder:m.placeholder||p.placeholder||t.placeholder };
}
/* body-klasse + placeholder volgen het lijsttype */
function applyListType(){
  var plain=isPlainList();
  document.body.classList.toggle("list-plain", plain);
  var inp=$("#add-name"); if(inp) inp.placeholder = listLabels().placeholder;
}
function createLocalList(opts){
  opts=opts||{};
  var p=presetOf(opts.preset||"grocery");
  var l={ id:"l_"+uid(), name:String(opts.name||p.name).trim().slice(0,40)||p.name, type:p.type, preset:p.key, glyph:p.glyph, finish:p.finish,
    placeholder:p.placeholder, open:p.open, done:p.done, doneTitle:p.doneTitle, items:[], createdAt:nowISO() };
  if(opts.template && LIST_TEMPLATES[opts.template]) l.items = templateItems(opts.template);
  state.localLists = localLists().concat([l]);
  save();
  return l;
}
function switchLocalList(id){
  var target=localListById(id); if(!target) return false;
  if(typeof Cloud!=="undefined" && Cloud && Cloud.active && typeof Cloud.openLocal==="function"){ Cloud.openLocal(); }   // eerst terug naar lokaal
  var cur=activeLocalList();
  if(cur && cur.id!==target.id) cur.items = state.list.slice();
  state.activeLocalId = target.id;
  if(cur && cur.id===target.id){ /* al actief */ } else { state.list = (target.items||[]).slice(); }
  save();
  applyListType();
  if(typeof applyListHeader==="function") applyListHeader();
  if(typeof renderListSwitch==="function") renderListSwitch();
  if(activeTab!=="lijst") switchTab("lijst"); else { renderLijst(); renderDueBanner(); updateSubhead(); }
  return true;
}
function renameLocalList(id, name){ var l=localListById(id); if(!l) return false; name=String(name||"").trim().slice(0,40); if(!name) return false; l.name=name; save(); if(typeof applyListHeader==="function") applyListHeader(); if(typeof renderListSwitch==="function") renderListSwitch(); return true; }
function duplicateLocalList(id){
  var l=localListById(id); if(!l) return null;
  var items=(l.id===state.activeLocalId ? state.list : (l.items||[])).map(function(i){ var c=Object.assign({}, i); c.id=uid(); c.done=false; return c; });
  var copy=Object.assign({}, l, { id:"l_"+uid(), name:(l.name+" (kopie)").slice(0,40), items:items, createdAt:nowISO() });
  state.localLists = localLists().concat([copy]); save();
  return copy;
}
function deleteLocalList(id){
  var ls=localLists(); if(ls.length<=1) return false;
  var l=localListById(id); if(!l) return false;
  var wasActive = (state.activeLocalId===id) && !(typeof Cloud!=="undefined" && Cloud && Cloud.active);
  state.localLists = ls.filter(function(x){ return x.id!==id; });
  if(state.activeLocalId===id){
    var next=state.localLists[0];
    state.activeLocalId=next.id;
    if(wasActive) state.list=(next.items||[]).slice();
  }
  save();
  if(wasActive){ applyListType(); if(typeof applyListHeader==="function") applyListHeader(); if(activeTab==="lijst"){ renderLijst(); renderDueBanner(); updateSubhead(); } }
  if(typeof renderListSwitch==="function") renderListSwitch();
  return true;
}
/* Nieuwe lijst: naam, soort (preset), optioneel sjabloon (paklijst), optioneel delen (cloud, alleen boodschappen) */
function openNewListSheet(){
  var sh=$("#sheet"); if(!sh) return;
  var chosen="grocery", template=null;
  var canShare = !!(typeof Cloud!=="undefined" && Cloud && Cloud.enabled);
  sh.innerHTML='<div class="grip"></div><h3>Nieuwe lijst</h3>'+
    '<div class="frow"><div class="fl">Naam</div><input class="txt" id="nl-name" placeholder="bijv. Vakantie, Klussen, Verjaardag" autocapitalize="words" autocomplete="off"></div>'+
    '<div class="sheet-label"><span class="lbl-cap">Soort lijst</span></div><div class="type-grid" id="nl-types"></div>'+
    '<div id="nl-templates"></div>'+
    (canShare ? '<div class="grow wrap" id="nl-share-row" style="padding:10px 4px;border:0"><div class="glabel">Delen (online)<div class="gsub">Samen bijhouden met huisgenoten — alleen voor boodschappen</div></div></div>' : '')+
    '<div class="sheet-actions"><button class="save" id="nl-go" type="button">Aanmaken</button><button class="del" id="nl-cancel" type="button">Annuleren</button></div>';
  var grid=sh.querySelector("#nl-types"), tplWrap=sh.querySelector("#nl-templates"), nameInp=sh.querySelector("#nl-name");
  var shareOn=false, shareSw=null;
  if(canShare){
    shareSw=el("button","switch"); shareSw.type="button"; shareSw.setAttribute("role","switch"); shareSw.setAttribute("aria-checked","false"); shareSw.setAttribute("aria-label","Delen (online)");
    shareSw.addEventListener("click",function(){ shareOn=!shareOn; shareSw.classList.toggle("on", shareOn); shareSw.setAttribute("aria-checked", shareOn?"true":"false"); });
    sh.querySelector("#nl-share-row").appendChild(shareSw);
  }
  var renderTypes=function(){
    grid.innerHTML="";
    LIST_PRESETS.forEach(function(p){
      var b=el("button","type-chip"+(p.key===chosen?" on":""),'<span class="tc-g" aria-hidden="true">'+p.glyph+'</span><span class="tc-n">'+escapeHtml(p.name)+'</span><span class="tc-s">'+escapeHtml(p.sub)+'</span>');
      b.type="button"; b.setAttribute("aria-pressed", p.key===chosen?"true":"false");
      b.addEventListener("click",function(){ chosen=p.key; template=null; if(!nameInp.value.trim() || LIST_PRESETS.some(function(x){ return x.name===nameInp.value.trim(); })) nameInp.value = p.name; renderTypes(); renderTemplates(); });
      grid.appendChild(b);
    });
    var shareRow=sh.querySelector("#nl-share-row"); if(shareRow) shareRow.style.display = (chosen==="grocery") ? "" : "none";
  };
  var renderTemplates=function(){
    tplWrap.innerHTML="";
    if(chosen!=="pack") return;
    tplWrap.innerHTML='<div class="sheet-label"><span class="lbl-cap">Begin met een sjabloon</span><span class="lbl-hint">optioneel</span></div><div class="cadrow" id="nl-tpl"></div>';
    var row=tplWrap.querySelector("#nl-tpl");
    Object.keys(LIST_TEMPLATES).forEach(function(k){
      var b=el("button","cadchip"+(template===k?" on":""),LIST_TEMPLATES[k].name); b.type="button";
      b.addEventListener("click",function(){ template = (template===k) ? null : k; if(template && (!nameInp.value.trim() || nameInp.value.trim()==="Paklijst")) nameInp.value = LIST_TEMPLATES[k].name; renderTemplates(); });
      row.appendChild(b);
    });
  };
  renderTypes(); renderTemplates();
  sh.querySelector("#nl-cancel").addEventListener("click", closeSheet);
  sh.querySelector("#nl-go").addEventListener("click", function(){
    var name=(nameInp.value||"").trim() || presetOf(chosen).name;
    closeSheet();
    if(shareOn && chosen==="grocery" && canShare){
      if(typeof ensureIdentity==="function") ensureIdentity(function(){ Cloud.createList(name); }); else Cloud.createList(name);
      return;
    }
    var l=createLocalList({ name:name, preset:chosen, template:template });
    switchLocalList(l.id);
    toast(name+" aangemaakt"+(template?" — "+l.items.length+" items uit het sjabloon":""));
  });
  openSheetUI();
  setTimeout(function(){ nameInp.focus(); }, 260);
}
/* Beheer: hernoemen, afrond-modus (plain), dupliceren, verwijderen */
function openListManageSheet(id){
  var l=localListById(id); if(!l) return;
  var sh=$("#sheet"); if(!sh) return;
  var p=presetOf(l.preset);
  sh.innerHTML='<div class="grip"></div><h3></h3>'+
    '<div class="frow"><div class="fl">Naam</div><input class="txt" id="lm-name" autocapitalize="words" autocomplete="off"></div>'+
    '<div class="hint" style="margin:0 6px 12px">'+p.glyph+' '+escapeHtml(p.name)+' · '+((l.id===state.activeLocalId?state.list:(l.items||[])).length)+' items · op dit toestel</div>'+
    (l.type==="plain" ? '<div class="sheet-label"><span class="lbl-cap">Na het afvinken</span></div><div class="cadrow" id="lm-finish"></div><div class="hint" style="margin:0 6px 12px" id="lm-finish-hint"></div>' : '')+
    '<div class="sheet-actions"><button class="save" id="lm-save" type="button">Opslaan</button><button class="del" id="lm-del" type="button">Verwijder</button></div>'+
    '<button class="mbtn" id="lm-dup" type="button" style="margin-top:10px">Dupliceren (kopie zonder vinkjes)</button>';
  sh.querySelector("h3").textContent=l.name;
  sh.querySelector("#lm-name").value=l.name;
  var finish=l.finish;
  var fr=sh.querySelector("#lm-finish");
  if(fr){
    var opts=[["opruimen","Opruimen","Afgevinkte items verdwijnen (to-do)"],["terugzetten","Terugzetten","Alle vinkjes gaan weer uit (paklijst, checklist)"]];
    var paint=function(){ fr.innerHTML=""; opts.forEach(function(o){ var b=el("button","cadchip"+(o[0]===finish?" on":""),o[1]); b.type="button"; b.addEventListener("click",function(){ finish=o[0]; paint(); }); fr.appendChild(b); }); sh.querySelector("#lm-finish-hint").textContent=(opts.filter(function(o){return o[0]===finish;})[0]||opts[0])[2]; };
    paint();
  }
  sh.querySelector("#lm-save").addEventListener("click",function(){
    renameLocalList(id, sh.querySelector("#lm-name").value);
    l.finish=finish; save(); closeSheet();
    if(activeTab==="lijst") renderLijst();
    toast("Opgeslagen");
  });
  sh.querySelector("#lm-dup").addEventListener("click",function(){ var c=duplicateLocalList(id); closeSheet(); if(c){ switchLocalList(c.id); toast(c.name+" aangemaakt"); } });
  sh.querySelector("#lm-del").addEventListener("click",function(){
    if(localLists().length<=1){ toast("Je laatste lijst kun je niet verwijderen"); return; }
    if(!confirm("'"+l.name+"' verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    closeSheet(); deleteLocalList(id); toast("Lijst verwijderd");
  });
  openSheetUI();
}
/* Plain-lijst: item-sheet met naam, kopje en notitie */
function openPlainSheet(listId){
  var it=state.list.find(function(i){return i.id===listId;}); if(!it) return;
  var sh=$("#sheet"); if(!sh) return;
  var sections=[]; state.list.forEach(function(i){ var s=(i.section||"").trim(); if(s && sections.indexOf(s)===-1) sections.push(s); });
  sh.innerHTML='<div class="grip"></div><h3></h3>'+
    '<div class="frow"><div class="fl">Tekst</div><input class="txt" id="ps-name" autocomplete="off"></div>'+
    '<div class="frow"><div class="fl">Kopje</div><input class="txt" id="ps-section" list="ps-sections" placeholder="bijv. Kleding, Documenten" autocapitalize="words" autocomplete="off"><datalist id="ps-sections"></datalist></div>'+
    (sections.length ? '<div class="cadrow" id="ps-secchips"></div>' : '')+
    '<div class="frow"><div class="fl">Notitie</div><textarea class="io" id="ps-note" rows="3" placeholder="Extra details…"></textarea></div>'+
    '<div class="sheet-actions"><button class="save" id="ps-save" type="button">Klaar</button><button class="del" id="ps-del" type="button">Verwijder</button></div>';
  sh.querySelector("h3").textContent=it.name;
  sh.querySelector("#ps-name").value=it.name;
  sh.querySelector("#ps-section").value=it.section||"";
  sh.querySelector("#ps-note").value=it.note||"";
  var dl=sh.querySelector("#ps-sections"); sections.forEach(function(s){ var o=document.createElement("option"); o.value=s; dl.appendChild(o); });
  var chips=sh.querySelector("#ps-secchips");
  if(chips){ sections.forEach(function(s){ var b=el("button","cadchip"+((it.section||"")===s?" on":""),s); b.type="button"; b.addEventListener("click",function(){ sh.querySelector("#ps-section").value=s; chips.querySelectorAll(".cadchip").forEach(function(x){ x.classList.toggle("on", x===b); }); }); chips.appendChild(b); }); }
  sh.querySelector("#ps-save").addEventListener("click",function(){
    var nm=(sh.querySelector("#ps-name").value||"").trim(); if(nm) it.name=nm;
    it.section=(sh.querySelector("#ps-section").value||"").trim().slice(0,40);
    it.note=(sh.querySelector("#ps-note").value||"").trim();
    save(); closeSheet(); renderLijst(); toast("Opgeslagen");
  });
  sh.querySelector("#ps-del").addEventListener("click",function(){ closeSheet(); removeFromList(it.id); });
  openSheetUI();
}
/* Afronden op plain lijsten: opruimen (afgevinkt weg) of terugzetten (alle vinkjes uit) — altijd met undo */
function finishPlain(mode){
  var meta=currentListMeta(); mode = mode || meta.finish || "opruimen";
  var done=state.list.filter(function(i){return i.done;}); if(!done.length) return;
  var snapshot=state.list.map(function(i){ return Object.assign({}, i); });
  if(mode==="terugzetten"){ state.list.forEach(function(i){ i.done=false; }); }
  else { state.list=state.list.filter(function(i){return !i.done;}); }
  save(); renderLijst(); vibe("nudge");
  var label = mode==="terugzetten" ? done.length+(done.length===1?" vinkje":" vinkjes")+" teruggezet" : done.length+(done.length===1?" item opgeruimd":" items opgeruimd");
  undoToast(label, function(){ state.list=snapshot; save(); renderLijst(); });
}
/* Plain-lijst: kopjes in volgorde van verschijnen, rijen met sleepgreep, afgevinkt onderaan */
function renderPlainLists(open, done, openFrag, doneFrag){
  var lab=listLabels();
  var groups=[], byName={};
  open.forEach(function(it){ var s=(it.section||"").trim(); if(!byName[s]){ byName[s]={name:s, items:[]}; groups.push(byName[s]); } byName[s].items.push(it); });
  groups.forEach(function(g){
    var wrap=el("div","shelf plain"); wrap.dataset.section=g.name;
    if(g.name){ var sec=el("div","section plain-sec",'<span class="ps-name"></span><span class="count">'+g.items.length+'</span>'); sec.querySelector(".ps-name").textContent=g.name; wrap.appendChild(sec); }
    var ul=el("ul","list"); g.items.forEach(function(it){ ul.appendChild(itemRow(it)); }); wrap.appendChild(ul);
    attachSortHandles(Array.prototype.slice.call(ul.children), function(ids){ reorderPlainItems(ids); }, 8);
    openFrag.appendChild(wrap);
  });
  if(done.length){
    var s2=el("div","section",'<span class="ps-name"></span><span class="count">'+done.length+'</span>'); s2.querySelector(".ps-name").textContent=lab.doneTitle; doneFrag.appendChild(s2);
    var ul2=el("ul","list"); done.forEach(function(it){ ul2.appendChild(itemRow(it)); }); doneFrag.appendChild(ul2);
    var meta=currentListMeta();
    var fw=el("div","finish-inline");
    var fb=el("button","finish-inline-btn", meta.finish==="terugzetten" ? "Alles terugzetten ↺" : "Opruimen ✓"); fb.type="button";
    fb.addEventListener("click", function(){ finishPlain(); }); fw.appendChild(fb);
    if(meta.finish==="terugzetten"){ var fb2=el("button","finish-inline-btn soft","Opruimen"); fb2.type="button"; fb2.addEventListener("click", function(){ finishPlain("opruimen"); }); fw.appendChild(fb2); }
    doneFrag.appendChild(fw);
  }
}
function reorderPlainItems(ids){
  var pos=[]; state.list.forEach(function(it,i){ if(ids.indexOf(it.id)!==-1) pos.push(i); });
  var byId={}; state.list.forEach(function(it){ byId[it.id]=it; });
  ids.forEach(function(id,k){ if(pos[k]!=null && byId[id]) state.list[pos[k]]=byId[id]; });
  save(); renderLijst();
}
/* Plain-rij: vinkje, tekst (meerregelig), notitie, sleepgreep */
function plainItemRow(it){
  var li=el("li","row"+(it.done?" done":"")); li.dataset.id=it.id;
  li.appendChild(el("div","behind",'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg><span>Verwijder</span>'));
  var card=el("div","card");
  card.innerHTML='<button class="check" type="button" role="checkbox" aria-checked="'+(it.done?"true":"false")+'" aria-label="'+escapeAttr(it.name)+(it.done?" — vinkje weghalen":" afvinken")+'">'+CHECK_SVG+'</button>'+
    '<div class="meta"><div class="nm"></div>'+(it.note?'<div class="sub2"></div>':'')+'</div>'+
    (it.done?'':'<span class="sr-handle" aria-label="Sleep om te verplaatsen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></span>')+
    ((typeof HAS_POINTER!=="undefined" && HAS_POINTER) ? '<div class="row-actions"><button class="ra-btn ra-opt" type="button" aria-label="Opties voor '+escapeAttr(it.name)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg></button><button class="ra-btn ra-del" type="button" aria-label="Verwijder '+escapeAttr(it.name)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div>' : '');
  card.querySelector(".nm").textContent=it.name;
  var sub=card.querySelector(".sub2"); if(sub) sub.textContent=it.note;
  var raOpt=card.querySelector(".ra-opt"), raDel=card.querySelector(".ra-del");
  if(raOpt) raOpt.addEventListener("click",function(e){ e.stopPropagation(); openPlainSheet(it.id); });
  if(raDel) raDel.addEventListener("click",function(e){ e.stopPropagation(); removeFromList(it.id); });
  card.querySelector(".check").addEventListener("click",function(e){ e.stopPropagation(); toggleDone(it.id); });
  var h=card.querySelector(".sr-handle"); if(h){ h.addEventListener("click",function(e){ e.stopPropagation(); }); h.addEventListener("touchstart",function(e){ e.stopPropagation(); },{passive:true}); }
  card.addEventListener("click",function(){ if(card._suppressClick) return; openPlainSheet(it.id); });
  card.setAttribute("role","button"); card.setAttribute("tabindex","0"); card.setAttribute("aria-label", it.name+" — bewerken");
  card.addEventListener("keydown",function(e){ if(e.target!==card) return; if(e.key==="Enter" || e.key===" "){ e.preventDefault(); openPlainSheet(it.id); } });
  li.appendChild(card);
  attachSwipe(card, function(){ removeFromList(it.id); });
  return li;
}
/* Sleepgrepen op bestaande rijen (zelfde mechaniek als de schap-volgorde in Meer) */
function attachSortHandles(rows, onReorder, gap){
  _ensureSortListeners();
  rows.forEach(function(row){
    var handle = row.querySelector(".sr-handle"); if(!handle) return;
    var startDrag = function(clientY){
      _sortState.dragging = row; _sortState.items = rows; _sortState.dragIdx = rows.indexOf(row);
      _sortState.startY = clientY; _sortState.offset = 0; _sortState.onReorder = onReorder; _sortState.gap = gap||6;
      row.classList.add("dragging"); vibrate(8);
    };
    handle.addEventListener("touchstart", function(e){ startDrag(e.touches[0].clientY); e.preventDefault(); }, {passive:false});
    handle.addEventListener("mousedown", function(e){ startDrag(e.clientY); e.preventDefault(); });
  });
}

/* ---------- Winkels: eigen looproute (schapvolgorde) per supermarkt ---------- */
var STORE_PRESETS = {
  ah:    ["groente-fruit","brood-banket","kaas-vleeswaren","vlees-vis","zuivel-eieren","ontbijt-beleg","houdbaar","snoep-snacks","dranken","diepvries","huishouden","verzorging","baby-kind","huisdier","tuin-planten","klussen","apotheek","kantoor-school","kleding-textiel","overig"],
  jumbo: ["groente-fruit","vlees-vis","kaas-vleeswaren","brood-banket","zuivel-eieren","ontbijt-beleg","houdbaar","snoep-snacks","dranken","diepvries","huishouden","verzorging","baby-kind","huisdier","tuin-planten","klussen","apotheek","kantoor-school","kleding-textiel","overig"],
  lidl:  ["brood-banket","groente-fruit","vlees-vis","kaas-vleeswaren","zuivel-eieren","ontbijt-beleg","houdbaar","snoep-snacks","dranken","diepvries","klussen","kleding-textiel","tuin-planten","huishouden","verzorging","baby-kind","huisdier","apotheek","kantoor-school","overig"]
};
function activeStore(){
  var id=state && state.settings && state.settings.activeStoreId; if(!id) return null;
  var stores=state.settings.stores||[];
  for(var i=0;i<stores.length;i++){ if(stores[i].id===id) return stores[i]; }
  return null;
}
function currentCatOrder(){ var st=activeStore(); return (st && Array.isArray(st.order)) ? st.order : (state.settings.categoryOrder||[]); }
function addStore(name, preset){
  var base = (STORE_PRESETS[preset] || state.settings.categoryOrder).slice();
  state.settings.categoryOrder.forEach(function(cid){ if(base.indexOf(cid)===-1) base.push(cid); });   // eigen schappen achteraan
  base = base.filter(function(cid){ return !!CAT_BY_ID[cid]; });
  var s={ id:"st_"+uid(), name:name, order:base };
  state.settings.stores=(state.settings.stores||[]).concat([s]);
  state.settings.activeStoreId=s.id;
  save(); renderStorePick(); if(activeTab==="lijst") renderLijst(); if(shopIsOpen()) renderShopBody();
  return s;
}
function renderStorePick(){
  var wrap=$("#store-pick"); if(!wrap) return;
  var stores=(state.settings && state.settings.stores)||[];
  if(!stores.length || activeTab!=="lijst"){ wrap.innerHTML=""; wrap.className="store-pick empty"; return; }
  wrap.className="store-pick"; wrap.innerHTML="";
  wrap.setAttribute("role","group"); wrap.setAttribute("aria-label","Winkel");
  var mk=function(id,label){
    var on=(state.settings.activeStoreId||null)===id;
    var b=el("button","chip"+(on?" on":""),'<span>'+escapeHtml(label)+'</span>'); b.type="button"; b.setAttribute("aria-pressed", on?"true":"false");
    b.addEventListener("click",function(){ state.settings.activeStoreId=id; save(); renderStorePick(); renderLijst(); if(shopIsOpen()) renderShopBody(); });
    return b;
  };
  wrap.appendChild(mk(null,"Standaard"));
  stores.forEach(function(s){ wrap.appendChild(mk(s.id, s.name)); });
}
function openNewStoreSheet(){
  var sh=$("#sheet"); if(!sh) return;
  var presets=[["ah","Albert Heijn"],["jumbo","Jumbo"],["lidl","Lidl"],["standaard","Zoals standaard"]];
  var chosen="ah";
  sh.innerHTML='<div class="grip"></div><h3>Nieuwe winkel</h3>'+
    '<div class="frow"><div class="fl">Naam</div><input class="txt" id="st-name" placeholder="bijv. AH Stationsstraat" autocomplete="off"></div>'+
    '<div class="sheet-label"><span class="lbl-cap">Begin met de looproute van</span></div><div class="cadrow" id="st-presets"></div>'+
    '<div class="hint" style="margin:0 6px 12px">Daarna sleep je de schappen in Meer → Schappen &amp; winkels tot ze kloppen met de winkel.</div>'+
    '<div class="sheet-actions"><button class="save" id="st-save" type="button">Opslaan</button><button class="del" id="st-cancel" type="button">Annuleren</button></div>';
  var row=sh.querySelector("#st-presets");
  presets.forEach(function(p){
    var b=el("button","cadchip"+(p[0]===chosen?" on":""),p[1]); b.type="button";
    b.addEventListener("click",function(){ chosen=p[0]; row.querySelectorAll(".cadchip").forEach(function(x){ x.classList.toggle("on", x===b); }); var nm=sh.querySelector("#st-name"); if(nm && !nm.value.trim() && p[0]!=="standaard") nm.value=p[1]; });
    row.appendChild(b);
  });
  sh.querySelector("#st-cancel").addEventListener("click", closeSheet);
  sh.querySelector("#st-save").addEventListener("click", function(){
    var name=(sh.querySelector("#st-name").value||"").trim(); if(!name){ toast("Geef de winkel een naam"); return; }
    addStore(name, chosen); closeSheet(); toast(name+" toegevoegd — de lijst volgt nu die looproute"); if(activeTab==="meer") renderMeer();
  });
  openSheetUI();
  setTimeout(function(){ var i=sh.querySelector("#st-name"); if(i) i.focus(); }, 260);
}

function catBuckets(byCat){
  var seen={}, out=[];
  (currentCatOrder()||[]).forEach(function(cid){ seen[cid]=1; if(byCat[cid] && byCat[cid].length) out.push(cid); });
  Object.keys(byCat).forEach(function(cid){ if(!seen[cid] && byCat[cid].length) out.push(cid); });
  return out;
}
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
    if(isPlainList()){
      openFrag.appendChild(emptyState("bag","Nog niets op "+localListName(),"Typ hieronder wat erop moet. Tip: 'Kleding: sokken' zet het onder het kopje Kleding."));
    } else if(typeof Cloud!=="undefined" && Cloud.active){
      openFrag.appendChild(emptyState(
        "bag",
        "Begin je lijst",
        "Tik hieronder om iets toe te voegen — of deel de stuur-link zodat anderen items voor je droppen.",
        "Delen",
        function(){ if(typeof openShareSheet==="function") openShareSheet(Cloud.active); }
      ));
    } else {
      openFrag.appendChild(emptyState("bag","Begin je lijst","Typ hieronder wat je nodig hebt. Producten landen vanzelf in het juiste schap."));
    }
    renderQuickStart(openFrag);
  } else if(isPlainList()){
    renderPlainLists(open, done, openFrag, doneFrag);
  } else {
    // groepeer open per categorie volgens categoryOrder
    var byCat={}; open.forEach(function(it){ var cid = CAT_BY_ID[it.category] ? it.category : "overig"; (byCat[cid]=byCat[cid]||[]).push(it); });
    catBuckets(byCat).forEach(function(cid){
      var arr=byCat[cid]; if(!arr || !arr.length) return;
      var c=CAT_BY_ID[cid]||CAT_BY_ID["overig"];
      var collapsed = !!(state.settings.collapsedCats && state.settings.collapsedCats[cid]);
      var sec=el("button","section collapsible"+(collapsed?" collapsed":""));
      sec.type="button"; sec.setAttribute("aria-expanded", collapsed?"false":"true"); sec.setAttribute("aria-controls","cat-"+cid);
      sec.innerHTML=shelfIcon(c)+'<span>'+escapeHtml(c.label)+'</span><span class="count">'+arr.length+'</span><svg class="sec-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
      var shelf=el("div","shelf"); shelf.dataset.cat=cid;
      shelf.appendChild(sec);
      var ul=el("ul","list"+(collapsed?" collapsed":"")); ul.id="cat-"+cid;
      arr.forEach(function(it){ ul.appendChild(itemRow(it)); });
      shelf.appendChild(ul);
      openFrag.appendChild(shelf);
      sec.addEventListener("click", function(){
        state.settings.collapsedCats = state.settings.collapsedCats || {};
        state.settings.collapsedCats[cid] = !state.settings.collapsedCats[cid];
        save();
        var nowCollapsed = sec.classList.toggle("collapsed");
        ul.classList.toggle("collapsed", nowCollapsed);
        sec.setAttribute("aria-expanded", nowCollapsed?"false":"true");
      });
    });
    if(done.length){
      var s2=el("div","section");
      s2.innerHTML='<span>In mandje</span><span class="count">'+done.length+'</span>';
      doneFrag.appendChild(s2);
      var ul2=el("ul","list"); done.forEach(function(it){ ul2.appendChild(itemRow(it)); });
      doneFrag.appendChild(ul2);
      // Afrond-knop direct onder de afgevinkte items — alleen tonen wanneer de
      // prijzen-totals-bar (met z'n eigen afrond-knop) uit staat, anders dubbel.
      if(!state.settings.showPrices){
        var finishWrap = el("div","finish-inline");
        var finishBtn = el("button","finish-inline-btn","Afronden ✓");
        finishBtn.addEventListener("click", finishShopping);
        finishWrap.appendChild(finishBtn);
        doneFrag.appendChild(finishWrap);
      }
    }
  }
  // Single append per wrap = minimum reflows
  openWrap.appendChild(openFrag);
  doneWrap.appendChild(doneFrag);
  if(_searchQ) applySearchFilter(_searchQ);   // filter overleeft een re-render (was: term bleef staan, filter viel weg)
  updateTotals();
  updateSubhead();
  renderShopEntry();
  renderStorePick();
}

/* FLIP: rijen die door een re-render van plek veranderen (afvinken → "In mandje") glijden naar hun nieuwe plek */
function flipList(renderFn){
  var main=$("#main");
  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if(reduced || !main || activeTab!=="lijst" || document.hidden || typeof main.getBoundingClientRect!=="function"){ renderFn(); return; }
  var before={};
  main.querySelectorAll("li.row[data-id]").forEach(function(li){ before[li.dataset.id]=li.getBoundingClientRect(); });
  renderFn();
  var moved=[];
  main.querySelectorAll("li.row[data-id]").forEach(function(li){
    var b=before[li.dataset.id]; if(!b) return;
    var a=li.getBoundingClientRect(); var dx=b.left-a.left, dy=b.top-a.top;
    if(Math.abs(dx)<2 && Math.abs(dy)<2) return;
    li.style.transition="none"; li.style.transform="translate("+dx+"px,"+dy+"px)"; li.style.zIndex="3";
    moved.push(li);
  });
  if(!moved.length) return;
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    moved.forEach(function(li){ li.style.transition="transform var(--dur-flip) var(--ease-spring)"; li.style.transform=""; });
    setTimeout(function(){ moved.forEach(function(li){ li.style.transition=""; li.style.zIndex=""; }); }, 480);
  }); });
}
function scrollToRow(id){
  var li=document.querySelector('li.row[data-id="'+id+'"]'); if(!li) return;
  try{ li.scrollIntoView({block:"center", behavior:"smooth"}); }catch(e){}
  li.classList.add("flash"); setTimeout(function(){ li.classList.remove("flash"); }, 1200);
}

function itemRow(it){
  if(isPlainList()) return plainItemRow(it);
  var li=el("li","row"+(it.done?" done":"")); li.dataset.id=it.id;
  // Slide-in als item < 600ms geleden toegevoegd
  var addedMs = it.addedAt ? new Date(it.addedAt).getTime() : 0;
  if(addedMs && (Date.now() - addedMs) < 600){
    li.classList.add("entering");
    setTimeout(function(){ li.classList.remove("entering"); }, 360);
  }
  li.appendChild(el("div","behind",'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg><span>Verwijder</span>'));
  var card=el("div","card");

  var sub="";
  if(it.unit) sub+='<span>'+escapeHtml(it.unit)+'</span>';
  if(it.note) sub+=(sub?' · ':'')+'<span>'+escapeHtml(it.note)+'</span>';
  if(state.settings.showPrices && it.price!=null) sub+=(sub?' · ':'')+'<span>'+euro(it.price)+(it.qty>1?' × '+it.qty:'')+'</span>';
  if(Cloud.active){
    var asg = it.assigned_to ? Cloud.memberById(it.assigned_to) : null;
    if(asg) sub+=(sub?' · ':'')+'<span style="color:'+safeColor(asg.color)+';font-weight:700">→ '+escapeHtml(asg.display_name)+'</span>';
    else if(it.added_by_name) sub+=(sub?' · ':'')+'<span style="color:var(--ink-faint)">+ '+escapeHtml(it.added_by_name)+'</span>';
  }

  if(!it.done && (!CAT_BY_ID[it.category] || it.category==="overig")) sub+=(sub?' · ':'')+'<button class="pick-cat" type="button">Schap kiezen</button>';
  card.innerHTML =
    '<button class="check" type="button" role="checkbox" aria-checked="'+(it.done?"true":"false")+'" aria-label="'+escapeAttr(it.name)+(it.done?" — vinkje weghalen":" afvinken")+'">'+CHECK_SVG+'</button>'+
    '<div class="meta"><div class="nm"></div>'+(sub?'<div class="sub2">'+sub+'</div>':'')+'</div>'+
    '<div class="qty"><button class="q-minus" type="button" aria-label="Minder '+escapeAttr(it.name)+'">–</button><span aria-live="polite">'+it.qty+'</span><button class="q-plus" type="button" aria-label="Meer '+escapeAttr(it.name)+'">+</button></div>'+
    (state.settings.showPrices && it.price!=null ? '<div class="price">'+euro(it.price*it.qty)+'</div>' : '')+
    ((typeof HAS_POINTER!=="undefined" && HAS_POINTER) ? '<div class="row-actions"><button class="ra-btn ra-opt" type="button" aria-label="Opties voor '+escapeAttr(it.name)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg></button><button class="ra-btn ra-del" type="button" aria-label="Verwijder '+escapeAttr(it.name)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div>' : '');
  card.querySelector(".nm").textContent=it.name;
  var pickCat=card.querySelector(".pick-cat"); if(pickCat) pickCat.addEventListener("click",function(e){ e.stopPropagation(); openSheet(it.id); });
  var raOpt=card.querySelector(".ra-opt"), raDel=card.querySelector(".ra-del");
  if(raOpt) raOpt.addEventListener("click",function(e){ e.stopPropagation(); openSheet(it.id); });
  if(raDel) raDel.addEventListener("click",function(e){ e.stopPropagation(); removeFromList(it.id); });

  card.querySelector(".check").addEventListener("click",function(e){ e.stopPropagation(); toggleDone(it.id); });
  card.querySelector(".q-minus").addEventListener("click",function(e){ e.stopPropagation(); setQty(it.id,-1); });
  card.querySelector(".q-plus").addEventListener("click",function(e){ e.stopPropagation(); setQty(it.id,1); });
  card.addEventListener("click",function(){ if(card._suppressClick) return; openSheet(it.id); });
  // Toetsenbord-toegang: de kaart zelf opent het detail-sheet (Enter). Interne knoppen
  // (afvinken/qty) hebben hun eigen focus; daarom alleen reageren als de kaart zélf de target is.
  card.setAttribute("role","button");
  card.setAttribute("tabindex","0");
  card.setAttribute("aria-label", it.name+" — details en opties");
  card.addEventListener("keydown",function(e){
    if(e.target!==card) return;
    if(e.key==="Enter" || e.key===" "){ e.preventDefault(); openSheet(it.id); }
  });

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
  var progWrap=$("#t-prog-wrap"); if(progWrap) progWrap.style.display=hasPrices?"":"none";
  var show = activeTab==="lijst" && state.list.length>0 && state.settings.showPrices && T().prices;
  $("#totals").classList.toggle("hide", !show);
  $("#pad-lijst").className = "pad-bottom"+(show?" with-total":"");
  // has-total verkort het scrollgebied tot bóven de totaalbalk → de balk dekt nooit items af
  document.body.classList.toggle("has-total", show);
  renderForgottenSuggest(doneItems);
  maybePriceNudge();
}

/* Eenmalige nudge: gebruiker met een volle lijst maar prijzen uit mist het
   lopend-totaal. Toon 1× een toast met directe toegang tot de toggle. */
function maybePriceNudge(){
  if(!state || !state.settings) return;
  if(state.settings.showPrices || state.settings.seenPriceNudge) return;
  if(activeTab!=="lijst") return;
  var open = state.list.filter(function(i){return !i.done;}).length;
  if(open < 8) return;
  state.settings.seenPriceNudge = true; save();
  toast("Wil je een lopend totaal? Zet prijzen aan in Meer", {duration:4000, action:"Aanzetten", onAction:function(){
    state.settings.showPrices = true; save();
    applyPriceVisibility(); renderLijst();
    toast("Prijzen staan aan — tik een product om de prijs te zetten", {duration:3000});
  }});
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
  var bullet = " " + String.fromCharCode(0xb7) + " ";
  var waiting = 0, doneCount = 0;
  if(state && Array.isArray(state.list)){
    state.list.forEach(function(i){
      if(i && i.done) doneCount++;
      else waiting++;
    });
  }
  var parts = [];
  if(activeTab==="lijst"){
    var lab=listLabels(), plain=isPlainList();
    if(state.list.length===0){ parts.push(plain ? "Nog niets op de lijst" : "Je mandje is leeg"); }
    else {
      parts.push(waiting===0 ? (plain ? "Alles "+lab.done : "Alles in het mandje") : waiting + " " + lab.open);
      if(doneCount>0 && waiting>0) parts.push(doneCount + " " + lab.done);
    }
    if(state.settings && state.settings.showPrices && T().prices){
      var total = 0; state.list.forEach(function(i){ total += (i.price||0) * (i.qty||1); });
      if(total>0) parts.push(euro(total));
    }
    // gedeelde lijst: met wie
    if(typeof Cloud !== "undefined" && Cloud && Cloud.active && Array.isArray(Cloud.members)){
      var names = Cloud.members.filter(function(m){ return m && m.user_id !== Cloud.userId; })
                               .map(function(m){ return String(m.display_name||"").trim().split(/\s+/)[0]; })
                               .filter(Boolean);
      if(names.length===1) parts.push("met " + names[0]);
      else if(names.length===2) parts.push("met " + names[0] + " en " + names[1]);
      else if(names.length>2) parts.push("met " + names[0] + " en " + (names.length-1) + " anderen");
    }
    if(typeof navigator !== "undefined" && navigator.onLine === false) parts.push("offline");
  } else if(activeTab==="vaste"){
    parts.push("Vaste boodschappen");
  } else if(activeTab==="meer"){
    parts.push("Instellingen en meer");
  } else {
    parts.push("Overzicht");
  }
  $("#subhead").textContent = parts.join(bullet);
}

/* ---------- "Bijna op" banner ---------- */
var WEEKDAYS=["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];
/* Afgeleide boodschappendag: meest voorkomende weekdag in de koopgeschiedenis (≥6 aankopen, ≥35% op één dag) */
function shoppingWeekday(){
  var counts=[0,0,0,0,0,0,0], total=0;
  Object.keys(state.catalog||{}).forEach(function(k){
    (state.catalog[k].purchaseDates||[]).forEach(function(d){ var wd=parseDay(d).getDay(); if(!isNaN(wd)){ counts[wd]++; total++; } });
  });
  if(total<6) return null;
  var best=0; for(var i=1;i<7;i++){ if(counts[i]>counts[best]) best=i; }
  return counts[best]/total >= 0.35 ? best : null;
}
/* "Klaar voor de week?" — op de boodschappendag, bij een (bijna) lege lijst, met de drie snelste startzetten */
function renderWeekRitual(){
  var wrap=$("#week-ritual"); if(!wrap) return; wrap.innerHTML="";
  if(activeTab!=="lijst") return;
  var wd=shoppingWeekday(); if(wd===null || wd!==new Date().getDay()) return;
  if(state.settings.ritualDismissed===todayStr()) return;
  if(state.list.filter(function(i){return !i.done;}).length>=4) return;
  var due=getDueItems(), last=(state.history||[])[0], meals=(typeof mealList==="function")?mealList():[];
  if(!due.length && !(last && last.items && last.items.length) && !meals.length) return;
  var c=el("div","ritual");
  c.innerHTML='<button class="r-x" type="button" aria-label="Vandaag niet meer tonen">✕</button><h4>Klaar voor de week?</h4><p>Het is '+WEEKDAYS[wd]+' — meestal je boodschappendag.</p><div class="chips"></div>';
  var chips=c.querySelector(".chips");
  if(due.length){
    var b1=el("button","chip",'<span>Vaste erop</span><span class="plus">'+due.length+'</span>'); b1.type="button";
    b1.addEventListener("click",function(){ var n=0; due.forEach(function(d){ if(addToList(d.e.name, d.e.defaultPrice, {silent:true})) n++; }); toast(n+(n===1?" vaste boodschap":" vaste boodschappen")+" toegevoegd"); });
    chips.appendChild(b1);
  }
  if(last && last.items && last.items.length){
    var b2=el("button","chip",'<span>Herhaal vorige lijst</span><span class="plus">'+last.items.length+'</span>'); b2.type="button";
    b2.addEventListener("click", repeatLastTrip); chips.appendChild(b2);
  }
  if(meals.length){
    var b3=el("button","chip",'<span>Bundels</span><span class="plus">→</span>'); b3.type="button";
    b3.addEventListener("click",function(){ switchTab("vaste"); }); chips.appendChild(b3);
  }
  c.querySelector(".r-x").addEventListener("click",function(){ state.settings.ritualDismissed=todayStr(); save(); wrap.innerHTML=""; });
  wrap.appendChild(c);
}
function renderDueBanner(){
  var wrap=$("#due-banner"); wrap.innerHTML="";
  if(!T().cadence){ var wr=$("#week-ritual"); if(wr) wr.innerHTML=""; return; }
  renderWeekRitual();
  if(activeTab!=="lijst") return;
  var due=getDueItems(); if(!due.length) return;
  var top=due.slice(0,6);
  var b=el("div","banner");
  b.innerHTML='<div class="b-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg><span class="b-title">Bijna op — koop je waarschijnlijk weer</span><button class="b-dismiss" type="button" aria-label="Verberg tot morgen">✕</button></div>';
  var dismissBtn = b.querySelector(".b-dismiss");
  if(dismissBtn) dismissBtn.addEventListener("click", dismissDueBanner);
  var chips=el("div","chips");
  top.forEach(function(d){
    var c=CAT_BY_ID[d.e.category]||CAT_BY_ID["overig"];
    var wrapC=el("div","chip-wrap");
    var chip=el("button","chip amber",shelfIcon(c)+'<span>'+escapeHtml(d.e.name)+'</span><span class="plus">+</span>');
    chip.type="button"; chip.setAttribute("aria-label", d.e.name+" toevoegen (lang indrukken: een week uitstellen)");
    chip.addEventListener("click",function(){ if(chip._lp){ chip._lp=false; return; } addToList(d.e.name, d.e.defaultPrice); });
    attachLongPress(chip, function(){ chip._lp=true; snoozeDue(d.key, 7); });
    var x=el("button","chip-x","✕"); x.type="button"; x.setAttribute("aria-label", d.e.name+" verbergen tot morgen");
    x.addEventListener("click",function(e){ e.stopPropagation(); dismissDueItem(d.key); });
    wrapC.appendChild(chip); wrapC.appendChild(x); chips.appendChild(wrapC);
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
   WINKELMODUS — focus-scherm voor in de winkel
   Los overlay (#shop-screen): grote tikdoelen, schap-volgorde, voortgang.
   Raakt de normale lijst-render niet; deelt state + toggle/finish.
   ============================================================ */
function renderShopEntry(){
  var wrap=$("#shop-entry"); if(!wrap) return;
  var open=state.list.filter(function(i){return !i.done;}).length;
  if(activeTab!=="lijst" || open<1 || !T().shop){ wrap.innerHTML=""; return; }
  wrap.innerHTML="";
  var b=el("button","shop-enter-btn",
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>'+
    '<span>Winkelen</span><span class="shop-enter-count">'+open+'</span>');
  b.addEventListener("click", openShoppingMode);
  wrap.appendChild(b);
}
/* ---------- Winkelmodus: chrome (kop, balk, voet) wordt één keer gebouwd; afvinken wijzigt alleen de rij.
   De rij blijft op zijn plek (gedimd, doorgestreept) zodat je duim blijft waar hij was. ---------- */
var _wakeLock = null, _lijstDirty = false;
function requestWakeLock(){
  try{
    if(!navigator.wakeLock || document.visibilityState!=="visible") return;
    navigator.wakeLock.request("screen").then(function(l){ _wakeLock=l; l.addEventListener("release", function(){ _wakeLock=null; }); }).catch(function(){});
  }catch(e){}
}
function releaseWakeLock(){ try{ if(_wakeLock){ _wakeLock.release().catch(function(){}); _wakeLock=null; } }catch(e){} }
function shopIsOpen(){ var scr=$("#shop-screen"); return !!(scr && scr.classList.contains("show")); }

function openShoppingMode(){
  var scr=$("#shop-screen"); if(!scr || !T().shop) return;
  buildShopChrome(scr);
  scr.classList.toggle("hide-done", !!(state.settings && state.settings.shopHideDone));
  scr.classList.add("show");
  modalOpen(scr, closeShoppingMode);
  renderShopBody();
  requestWakeLock();
}
function closeShoppingMode(){
  var scr=$("#shop-screen");
  if(scr && scr.classList.contains("show")){ scr.classList.remove("show"); modalClose(scr); }
  releaseWakeLock();
  if(_lijstDirty){ _lijstDirty=false; renderLijst(); renderDueBanner(); }
}
function buildShopChrome(scr){
  if(scr.querySelector("#shop-body")) return;
  scr.innerHTML =
    '<div class="shop-head">'+
      '<button class="shop-close" id="shop-close" type="button" aria-label="Sluiten">'+CLOSE_SVG+'</button>'+
      '<div class="shop-title">Winkelen<small id="shop-store"></small></div>'+
      '<div class="shop-count" id="shop-count" aria-live="polite"></div>'+
    '</div>'+
    '<div class="shop-pbar" id="shop-pbar" role="progressbar" aria-label="Voortgang" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>'+
    '<div class="shop-body" id="shop-body"></div>'+
    '<div class="shop-foot">'+
      '<form class="shop-add" id="shop-add" autocomplete="off">'+
        '<input id="shop-add-name" type="search" inputmode="text" placeholder="Nog iets? bijv. melk 2" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" aria-label="Product toevoegen">'+
        '<button type="submit" class="shop-add-btn" aria-label="Toevoegen">+</button>'+
      '</form>'+
      '<div class="shop-foot-row">'+
        '<button type="button" class="shop-hide" id="shop-hide" aria-pressed="false">Verberg afgevinkte</button>'+
        '<button type="button" class="shop-finish" id="shop-finish">Afronden ✓</button>'+
      '</div>'+
    '</div>';
  scr.querySelector("#shop-close").addEventListener("click", closeShoppingMode);
  scr.querySelector("#shop-add").addEventListener("submit", function(e){
    e.preventDefault();
    var inp=scr.querySelector("#shop-add-name"); var p=parseQtyFromInput(inp.value||""); if(!p.name) return;
    if(addToList(p.name, null, {qty:p.qty, unit:p.unit, silent:true})){
      inp.value=""; vibe("tick");
      renderShopBody();
      var k=norm(p.name), row=null;
      scr.querySelectorAll("#shop-body .shop-row").forEach(function(r){ if(!row && norm(r.dataset.name||"")===k) row=r; });
      if(row){ row.classList.add("flash"); try{ row.scrollIntoView({block:"nearest", behavior:"smooth"}); }catch(x){} setTimeout(function(){ row.classList.remove("flash"); }, 1200); }
      var it=state.list.find(function(i){ return !i.done && norm(i.name)===k; });
      var c=it ? (CAT_BY_ID[it.category]||CAT_BY_ID["overig"]) : null;
      toast(p.name+(c?" → "+c.label:""), {duration:1400});
    }
  });
  scr.querySelector("#shop-hide").addEventListener("click", function(){
    var on=!scr.classList.contains("hide-done");
    scr.classList.toggle("hide-done", on);
    this.setAttribute("aria-pressed", on?"true":"false");
    this.textContent = on ? "Toon afgevinkte" : "Verberg afgevinkte";
    state.settings.shopHideDone = on; save();
  });
  scr.querySelector("#shop-finish").addEventListener("click", function(){ finishShopping(); });
}
function shopRow(it){
  var row=el("button","shop-row"+(it.done?" done":"")); row.type="button";
  row.dataset.id=it.id; row.dataset.name=it.name;
  row.setAttribute("role","checkbox"); row.setAttribute("aria-checked", it.done?"true":"false");
  row.innerHTML='<span class="shop-check" aria-hidden="true">'+CHECK_SVG+'</span><span class="shop-name"></span>'+(it.qty>1?'<span class="shop-qty">'+it.qty+(it.unit?' '+escapeHtml(it.unit):'')+'</span>':(it.unit?'<span class="shop-qty">'+escapeHtml(it.unit)+'</span>':''));
  row.querySelector(".shop-name").textContent=it.name;
  row.addEventListener("click", function(){ shopToggle(it.id); });
  return row;
}
function shopToggle(id){
  var it=state.list.find(function(i){return i.id===id;}); if(!it) return;
  if(typeof Cloud!=="undefined" && Cloud.active){ Cloud.toggle(id, {quiet:true}); }
  else { it.done=!it.done; if(it.done) vibe("tick"); save(); _lijstDirty=true; }
  shopUpdateRow(id);
}
/* Alleen de rij, het schap, de teller en de balk bijwerken — geen herbouw, geen scroll-sprong */
function shopUpdateRow(id){
  var scr=$("#shop-screen"); if(!scr || !scr.classList.contains("show")) return;
  var it=state.list.find(function(i){return i.id===id;});
  var row=scr.querySelector('.shop-row[data-id="'+id+'"]');
  if(!it || !row){ renderShopBody(); return; }
  row.classList.toggle("done", !!it.done);
  row.setAttribute("aria-checked", it.done?"true":"false");
  var shelf=row.closest(".shelf");
  if(shelf){
    var rows=shelf.querySelectorAll(".shop-row"), all=rows.length>0;
    rows.forEach(function(r){ if(!r.classList.contains("done")) all=false; });
    var was=shelf.classList.contains("all-done");
    shelf.classList.toggle("all-done", all);
    if(all && !was && it.done){ shelf.classList.add("celebrate"); setTimeout(function(){ shelf.classList.remove("celebrate"); }, 900); }
  }
  shopRefreshMeta();
}
function shopRefreshMeta(){
  var scr=$("#shop-screen"); if(!scr) return;
  var total=state.list.length, done=state.list.filter(function(i){return i.done;}).length;
  var pct = total ? Math.round(done/total*100) : 0;
  var cnt=scr.querySelector("#shop-count");
  if(cnt){
    var txt = total ? (done+" / "+total) : "";
    if(state.settings.showPrices){ var cart=0; state.list.forEach(function(i){ if(i.done) cart+=(i.price||0)*(i.qty||1); }); if(cart>0) txt += " · "+euro(cart); }
    cnt.textContent = txt;
  }
  var ss=scr.querySelector("#shop-store"); if(ss){ var st=activeStore(); ss.textContent = st ? st.name : ""; }
  var pbar=scr.querySelector("#shop-pbar"); if(pbar){ pbar.querySelector("i").style.width=pct+"%"; pbar.setAttribute("aria-valuenow", String(pct)); }
  var fin=scr.querySelector("#shop-finish"); if(fin){ fin.textContent = done ? "Afronden ✓ · "+done : "Afronden ✓"; fin.disabled = !done; fin.classList.toggle("ready", done>0); }
  var hide=scr.querySelector("#shop-hide"); if(hide){ var on=scr.classList.contains("hide-done"); hide.setAttribute("aria-pressed", on?"true":"false"); hide.textContent = on ? "Toon afgevinkte" : "Verberg afgevinkte"; hide.hidden = done===0 && !on; }
  var body=scr.querySelector("#shop-body"), msg=scr.querySelector(".shop-alldone");
  if(body && total && done===total){ if(!msg){ body.appendChild(el("div","shop-alldone",'<div class="sa-ico" aria-hidden="true">'+(typeof HERO_BASKET_SVG!=="undefined"?HERO_BASKET_SVG:"")+'</div><h3>Alles in het mandje!</h3><p>Tik op Afronden — dan onthoudt Mandje wat je kocht.</p>')); } }
  else if(msg){ msg.remove(); }
}
/* Volledige herbouw van de body (openen, realtime-refresh, na toevoegen) — scrollpositie blijft bewaard */
function renderShopBody(){
  var scr=$("#shop-screen"); if(!scr || !scr.classList.contains("show")) return;
  buildShopChrome(scr);
  var body=scr.querySelector("#shop-body"); var keepScroll=body.scrollTop;
  body.innerHTML="";
  if(!state.list.length){ body.innerHTML='<div class="shop-empty">Niks op je lijst — typ hieronder wat je nodig hebt.</div>'; shopRefreshMeta(); return; }
  var byCat={}; state.list.forEach(function(it){ var cid = CAT_BY_ID[it.category] ? it.category : "overig"; (byCat[cid]=byCat[cid]||[]).push(it); });
  catBuckets(byCat).forEach(function(cid){
    var arr=byCat[cid]; if(!arr||!arr.length) return;
    var c=CAT_BY_ID[cid]||CAT_BY_ID["overig"];
    var shelf=el("div","shelf"); shelf.dataset.cat=cid;
    var allDone = arr.every(function(i){ return i.done; });
    if(allDone) shelf.classList.add("all-done");
    shelf.appendChild(el("div","shop-sec",shelfIcon(c)+'<span>'+escapeHtml(c.label)+'</span><span class="shop-sec-ok" aria-hidden="true">✓</span>'));
    arr.forEach(function(it){ shelf.appendChild(shopRow(it)); });
    body.appendChild(shelf);
  });
  shopRefreshMeta();
  body.scrollTop=keepScroll;
}
function renderShoppingMode(){ renderShopBody(); }
document.addEventListener("visibilitychange", function(){ if(document.visibilityState==="visible" && shopIsOpen()) requestWakeLock(); });

/* ============================================================
   RENDER — Vaste-tab
   ============================================================ */
function renderVaste(){
  var wrap=$("#vaste-content"); wrap.innerHTML="";
  renderBundlesSection(wrap);
  var rec=getRecurring();
  var due=rec.filter(function(r){return isDue(r.a);});
  var rest=rec.filter(function(r){return !isDue(r.a);});

  var freq=frequentItems(12);
  if(rec.length===0 && !freq.length){
    wrap.appendChild(emptyState("repeat","Nog geen vaste boodschappen","Mandje leert vanzelf wat je vaak koopt. Streep items af en tik op Afronden — na zo'n 3 à 4 keer verschijnen ze hier op jouw ritme. Liever zelf bepalen? Stel een ritme in via een product op je lijst."));
    renderCatalogSection(wrap);
    return;
  }
  if(rec.length===0){
    wrap.appendChild(el("div","hint","Mandje leert vanzelf wat je vaak koopt — na zo'n 3 à 4 keer afronden verschijnen producten hier op hun ritme."));
  }
  if(due.length){
    wrap.appendChild(sectionLabel("🔔","Bijna op",due.length));
    var u1=el("ul","list"); due.forEach(function(r){ u1.appendChild(vasteRow(r)); }); wrap.appendChild(u1);
  }
  if(rest.length){
    wrap.appendChild(sectionLabel("🔁","Jouw vaste boodschappen",rest.length));
    var u2=el("ul","list"); rest.forEach(function(r){ u2.appendChild(vasteRow(r)); }); wrap.appendChild(u2);
  }
  if(freq.length){
    wrap.appendChild(sectionLabel("⭐","Vaak gekocht",freq.length));
    var fchips=el("div","chips freq-chips"); freq.forEach(function(e){ fchips.appendChild(quickChip(e)); }); wrap.appendChild(fchips);
  }
  renderCatalogSection(wrap);
}
function sectionLabel(glyph,label,count){
  var s=el("div","section"); s.innerHTML='<span class="cat-emoji">'+glyph+'</span><span>'+label+'</span><span class="count">'+count+'</span>'; return s;
}

/* ============================================================
   MAALTIJDEN / BUNDELS — een setje producten in één tik
   Lokaal opgeslagen (state.meals); syncen optioneel via Supabase (Cloud.saveMeal).
   Toevoegen werkt op elke actieve lijst (persoonlijk of gedeeld) via addToList.
   ============================================================ */
function mealList(){
  var ms = state.meals || {};
  return Object.keys(ms).map(function(k){ return ms[k]; })
    .sort(function(a,b){ return (a.name||"").localeCompare(b.name||"","nl"); });
}
function addMeal(name, emoji, items){
  name=(name||"").trim(); if(!name) return null;
  var id="meal_"+uid();
  state.meals = state.meals || {};
  state.meals[id] = { id:id, name:name, emoji:emoji||"🍽️", items:items||[], updatedAt:nowISO() };
  save();
  if(typeof Cloud!=="undefined" && Cloud.saveMeal) Cloud.saveMeal(state.meals[id]);
  return id;
}
function updateMeal(id, name, emoji, items){
  var m = state.meals && state.meals[id]; if(!m) return;
  if(name!=null) m.name=name; if(emoji) m.emoji=emoji; if(items) m.items=items;
  m.updatedAt=nowISO(); save();
  if(typeof Cloud!=="undefined" && Cloud.saveMeal) Cloud.saveMeal(m);
}
function deleteMeal(id){
  if(!state.meals || !state.meals[id]) return;
  delete state.meals[id]; save();
  if(typeof Cloud!=="undefined" && Cloud.deleteMeal) Cloud.deleteMeal(id);
}
function addMealToList(id){
  var m = state.meals && state.meals[id]; if(!m || !m.items || !m.items.length) return;
  var n=0;
  m.items.forEach(function(it){ if(addToList(it.name, null, {qty:it.qty||1, unit:it.unit||"", silent:true})) n++; });
  vibe("tick");
  switchTab("lijst");
  toast(m.name+" toegevoegd · "+n+" "+(n===1?"product":"producten"));
}
function renderBundlesSection(wrap){
  var meals = mealList();
  var sec = el("div","section");
  sec.innerHTML='<span class="cat-emoji emoji">🍽️</span><span>Bundels</span><span class="count">'+meals.length+'</span><span class="spacer"></span>';
  var add = el("button","more-link","+ Nieuwe");
  add.addEventListener("click", function(){ buildMealEditor(null); });
  sec.appendChild(add);
  wrap.appendChild(sec);
  if(!meals.length){
    wrap.appendChild(el("div","hint","Maak een bundel (bijv. “Pasta-avond”) en voeg 'm in één tik toe — ook aan een gedeelde lijst."));
    return;
  }
  var ul=el("ul","list");
  meals.forEach(function(m){ ul.appendChild(mealRow(m)); });
  wrap.appendChild(ul);
}
function mealRow(m){
  var n=(m.items||[]).length;
  var li=el("li");
  var div=el("div","vrow");
  div.innerHTML=
    '<div class="vemoji emoji">'+(m.emoji||"🍽️")+'</div>'+
    '<div class="vmeta"><div class="vname"></div><div class="vcad">'+n+' '+(n===1?'product':'producten')+'</div></div>'+
    '<button class="vadd" aria-label="Toevoegen aan lijst">+</button>';
  div.querySelector(".vname").textContent=m.name;
  div.querySelector(".vadd").addEventListener("click", function(e){ e.stopPropagation(); addMealToList(m.id); });
  div.addEventListener("click", function(){ buildMealEditor(m.id); });
  li.appendChild(div);
  return li;
}
function buildMealEditor(id){
  var m = (id && state.meals) ? state.meals[id] : null;
  var picked = m ? (m.emoji||"🍽️") : "🍽️";
  var sh=$("#sheet"); if(!sh) return;
  var emojis = EMOJI_SET.map(function(em){
    return '<button class="ep-cell'+(em===picked?" on":"")+'" data-em="'+em+'" type="button">'+em+'</button>';
  }).join("");
  var itemsText = m ? (m.items||[]).map(function(it){
    return it.name + (it.unit?(" "+it.unit):(it.qty>1?(" x"+it.qty):""));
  }).join("\n") : "";
  sh.innerHTML = '<div class="grip"></div>'+
    '<h3>'+(m?"Bundel bewerken":"Nieuwe bundel")+'</h3>'+
    '<div class="sheet-label"><span class="lbl-cap">Naam</span></div>'+
    '<div class="frow"><input class="txt" id="ml-name" placeholder="Bijv. Pasta-avond, Ontbijt, Weekend" autocapitalize="sentences" autocomplete="off" value="'+escapeAttr(m?m.name:"")+'"></div>'+
    '<div class="sheet-label"><span class="lbl-cap">Pictogram</span><span class="lbl-hint">tik om te kiezen</span></div>'+
    '<div class="emoji-picker" id="ml-emojis">'+emojis+'</div>'+
    '<div class="sheet-label"><span class="lbl-cap">Producten</span><span class="lbl-hint">één per regel</span></div>'+
    '<textarea class="io" id="ml-items" placeholder="Pasta&#10;Pastasaus&#10;Gehakt 500g&#10;Parmezaan" autocapitalize="sentences" autocomplete="off" spellcheck="false">'+escapeHtml(itemsText)+'</textarea>'+
    '<div class="sheet-actions">'+
      '<button class="save" id="ml-save">'+(m?"Opslaan":"Aanmaken")+'</button>'+
      (m?'<button class="del" id="ml-del">Verwijder</button>':'<button class="del" id="ml-cancel">Annuleren</button>')+
    '</div>';
  openSheetUI();
  setTimeout(function(){ var i=$("#ml-name"); if(i) i.focus(); }, 260);
  sh.querySelectorAll("#ml-emojis .ep-cell").forEach(function(b){
    b.addEventListener("click", function(){
      sh.querySelectorAll("#ml-emojis .ep-cell").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on"); picked=b.dataset.em;
    });
  });
  var cancel=$("#ml-cancel"); if(cancel) cancel.addEventListener("click", closeSheet);
  var del=$("#ml-del"); if(del) del.addEventListener("click", function(){
    var snap = m ? { name:m.name, emoji:m.emoji, items:(m.items||[]).slice() } : null;
    deleteMeal(id); closeSheet(); renderVaste();
    if(snap) undoToast("Bundel verwijderd", function(){ addMeal(snap.name, snap.emoji, snap.items); renderVaste(); });
  });
  $("#ml-save").addEventListener("click", function(){
    var nm=($("#ml-name").value||"").trim(); if(!nm){ toast("Geef de bundel een naam"); return; }
    var lines=($("#ml-items").value||"").split(/[\r\n,]+/).map(function(l){return l.trim();}).filter(Boolean);
    var items=lines.map(function(line){ var p=parseQtyFromInput(line); return { name:p.name, qty:p.qty, unit:p.unit||"" }; })
                   .filter(function(it){ return it.name; });
    if(m){ updateMeal(id, nm, picked, items); } else { addMeal(nm, picked, items); }
    closeSheet(); renderVaste(); toast(m?"Bundel opgeslagen":"Bundel aangemaakt");
  });
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
    shelfIcon(c,{bubble:true})+
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
var TEXT_SCALES=[[1,"Normaal"],[1.12,"Groot"],[1.25,"Extra groot"]];
function applyTextScale(){
  var v=Number(state && state.settings && state.settings.textScale)||1;
  if(!(v>=1 && v<=1.5)) v=1;
  document.documentElement.style.setProperty("--text-scale", String(v));
}
/* iPadOS meldt zich als "MacIntel" — maxTouchPoints maakt het verschil */
function isIOSDevice(){
  var ua=navigator.userAgent||"", plat=navigator.platform||"";
  return /iP(hone|ad|od)/.test(plat) || /iP(hone|ad|od)/.test(ua) || (plat==="MacIntel" && (navigator.maxTouchPoints||0)>1);
}
var _installPrompt=null;   // Chromium: uitgesteld beforeinstallprompt-event (Android/desktop)

function renderMeer(){
  var wrap=$("#meer-content"); wrap.innerHTML="";
  function section(label, extra){ wrap.appendChild(el("div","section",'<span>'+label+'</span>'+(extra||""))); }
  function segGroup(label, options, current, onPick){
    var seg=el("div","seg"); seg.setAttribute("role","group"); seg.setAttribute("aria-label",label);
    options.forEach(function(o){
      var on = String(o[0])===String(current);
      var b=el("button",on?"on":"",o[1]); b.type="button"; b.setAttribute("aria-pressed", on?"true":"false");
      b.addEventListener("click",function(){ onPick(o[0]); });
      seg.appendChild(b);
    });
    return seg;
  }
  function switchBtn(label, on, onToggle){
    var sw=el("button","switch"+(on?" on":"")); sw.type="button";
    sw.setAttribute("role","switch"); sw.setAttribute("aria-label",label); sw.setAttribute("aria-checked", on?"true":"false");
    sw.addEventListener("click", onToggle);
    return sw;
  }

  // ---- Weergave
  section("Weergave");
  var g1=el("div","group");
  var themeRow=el("div","grow wrap"); themeRow.innerHTML='<div class="glabel">Thema</div>';
  themeRow.appendChild(segGroup("Thema", [["auto","Auto"],["light","Licht"],["dark","Donker"]], state.settings.theme, function(v){ state.settings.theme=v; save(); applyTheme(); renderMeer(); }));
  g1.appendChild(themeRow);
  var tsRow=el("div","grow wrap"); tsRow.innerHTML='<div class="glabel">Tekstgrootte</div>';
  tsRow.appendChild(segGroup("Tekstgrootte", TEXT_SCALES, Number(state.settings.textScale)||1, function(v){ state.settings.textScale=Number(v); save(); applyTextScale(); renderMeer(); }));
  g1.appendChild(tsRow);
  var priceRow=el("div","grow");
  priceRow.innerHTML='<div class="glabel">Prijzen bijhouden<div class="gsub">Toon een prijs per product en een lopend totaal</div></div>';
  priceRow.appendChild(switchBtn("Prijzen bijhouden", !!state.settings.showPrices, function(){ state.settings.showPrices=!state.settings.showPrices; save(); applyPriceVisibility(); renderLijst(); renderMeer(); }));
  g1.appendChild(priceRow);
  var hapRow=el("div","grow");
  hapRow.innerHTML='<div class="glabel">Trilfeedback<div class="gsub">Korte trilling bij afvinken en toevoegen (Android)</div></div>';
  hapRow.appendChild(switchBtn("Trilfeedback", state.settings.haptics!==false, function(){ state.settings.haptics = (state.settings.haptics===false); save(); renderMeer(); if(state.settings.haptics) vibe("tick"); }));
  g1.appendChild(hapRow);
  wrap.appendChild(g1);

  var standaloneP = (navigator.standalone===true) || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  var isApple = isIOSDevice();

  // ---- Meldingen (web push) — alleen zichtbaar zodra push is geconfigureerd (VAPID-key + backend)
  if(typeof Cloud!=="undefined" && Cloud.pushEnabled && Cloud.pushEnabled()){
    section("Meldingen");
    var gP=el("div","group");
    if(isApple && !standaloneP){
      gP.appendChild(el("div","grow",'<div class="glabel">Herinneringen<div class="gsub">Zet Mandje eerst op je beginscherm (zie hieronder) om meldingen te kunnen krijgen.</div></div>'));
    } else {
      var remRow=el("div","grow");
      remRow.innerHTML='<div class="glabel">Herinneringen<div class="gsub">Een dagelijkse herinnering om je lijst te checken.</div></div>';
      // De eigen voorkeur is de bron van waarheid — niet de OS-permissie (die blijft 'granted' na uitzetten)
      var onP = !!(state.settings.pushOn) && (typeof Notification!=="undefined" && Notification.permission==="granted");
      var rsw = switchBtn("Herinneringen", onP, function(){
        if(rsw.classList.contains("on")){ Cloud.unsubscribePush(); rsw.classList.remove("on"); rsw.setAttribute("aria-checked","false"); toast("Herinneringen uit"); }
        else { Cloud.subscribeToPush().then(function(ok){ if(ok){ rsw.classList.add("on"); rsw.setAttribute("aria-checked","true"); toast("Herinneringen aan ✓"); } else { toast("Toestemming geweigerd"); } }); }
      });
      remRow.appendChild(rsw);
      gP.appendChild(remRow);
    }
    wrap.appendChild(gP);
  }

  // ---- Op je beginscherm: Chromium-knop / iOS-uitleg / overig
  section("Op je beginscherm");
  var gI=el("div","group");
  if(standaloneP){
    gI.appendChild(el("div","grow",'<div class="glabel">Mandje staat op je beginscherm<div class="gsub">Opent als app, werkt offline en kan meldingen ontvangen.</div></div><span class="gval ok" aria-hidden="true">✓</span>'));
  } else if(_installPrompt){
    var iRow=el("div","grow");
    iRow.innerHTML='<div class="glabel">Zet Mandje op je beginscherm<div class="gsub">Opent als app, werkt offline en laadt sneller.</div></div>';
    var iBtn=el("button","mbtn inline","Installeren"); iBtn.type="button";
    iBtn.addEventListener("click",function(){
      var p=_installPrompt; if(!p) return;
      try{ p.prompt(); }catch(e){}
      (p.userChoice||Promise.resolve()).then(function(){ _installPrompt=null; if(activeTab==="meer") renderMeer(); }).catch(function(){});
    });
    iRow.appendChild(iBtn); gI.appendChild(iRow);
  } else if(isApple){
    gI.appendChild(el("div","grow",'<div class="glabel">Zet Mandje op je beginscherm<div class="gsub">Tik in Safari op <b>Delen</b> (het vierkant met de pijl omhoog) en kies <b>“Zet op beginscherm”</b>. Daarna opent Mandje als app en kan hij meldingen sturen.</div></div>'));
  } else {
    gI.appendChild(el("div","grow",'<div class="glabel">Zet Mandje op je beginscherm<div class="gsub">Kies in het menu van je browser <b>“App installeren”</b> of <b>“Toevoegen aan beginscherm”</b>.</div></div>'));
  }
  wrap.appendChild(gI);

  // ---- Account beveiligen (alleen als e-mail-auth aan staat in Supabase)
  if(window.MANDJE_CONFIG && window.MANDJE_CONFIG.EMAIL_AUTH && typeof Cloud!=="undefined" && Cloud.enabled){
    section("Account");
    wrap.appendChild(el("div","hint","Koppel een e-mail zodat je vrienden en lijsten bewaard blijven als je van telefoon wisselt. Optioneel — verder hoef je nooit in te loggen."));
    var secure=el("button","mbtn","Beveilig je account met e-mail");
    secure.addEventListener("click",function(){
      var email=prompt("Je e-mailadres (we sturen een bevestigingslink):");
      if(email===null) return;
      Cloud.secureWithEmail(email);
    });
    wrap.appendChild(secure);
  }

  // ---- Schappen & winkels: looproute per winkel (of standaard), eigen schappen
  var stores=state.settings.stores||[];
  var st=activeStore();
  var target = st ? st.order : state.settings.categoryOrder;
  section("Schappen & winkels", '<span class="count">'+state.settings.categoryOrder.length+'</span>');
  wrap.appendChild(el("div","hint", stores.length
    ? "Kies een winkel en sleep de schappen in de looproute van die winkel. 'Standaard' geldt als er geen winkel gekozen is."
    : "Sleep om de volgorde te wijzigen waarin schappen op de Lijst-tab verschijnen. Voeg een winkel toe voor een eigen looproute per supermarkt."));
  if(stores.length){
    var pick=el("div","store-pick meer");
    var mkPick=function(id,label){
      var on=(state.settings.activeStoreId||null)===id;
      var b=el("button","chip"+(on?" on":""),'<span>'+escapeHtml(label)+'</span>'); b.type="button"; b.setAttribute("aria-pressed", on?"true":"false");
      b.addEventListener("click",function(){ state.settings.activeStoreId=id; save(); renderStorePick(); renderMeer(); });
      return b;
    };
    pick.appendChild(mkPick(null,"Standaard"));
    stores.forEach(function(s){ pick.appendChild(mkPick(s.id, s.name)); });
    wrap.appendChild(pick);
    wrap.appendChild(el("div","qs-lbl", st ? "Looproute in "+escapeHtml(st.name) : "Standaardvolgorde"));
  }
  var sortWrap = el("div","sort-list");
  var sortItems = [];
  target.forEach(function(cid){
    var c = CAT_BY_ID[cid]; if(!c) return;
    var isCustom = (state.settings.customCategories||[]).some(function(cc){return cc.id===cid;});
    sortItems.push({id:cid, label:c.label, glyph:c.glyph, isCustom:isCustom});
  });
  makeSortableList(sortWrap, sortItems, function(newOrder){
    var s2=activeStore();
    if(s2) s2.order = newOrder; else state.settings.categoryOrder = newOrder;
    save();
    if(activeTab==="lijst") renderLijst();
  });
  wrap.appendChild(sortWrap);
  var addCat = el("button","mbtn","+ Eigen schap toevoegen");
  addCat.style.marginTop = "10px";
  addCat.addEventListener("click", openAddCategorySheet);
  wrap.appendChild(addCat);
  if(stores.length){
    var gS=el("div","group"); gS.style.marginTop="12px";
    stores.forEach(function(s){
      var row=el("div","grow"); row.innerHTML='<div class="glabel"><span class="st-name"></span><div class="gsub">Looproute · '+s.order.length+' schappen</div></div>';
      row.querySelector(".st-name").textContent=s.name;
      var del=el("button","mbtn inline soft","Verwijder"); del.type="button";
      del.addEventListener("click",function(){
        if(!confirm("Winkel '"+s.name+"' verwijderen? De looproute van deze winkel gaat verloren.")) return;
        state.settings.stores=(state.settings.stores||[]).filter(function(x){return x.id!==s.id;});
        if(state.settings.activeStoreId===s.id) state.settings.activeStoreId=null;
        save(); renderStorePick(); renderMeer();
      });
      row.appendChild(del); gS.appendChild(row);
    });
    wrap.appendChild(gS);
  }
  var addStoreBtn = el("button","mbtn","+ Nieuwe winkel (eigen looproute)");
  addStoreBtn.type="button"; addStoreBtn.addEventListener("click", openNewStoreSheet);
  wrap.appendChild(addStoreBtn);

  // ---- Back-up & privacy
  section("Back-up & privacy");
  wrap.appendChild(el("div","hint","Je persoonlijke lijst, vaste boodschappen en geschiedenis staan alleen op dit toestel — exporteer ze af en toe als back-up, of zet ze terug op een nieuw toestel. Gedeelde lijsten staan veilig online. Geen tracking, geen advertenties."));
  var shareTxt=el("button","mbtn","Deel als tekst"); shareTxt.type="button";
  shareTxt.addEventListener("click", shareListAsText);
  wrap.appendChild(shareTxt);
  var expf=el("button","mbtn","Exporteer mijn lijst (bestand)");
  expf.addEventListener("click",exportFile);
  wrap.appendChild(expf);
  var impf=el("button","mbtn","Importeer uit bestand");
  impf.addEventListener("click",importFromFile);
  wrap.appendChild(impf);
  var reset=el("button","mbtn danger","Alles wissen");
  reset.addEventListener("click",function(){
    if(confirm("Weet je zeker dat je alle lijsten, vaste boodschappen en geschiedenis wilt wissen?")){
      state=deepClone(DEFAULTS); state.settings.seenIntro=true; save(); applyTheme(); applyTextScale(); applyPriceVisibility();
      renderLijst(); renderDueBanner(); renderVaste(); renderMeer(); toast("Alles gewist");
    }
  });
  wrap.appendChild(reset);

  // ---- Diagnose: build, opslag, wachtrij, cloud
  section("Diagnose");
  var gD=el("div","group");
  var cfg = window.MANDJE_CONFIG || {};
  var ref = (cfg.SUPABASE_URL || "").match(/\/\/([a-z0-9]+)\./);
  var refStr = ref ? ref[1].slice(0, 8) : "";
  var bytes = 0; try{ bytes = (localStorage.getItem("mandje.v2") || "").length; }catch(e){}
  var queued = Array.isArray(state.syncQueue) ? state.syncQueue.length : 0;
  var known = Object.keys(state.catalog||{}).length;
  var cloudTxt = "uit";
  if(typeof Cloud!=="undefined" && Cloud){
    if(Cloud.ready) cloudTxt = "verbonden" + (refStr ? " · " + refStr : "");
    else if(cfg.SUPABASE_URL) cloudTxt = (typeof navigator!=="undefined" && navigator.onLine===false) ? "offline" : "niet verbonden";
  }
  [["Versie", cfg.BUILD || "dev"],
   ["Cloud", cloudTxt],
   ["Wachtende wijzigingen", String(queued)],
   ["Opslag op dit toestel", (bytes/1024).toFixed(bytes>102400?0:1) + " KB"],
   ["Bekende producten", String(known)]].forEach(function(r){
    gD.appendChild(el("div","grow",'<div class="glabel">'+r[0]+'</div><span class="gval">'+escapeHtml(r[1])+'</span>'));
  });
  wrap.appendChild(gD);
  wrap.appendChild(el("div","hint","Hoe vaker je afrondt, hoe beter Mandje je vaste boodschappen leert kennen."));
  var intro=el("button","mbtn","Bekijk de uitleg opnieuw"); intro.type="button";
  intro.addEventListener("click", function(){ switchTab("lijst"); setTimeout(function(){ maybeIntro(true); }, 60); });
  wrap.appendChild(intro);

  // ---- Uitgaven: laatste 8 weken uit de geschiedenis (betaald bedrag, anders het lijst-totaal)
  var hist=(state.history||[]).filter(function(h){ return (h.paid!=null && h.paid>0) || (h.total!=null && h.total>0); });
  if(hist.length){
    section("Uitgaven");
    var nowD=new Date(); var monday=new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()-((nowD.getDay()+6)%7));
    var weeks=[];
    for(var w=7; w>=0; w--){ var st0=new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()-7*w); weeks.push({start:st0, end:new Date(st0.getFullYear(), st0.getMonth(), st0.getDate()+7), sum:0}); }
    hist.forEach(function(h){ var t=new Date(h.at).getTime(); var v=(h.paid!=null?h.paid:h.total)||0; weeks.forEach(function(wk){ if(t>=wk.start.getTime() && t<wk.end.getTime()) wk.sum+=v; }); });
    var mx=Math.max.apply(null, weeks.map(function(wk){ return wk.sum; }).concat([1]));
    var tot=weeks.reduce(function(a,wk){ return a+wk.sum; },0);
    var gU=el("div","group");
    gU.appendChild(el("div","grow",'<div class="glabel">Laatste 8 weken<div class="gsub">'+escapeHtml(euro(tot))+' totaal · '+escapeHtml(euro(weeks[7].sum))+' deze week</div></div>'));
    var bars=el("div","spend");
    weeks.forEach(function(wk,i){ var b=el("div","bar"+(i===7?" now":"")); b.style.height=Math.max(3, Math.round(wk.sum/mx*64))+"px"; b.title=euro(wk.sum); if(wk.sum>0) b.innerHTML='<span>'+escapeHtml(euro(wk.sum).replace(",00",""))+'</span>'; bars.appendChild(b); });
    var lbls=el("div","spend-lbls"); weeks.forEach(function(wk){ lbls.appendChild(el("span",null, wk.start.getDate()+"/"+(wk.start.getMonth()+1))); });
    var col=el("div","spend-wrap"); col.appendChild(bars); col.appendChild(lbls);
    gU.appendChild(col); wrap.appendChild(gU);
  }
}
/* Lijst als platte tekst (delen via WhatsApp/mail, of kopiëren) */
function listAsText(){
  var meta=currentListMeta(), lines=[meta.name||"Lijst",""];
  var open=state.list.filter(function(i){return !i.done;}), done=state.list.filter(function(i){return i.done;});
  if(isPlainList()){
    var cur=null;
    open.forEach(function(i){ var s=(i.section||"").trim(); if(s!==cur){ cur=s; if(s) lines.push(s.toUpperCase()); } lines.push("☐ "+i.name+(i.note?" ("+i.note+")":"")); });
  } else {
    var byCat={}; open.forEach(function(i){ var cid=CAT_BY_ID[i.category]?i.category:"overig"; (byCat[cid]=byCat[cid]||[]).push(i); });
    catBuckets(byCat).forEach(function(cid){ var c=CAT_BY_ID[cid]||CAT_BY_ID["overig"]; lines.push(c.label.toUpperCase()); byCat[cid].forEach(function(i){ lines.push("☐ "+i.name+(i.qty>1?" ×"+i.qty:"")+(i.unit?" "+i.unit:"")+(i.note?" ("+i.note+")":"")); }); });
  }
  if(done.length){ lines.push(""); lines.push(listLabels().doneTitle.toUpperCase()); done.forEach(function(i){ lines.push("☑ "+i.name); }); }
  lines.push(""); lines.push("— gemaakt met Mandje");
  return lines.join("\n");
}
function shareListAsText(){
  var text=listAsText();
  if(navigator.share){ navigator.share({ title:currentListMeta().name||"Mandje", text:text }).catch(function(){}); return; }
  if(typeof copyText==="function") copyText(text, "Lijst gekopieerd — plak 'm in een bericht");
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
  if(isPlainList()){ openPlainSheet(listId); return; }
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
      html+='<button class="cadchip'+(d.assigned_to===m.id?" on":"")+'" data-m="'+m.id+'" style="'+(d.assigned_to===m.id?'background:'+safeColor(m.color)+';border-color:transparent':'')+'">'+escapeHtml(m.display_name)+'</button>';
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

  // Auto-add toggle — alleen tonen als er écht een ritme is (auto-herkend of handmatig ingesteld).
  // Zonder ritme doet auto-toevoegen niets, dus dan verbergen we 'm om verwarring te voorkomen.
  var _hasRhythm = !!(d.a && (d.a.regular || (d.a.mode==="manual" && d.a.last)));
  if(_hasRhythm){
    var _autoAdd = !!(state.catalog[(sheetCtx&&sheetCtx.key)||""] && state.catalog[(sheetCtx&&sheetCtx.key)||""].autoAdd);
    html+='<div class="auto-add-toggle">'+
      '<div class="aat-label">Automatisch toevoegen<small>Verschijnt vanzelf op je lijst zodra het ritme zegt "bijna op".</small></div>'+
      '<button class="switch'+(_autoAdd?" on":"")+'" id="s-auto-toggle" type="button" aria-label="Auto-toevoegen wisselen"></button>'+
    '</div>';
  }

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
      var b=el("button","catchip"+(c.id===chosenCat?" on":""),shelfIcon(c)+'<span>'+escapeHtml(c.label)+'</span>');
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
    // null wanneer de toggle niet getoond is (geen ritme) → saveSheet laat autoAdd ongemoeid
    var autoAdd = autoToggle ? autoToggle.classList.contains("on") : null;
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

/* Zorgt dat een gefocuste sheet-input boven 't toetsenbord komt (iOS).
   Bind 1× per sheet-open op alle inputs/textareas erin. */
function bindSheetKeyboardScroll(sheetEl){
  if(!sheetEl) return;
  sheetEl.querySelectorAll("input, textarea").forEach(function(inp){
    inp.addEventListener("focus", function(){
      setTimeout(function(){
        try{ inp.scrollIntoView({behavior:"smooth", block:"center"}); }catch(e){}
      }, 120);
    });
  });
}
/* Swipe-down-to-close: sleep vanaf de bovenkant (grip-zone) van een sheet
   naar beneden om 'm te sluiten. Natuurlijk iOS-gebaar. */
function attachSheetDismiss(sheetEl, closeFn){
  if(!sheetEl) return;
  var startY=0, curY=0, dragging=false;
  sheetEl.addEventListener("touchstart", function(e){
    if(typeof sheetLayout==="function" && sheetLayout()!=="bottom"){ dragging=false; return; }   // dialoog/zijpaneel: geen swipe-down
    // Alleen starten in de bovenste ~70px (grip + titel), niet midden in content
    var rect = sheetEl.getBoundingClientRect();
    if(e.touches[0].clientY - rect.top > 70){ dragging=false; return; }
    startY = e.touches[0].clientY; curY = 0; dragging = true;
    sheetEl.style.transition = "none";
  }, {passive:true});
  sheetEl.addEventListener("touchmove", function(e){
    if(!dragging) return;
    curY = e.touches[0].clientY - startY;
    if(curY > 0) sheetEl.style.transform = "translateY("+curY+"px)";
  }, {passive:true});
  sheetEl.addEventListener("touchend", function(){
    if(!dragging) return; dragging=false;
    sheetEl.style.transition = "";
    if(curY > 90){ sheetEl.style.transform=""; closeFn(); }
    else { sheetEl.style.transform=""; }
  });
}
function openSheetUI(){ var s=$("#sheet"); $("#scrim").classList.add("show"); s.classList.add("show"); document.body.classList.add("sheet-open"); bindSheetKeyboardScroll(s); injectSheetX(s, closeSheet); modalOpen(s, closeSheet); }
function closeSheet(){
  $("#scrim").classList.remove("show"); $("#sheet").classList.remove("show"); sheetCtx=null;
  if(!$("#sheet2").classList.contains("show")) document.body.classList.remove("sheet-open");
  modalClose($("#sheet"));
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
    if(horiz){ e.preventDefault(); curX=Math.min(0,Math.max(-MAX,dx)); card.style.transform="translateX("+curX+"px)"; if(curX<-6) card._suppressClick=true; if(card.parentNode) card.parentNode.classList.add("swiping"); }
  },{passive:false});
  card.addEventListener("touchend",function(){
    if(!dragging) return; dragging=false; card.style.transition="";
    if(curX<=-THRESH){ card.style.transform="translateX(-100%)"; vibrate(10); setTimeout(onDelete,180); }
    else{ card.style.transform="translateX(0)"; setTimeout(function(){ card._suppressClick=false; if(card.parentNode) card.parentNode.classList.remove("swiping"); },280); }
  });
  // Gesture onderbroken (oproep, systeem-overlay): kaart en rode laag terugzetten
  card.addEventListener("touchcancel",function(){
    if(!dragging) return; dragging=false; curX=0; card.style.transition=""; card.style.transform="translateX(0)"; card._suppressClick=false;
    if(card.parentNode) card.parentNode.classList.remove("swiping");
  });
}

/* ============================================================
   ADD-FIELD + AUTOCOMPLETE
   ============================================================ */
function doAdd(){
  var raw = $("#add-name").value;
  var p = isPlainList() ? { name:(raw||"").trim(), qty:1 } : parseQtyFromInput(raw);
  if(!p.name) return;
  hideAC();  // direct sluiten zodat AC-popover niet "kort flikkert" tussen items
  if(addToList(p.name, null, {qty: p.qty, unit: p.unit})){
    $("#add-name").value="";
    $("#add-name").focus();
    vibe("tick");
  }
}
function buildAC(q){
  if(isPlainList()){ hideAC(); return; }
  // strip qty-syntax voor ac-zoekopdracht (zodat "melk 2" ook 'melk' suggereert)
  var parsed = parseQtyFromInput(q||"");
  var stripped = parsed.name;
  // toon de herkende hoeveelheid/eenheid als badge bij elke suggestie ("×2" of "500 g")
  var qmod = parsed.unit ? escapeHtml(parsed.unit) : (parsed.qty>1 ? "×"+parsed.qty : "");
  var nq=norm(stripped);
  if(!nq){ hideAC(); return; }
  var seen={}, prefix=[], partial=[];
  // catalog: prefix-matches eerst, dan partial; binnen elke groep op timesAdded desc
  Object.keys(state.catalog).forEach(function(k){
    var e=state.catalog[k]; var en=norm(e.name);
    if(e.hidden || en===nq) return;
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
  _acIdx=-1;
  results.forEach(function(r, idx){
    var c=CAT_BY_ID[r.cat]||CAT_BY_ID["overig"];
    var row=el("div","ac-item",shelfIcon(c,{bubble:true})+'<span class="ac-name">'+escapeHtml(r.name)+'</span>'+(qmod?'<span class="ac-qmod">'+qmod+'</span>':'')+'<span class="ac-add">+</span>');
    row.addEventListener("click",function(){
      // gebruik de qty/eenheid die in het invoerveld stond als die er was
      var pq = parseQtyFromInput($("#add-name").value || "");
      addToList(r.name, null, {qty: pq.qty, unit: pq.unit});
      $("#add-name").value=""; hideAC(); $("#add-name").focus();
    });
    row.setAttribute("role","option"); row.id="ac-opt-"+idx;
    list.appendChild(row);
  });
  list.classList.add("show");
  $("#add-name").setAttribute("aria-expanded","true");
}
var _acIdx=-1;
function hideAC(){ $("#ac-list").classList.remove("show"); $("#ac-list").innerHTML=""; _acIdx=-1; var i=$("#add-name"); if(i){ i.removeAttribute("aria-activedescendant"); i.setAttribute("aria-expanded","false"); } }

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

var _searchQ = "";   // actieve zoekterm (bron van waarheid; renderLijst past 'm opnieuw toe)
function setupSearchBar(){
  var input = $("#search-input"); if(!input) return;
  var bar = $("#search-bar"); var clear = $("#search-clear");
  input.addEventListener("input", function(){
    var q=(input.value||"").trim().toLowerCase();
    bar.classList.toggle("empty", !q);
    _searchQ = q;
    applySearchFilter(q);
  });
  clear.addEventListener("click", function(){
    input.value=""; bar.classList.add("empty");
    _searchQ = "";
    applySearchFilter(""); input.focus();
  });
}
function toggleSearchBar(){
  var bar = $("#search-bar"); if(!bar) return;
  var visible = activeTab==="lijst" && state.list.length >= 10;
  bar.classList.toggle("collapsed", !visible);
  if(!visible){
    var input = $("#search-input");
    if(input && input.value){ input.value=""; bar.classList.add("empty"); _searchQ=""; applySearchFilter(""); }
  }
}
function applySearchFilter(q){
  q = (q||"").trim().toLowerCase();
  var open = $("#open-list"); var done = $("#done-list");
  if(!open) return;
  var emptyMsg = open.querySelector(".search-empty");
  if(!q){
    open.querySelectorAll(".row, .section, ul.list, .shelf").forEach(function(n){ n.style.display=""; });
    if(done) done.style.display = "";
    if(emptyMsg) emptyMsg.style.display = "none";
    return;
  }
  if(done) done.style.display = "none";
  var anyVisible = false;
  open.querySelectorAll("ul.list").forEach(function(ul){
    var any = false;
    ul.querySelectorAll(".row").forEach(function(r){
      var nm = r.querySelector(".nm");
      var name = nm ? nm.textContent.toLowerCase() : "";
      var match = name.indexOf(q) !== -1;
      r.style.display = match ? "" : "none";
      if(match) any = true;
    });
    // "flex" (niet "") forceert tonen ook als de categorie is ingeklapt (.collapsed → display:none)
    ul.style.display = any ? "flex" : "none";
    var sec = ul.previousElementSibling;
    if(sec && sec.classList.contains("section")) sec.style.display = any ? "" : "none";
    var shelf = ul.closest(".shelf"); if(shelf) shelf.style.display = any ? "" : "none";   // anders blijft een lege raster-cel staan
    if(any) anyVisible = true;
  });
  if(!anyVisible){
    if(!emptyMsg){
      emptyMsg = el("div","search-empty");
      emptyMsg.innerHTML = '<div class="se-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></div><div class="se-txt"></div>';
      open.appendChild(emptyMsg);
    }
    emptyMsg.querySelector(".se-txt").textContent = 'Niets gevonden voor "'+q+'"';
    emptyMsg.style.display = "";
  } else if(emptyMsg){
    emptyMsg.style.display = "none";
  }
}

/* Sleepbare lijst van schap-rijen. Globale move/end-listeners worden eenmalig gebonden. */
var _sortState = { dragging:null, items:null, dragIdx:-1, startY:0, offset:0, onReorder:null };
var _sortBound = false;
function _sortMove(clientY){
  var d = _sortState; if(!d.dragging) return;
  d.offset = clientY - d.startY;
  d.dragging.style.transform = "translateY("+d.offset+"px) scale(1.02)";
  var rowH = d.dragging.offsetHeight + (d.gap||6);
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
  var rowH = d.dragging.offsetHeight + (d.gap||6);
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
      shelfIcon(CAT_BY_ID[item.id]||item,{bubble:true})+
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
  openSheetUI();
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
    (state.settings.stores||[]).forEach(function(s){ if(s.order.indexOf(id)===-1) s.order.push(id); });
    rebuildCatIndex(); save();
    closeSheet(); renderMeer(); toast(name+" toegevoegd");
  });
}

function deleteCustomCategory(id){
  state.settings.customCategories = (state.settings.customCategories||[]).filter(function(c){return c.id!==id;});
  state.settings.categoryOrder = state.settings.categoryOrder.filter(function(cid){return cid!==id;});
  (state.settings.stores||[]).forEach(function(s){ s.order = s.order.filter(function(cid){return cid!==id;}); });
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
  var close = function(){ scrim.classList.remove("show"); sh.classList.remove("show"); modalClose(sh); };
  scrim.classList.add("show"); sh.classList.add("show"); modalOpen(sh, close);
  sh.querySelectorAll("#em-pick .ep-cell").forEach(function(b){
    b.addEventListener("click", function(){
      sh.querySelectorAll("#em-pick .ep-cell").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on"); picked = b.dataset.em;
    });
  });
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
  openSheetUI();
  setTimeout(function(){ var i=$("#bulk-input"); if(i) i.focus(); }, 260);
  $("#bulk-cancel").addEventListener("click", closeSheet);
  $("#bulk-go").addEventListener("click", function(){
    var text = ($("#bulk-input").value||"");
    var lines = text.split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean);
    var added = 0;
    lines.forEach(function(line){
      var p = parseQtyFromInput(line);
      if(p.name && addToList(p.name, null, {qty:p.qty, unit:p.unit, silent:true})) added++;
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
  document.body.classList.toggle("tab-meer", tab==="meer");
  document.body.classList.toggle("tab-vaste", tab==="vaste");
  if(typeof renderStorePick==="function") renderStorePick();
  document.querySelectorAll("[data-tab]").forEach(function(b){ b.classList.toggle("on",b.dataset.tab===tab); });
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
  updateSubhead();
  renderListSwitch(); renderMembersRow();
  if(typeof renderPresence==="function") renderPresence();
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
  var color=eff==="dark"?"#15130F":"#F3EDE3";
  // Eén theme-color-meta (zonder media-attribuut) die altijd het effectieve thema volgt —
  // anders bleef de statusbalk crème bij handmatig 'Donker' op een licht systeem.
  var m=document.querySelector('meta[name="theme-color"]');
  if(!m){ m=document.createElement("meta"); m.name="theme-color"; document.head.appendChild(m); }
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
  if(icon==="bag" && typeof HERO_BASKET_SVG!=="undefined") icons.bag = HERO_BASKET_SVG;
  var e=el("div","empty hero");
  e.innerHTML='<div class="ico">'+(icons[icon]||icons.bag)+'</div><h2>'+h+'</h2><p>'+p+'</p>';
  if(actionLabel && typeof actionFn === "function"){
    var btn = el("button","mbtn primary", actionLabel);
    btn.style.maxWidth = "260px"; btn.style.margin = "20px auto 0";
    btn.addEventListener("click", actionFn);
    e.appendChild(btn);
  }
  return e;
}
function escapeHtml(s){ return (s||"").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
function escapeAttr(s){ return escapeHtml(s).replace(/'/g,"&#39;"); }
/* Schap-pictogram (emoji, ook uit eigen schappen = gebruikersinvoer) veilig als HTML */
function glyphHtml(g){ return escapeHtml(String(g||"").slice(0,8)); }
/* Schap-icoon: eigen lijn-icoon (src/icons.js) in de schap-kleur; eigen schappen en emoji-overrides houden hun emoji.
   opts.bubble = getinte bubbel eromheen (lijstrijen, autocomplete). */
function shelfIcon(cat, opts){
  opts = opts || {};
  var id = cat && cat.id;
  var svg = (typeof SHELF_ICONS !== "undefined" && id) ? SHELF_ICONS[id] : null;
  var grp = (typeof SHELF_GROUP !== "undefined" && id && SHELF_GROUP[id]) || "huis";
  var override = !!(state && state.settings && state.settings.customCatEmoji && id && state.settings.customCatEmoji[id]);
  var cls = "shelf-ico shelf-" + grp + (opts.bubble ? " shelf-bubble" : "");
  if(!svg || (cat && cat.isCustom) || override){
    return '<span class="' + cls + ' is-emoji" aria-hidden="true"><span class="emoji">' + glyphHtml(cat ? cat.glyph : "🛒") + '</span></span>';
  }
  return '<span class="' + cls + '" aria-hidden="true">' + svg + '</span>';
}

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
function refreshOfflineBadge(){
  var badge = $("#offline-badge"); if(!badge) return;
  var cloudFallback = (typeof Cloud !== "undefined" && Cloud && Cloud.mode === "local" && !Cloud.ready && !!Cloud.initError);
  if(navigator.onLine && !cloudFallback){
    badge.classList.remove("show");
    return;
  }

  badge.classList.add("show");
  var txt = "Lokaal";
  if(!navigator.onLine){
    var n = (typeof Cloud!=="undefined" && Cloud.active && Cloud._pending) ? Cloud._pending.length : 0;
    txt = n>0 ? ("Offline · "+n+" wijziging"+(n===1?"":"en")) : "Offline";
  }
  if(badge.textContent !== txt) badge.textContent = txt;   // live region: niet bij elke save() opnieuw aankondigen
}
function setupOfflineIndicator(){
  if(!$("#offline-badge")) return;
  window.addEventListener("online", refreshOfflineBadge);
  window.addEventListener("offline", refreshOfflineBadge);
  refreshOfflineBadge();
}

function setupTopShareBtn(){
  var btn = $("#share-top-btn"); if(!btn) return;
  btn.addEventListener("click", function(){
    if(typeof Cloud !== "undefined" && Cloud.active && Cloud.ready && typeof openShareSheet === "function"){
      openShareSheet(Cloud.active);
      return;
    }
    if(typeof Cloud !== "undefined" && Cloud.initError){
      if(typeof toast === "function") toast(Cloud.initError);
      return;
    }
    if(typeof Cloud !== "undefined" && Cloud.active){
      if(typeof toast === "function"){
        if(navigator.onLine === false) toast("Offline-modus — delen even uitgeschakeld");
        else toast("Cloudstart bezig — probeer opnieuw over een ogenblik");
      }
      return;
    }
    if(typeof toast === "function"){
      toast("Geen gedeelde lijst actief; deel werkt in Cloud-modus");
    }
  });
}
function refreshTopShareBtn(){
  var btn = $("#share-top-btn"); if(!btn) return;
  if(typeof Cloud === "undefined"){
    btn.classList.remove("show");
    btn.removeAttribute("title");
    return;
  }
  if(Cloud.ready && Cloud.active){
    btn.classList.add("show");
    btn.title = "Lijst delen";
    return;
  }
  btn.classList.remove("show");
  if(!Cloud.enabled) btn.title = "Delen uitgeschakeld";
  else if(!Cloud.ready && navigator.onLine === false) btn.title = "Offline";
  else btn.title = "Delen niet actief";
}

/* ============================================================
   BARCODE-SCANNEN — camera (html5-qrcode, ingebakken) + Open Food Facts
   Lage NL-dekking → handmatig typen blijft de hoofdweg; scannen is een versneller.
   ============================================================ */
var OFF_CAT_MAP = {
  "dairy":"zuivel-eieren","milk":"zuivel-eieren","milks":"zuivel-eieren","eggs":"zuivel-eieren","yogurts":"zuivel-eieren","butters":"zuivel-eieren","creams":"zuivel-eieren","zuivel":"zuivel-eieren","eieren":"zuivel-eieren",
  "cheeses":"kaas-vleeswaren","cheese":"kaas-vleeswaren","charcuterie":"kaas-vleeswaren","hams":"kaas-vleeswaren","kaas":"kaas-vleeswaren",
  "fruits":"groente-fruit","vegetables":"groente-fruit","fruits-and-vegetables":"groente-fruit","legumes":"groente-fruit","groenten":"groente-fruit","fruit":"groente-fruit",
  "breads":"brood-banket","bread":"brood-banket","pastries":"brood-banket","brood":"brood-banket",
  "breakfast-cereals":"ontbijt-beleg","cereals":"ontbijt-beleg","spreads":"ontbijt-beleg","jams":"ontbijt-beleg","honeys":"ontbijt-beleg","breakfasts":"ontbijt-beleg",
  "snacks":"snoep-snacks","sweet-snacks":"snoep-snacks","salty-snacks":"snoep-snacks","chocolates":"snoep-snacks","biscuits":"snoep-snacks","candies":"snoep-snacks","chips-and-fries":"snoep-snacks","snoep":"snoep-snacks",
  "meats":"vlees-vis","meat":"vlees-vis","poultry":"vlees-vis","fishes":"vlees-vis","seafood":"vlees-vis","fish":"vlees-vis","vlees":"vlees-vis",
  "frozen-foods":"diepvries","frozen":"diepvries","ice-creams":"diepvries","diepvries":"diepvries",
  "beverages":"dranken","waters":"dranken","sodas":"dranken","juices":"dranken","teas":"dranken","coffees":"dranken","alcoholic-beverages":"dranken","beers":"dranken","wines":"dranken","dranken":"dranken",
  "pastas":"houdbaar","rice":"houdbaar","canned-foods":"houdbaar","condiments":"houdbaar","sauces":"houdbaar","groceries":"houdbaar","houdbaar":"houdbaar",
  "baby-foods":"baby-kind","baby":"baby-kind","hygiene":"verzorging","beauty":"verzorging","cosmetics":"verzorging","household":"huishouden","cleaning":"huishouden"
};
function mapOFFCategory(tags){
  if(!Array.isArray(tags)) return null;
  for(var i=tags.length-1;i>=0;i--){               // meest-specifieke tag staat achteraan
    var seg = String(tags[i]).split(":").pop();
    if(OFF_CAT_MAP[seg]) return OFF_CAT_MAP[seg];
  }
  return null;
}
function barcodeCacheGet(ean){
  try{ var c=JSON.parse(localStorage.getItem("mandje.barcodecache")||"{}"); var e=c[ean]; if(e && (Date.now()-e.ts)<86400000) return e; }catch(x){}
  return null;
}
function barcodeCacheSet(ean, data){
  try{ var c=JSON.parse(localStorage.getItem("mandje.barcodecache")||"{}"); c[ean]=Object.assign({ts:Date.now()}, data); localStorage.setItem("mandje.barcodecache", JSON.stringify(c)); }catch(x){}
}
/* EAN-13 → productnaam + schap via Open Food Facts (gratis, geen key). 24u gecachet. */
function lookupBarcode(ean){
  var cached = barcodeCacheGet(ean);
  if(cached) return Promise.resolve(cached);
  var url = "https://world.openfoodfacts.org/api/v2/product/"+encodeURIComponent(ean)+".json?fields=product_name,product_name_nl,brands,categories_tags";
  return fetch(url, {headers:{"Accept":"application/json"}}).then(function(r){ return r.json(); }).then(function(j){
    if(!j || j.status!==1 || !j.product){ var miss={ean:ean, found:false}; barcodeCacheSet(ean, miss); return miss; }
    var p=j.product;
    var name=(p.product_name_nl || p.product_name || "").trim();
    if(!name){ var m2={ean:ean, found:false}; barcodeCacheSet(ean, m2); return m2; }
    var data={ean:ean, found:true, name:name, cat:(mapOFFCategory(p.categories_tags)||classify(name))};
    barcodeCacheSet(ean, data); return data;
  }).catch(function(){ return {ean:ean, found:false, error:true}; });
}

var _bcScanner=null, _bcRunning=false, _bcLastEan="", _bcLastAt=0, _bcSession=0;
var _bcStatusLast="", _bcStatusAt=0;
function bcStatus(msg){
  var s=$("#bc-status"); if(!s) return;
  var now=(Date.now?Date.now():0);
  if(msg===_bcStatusLast && (now-_bcStatusAt)<2000) return;  // debounce: geen aria-live-spam
  _bcStatusLast=msg||""; _bcStatusAt=now;
  s.textContent=msg||"";
}
function openBarcodeScanScreen(){
  var scr=$("#barcode-screen"); if(!scr) return;
  _bcSession++;
  scr.innerHTML =
    '<div class="ss-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 7v10M11 7v10M15 7v10"/></svg></div>'+
    '<div class="eyebrow">Scan een product</div>'+
    '<h1>Richt op de streepjescode</h1>'+
    '<div class="ss-sub">Niet gevonden? Typ de naam gewoon zelf.</div>'+
    '<div id="bc-reader"></div>'+
    '<div class="bc-status" id="bc-status" role="status" aria-live="polite" aria-atomic="true"></div>'+
    '<div class="field" style="margin-top:8px"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'+
      '<input class="name" id="bc-manual-input" type="search" placeholder="…of typ een product" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">'+
      '<button class="addbtn" id="bc-manual-add" aria-label="Toevoegen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>'+
    '</div>'+
    '<button class="mbtn" id="bc-close" style="margin-top:18px">Sluiten</button>';
  scr.classList.add("show");
  modalOpen(scr, closeBarcodeScanScreen);
  var close=$("#bc-close"); if(close) close.addEventListener("click", closeBarcodeScanScreen);
  var mi=$("#bc-manual-input"), ma=$("#bc-manual-add");
  var manualAdd=function(){ var v=(mi.value||"").trim(); if(!v) return; var p=parseQtyFromInput(v); addToList(p.name, null, {qty:p.qty, unit:p.unit}); toast(p.name+" toegevoegd"); closeBarcodeScanScreen(); };
  if(ma) ma.addEventListener("click", manualAdd);
  if(mi) mi.addEventListener("keydown", function(e){ if(e.key==="Enter") manualAdd(); });
  startBarcodeScanner();
}
/* Decoder lazy van CDN (met fallback). Niet ingebakken: scannen heeft tóch internet
   nodig voor de Open Food Facts-lookup, dus offline cachen heeft geen nut. */
var _bcLibPromise=null;
function loadBarcodeDecoder(){
  if(window.Html5Qrcode) return Promise.resolve(true);
  if(_bcLibPromise) return _bcLibPromise;
  var urls=[
    "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js",
    "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"
  ];
  _bcLibPromise = new Promise(function(resolve){
    var i=0;
    (function tryNext(){
      if(window.Html5Qrcode){ resolve(true); return; }
      if(i>=urls.length){ resolve(false); return; }
      var s=document.createElement("script"); s.src=urls[i++]; s.async=true;
      s.onload=function(){ resolve(!!window.Html5Qrcode); };
      s.onerror=tryNext;
      document.head.appendChild(s);
    })();
  });
  return _bcLibPromise;
}
function startBarcodeScanner(){
  var mySession=_bcSession;
  bcStatus("Scanner laden…");
  loadBarcodeDecoder().then(function(ok){
    if(mySession!==_bcSession) return;   // scherm intussen gesloten of heropend → deze start is verouderd
    if(!ok || !window.Html5Qrcode){ bcStatus("Scanner niet beschikbaar — typ de naam"); return; }
    if(!$("#barcode-screen").classList.contains("show")) return; // gebruiker sloot al
    bcStatus("Camera starten…");
    try{
      _bcScanner = new window.Html5Qrcode("bc-reader", { verbose:false });
      var inst=_bcScanner;
      var F = window.Html5QrcodeSupportedFormats;
      var config = { fps:10, qrbox:{width:240,height:150} };
      if(F) config.formatsToSupport = [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E];
      _bcScanner.start({facingMode:"environment"}, config, onBarcodeDecoded, function(){})
        .then(function(){
          if(mySession!==_bcSession){ // scherm is intussen gesloten → camera direct weer uit
            try{ inst.stop().then(function(){ try{ inst.clear(); }catch(x){} }, function(){}); }catch(e){}
            return;
          }
          _bcRunning=true; bcStatus("");
        })
        .catch(function(){ bcStatus("Kan de camera niet openen — typ de naam"); });
    }catch(e){ bcStatus("Scanner niet beschikbaar — typ de naam"); }
  });
}
function stopBarcodeScanner(){
  if(_bcScanner && _bcRunning){ try{ _bcScanner.stop().then(function(){ try{ _bcScanner.clear(); }catch(x){} }, function(){}); }catch(e){} }
  _bcRunning=false;
}
function closeBarcodeScanScreen(){
  _bcSession++;
  stopBarcodeScanner();
  var scr=$("#barcode-screen"); if(scr){ scr.classList.remove("show"); modalClose(scr); }
}
function onBarcodeDecoded(text){
  var ean=(text||"").trim(); if(!ean) return;
  // ontdubbel: zelfde code binnen 3s niet opnieuw
  if(ean===_bcLastEan && (Date.now()-_bcLastAt)<3000) return;
  _bcLastEan=ean; _bcLastAt=Date.now();
  vibe("tick");
  bcStatus("Opzoeken…");
  lookupBarcode(ean).then(function(d){
    if(d.found){
      addToList(d.name, null, {qty:1});
      closeBarcodeScanScreen();
      vibe("tick");
      toast("✓ "+d.name+" toegevoegd");
    } else {
      bcStatus("Niet gevonden — typ de naam");
      var mi=$("#bc-manual-input"); if(mi) mi.focus();
    }
  });
}
function setupBarcode(){
  var btn=$("#scan-btn"); if(!btn) return;
  // Camera vereist getUserMedia; anders knop verbergen
  if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){ btn.style.display="none"; return; }
  btn.addEventListener("click", function(e){ e.stopPropagation(); openBarcodeScanScreen(); });
}

/* Service worker: instant laden + offline-installeerbaar. Bij een nieuwe build wacht de
   nieuwe SW; we tonen dan een niet-opdringerige toast i.p.v. hard te herladen. */
var _userAskedUpdate = false;
function setupServiceWorker(){
  if(!("serviceWorker" in navigator)) return;
  try{
    navigator.serviceWorker.register("sw.js").then(function(reg){
      var promptUpdate = function(){
        if(!reg.waiting) return;
        toast("Nieuwe versie beschikbaar", { action:"Ververs", duration:8000, onAction:function(){
          _userAskedUpdate = true;
          if(reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
        }});
      };
      if(reg.waiting && navigator.serviceWorker.controller) promptUpdate();
      reg.addEventListener("updatefound", function(){
        var nw = reg.installing; if(!nw) return;
        nw.addEventListener("statechange", function(){
          if(nw.state === "installed" && navigator.serviceWorker.controller) promptUpdate();
        });
      });
    }).catch(function(){});
    // Eerste bezoek: clients.claim() vuurt óók controllerchange — dan NIET herladen
    // (dat kostte elke nieuwe bezoeker een dubbele download van de hele app).
    var reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function(){
      if(!_userAskedUpdate || reloaded) return; reloaded = true; location.reload();
    });
  }catch(e){}
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

function maybeIntro(force){
  if(!state || !state.settings) return;
  if(!force && state.settings.seenIntro) return;
  if(!force && (state.list.length>0 || Object.keys(state.catalog).length>0)){ state.settings.seenIntro=true; save(); return; }
  var sh=$("#sheet"); if(!sh) return;
  var stages = [
    {interactive:true, title:"Typ wat je nodig hebt", body:"Producten sorteren zichzelf in het juiste schap. Probeer maar:"},
    {glyph:"🔁", title:"Vaste leert mee", body:"Vink af, rond af. Na een paar keer herkent Mandje wat 'bijna op' is — zonder dat je iets hoeft in te stellen."},
    {glyph:"👥", title:"Samen of solo", body:"Maak meerdere lijsten — privé of gedeeld. Deel een stuur-link en iemand kan items naar jou droppen zonder app."}
  ];
  var idx = 0;
  var dismiss = function(){
    state.settings.seenIntro=true; save(); closeSheet();
    setTimeout(function(){ var i=$("#add-name"); if(i) i.focus(); }, 320);
  };
  var updateDemo = function(val){
    var resEl = $("#idemo-result"); var hintEl = $("#idemo-hint"); if(!resEl) return;
    var name = parseQtyFromInput(val||"").name.trim();
    if(!name){ resEl.classList.remove("show"); resEl.innerHTML=""; if(hintEl) hintEl.textContent=""; return; }
    var c = CAT_BY_ID[classify(name)] || CAT_BY_ID["overig"];
    var disp = name.charAt(0).toUpperCase()+name.slice(1);
    resEl.innerHTML = '<span class="idemo-chip">'+shelfIcon(c||CAT_BY_ID["overig"])+escapeHtml(disp)+'</span>'+
      '<span class="idemo-arrow">→</span>'+
      '<span class="idemo-shelf">'+escapeHtml(c?c.label:"Overig")+'</span>';
    if(!resEl.classList.contains("show")) resEl.classList.add("show");
    if(hintEl) hintEl.textContent = "Vanzelf in het juiste schap ✨";
  };
  var render = function(){
    var s = stages[idx];
    var isLast = (idx === stages.length-1);
    var body = s.interactive
      ? '<div class="intro-card intro-card-demo">'+
          '<h4>'+escapeHtml(s.title)+'</h4>'+
          '<p>'+escapeHtml(s.body)+'</p>'+
          '<div class="intro-demo">'+
            '<div class="idemo-field"><span class="emoji">🔎</span><input id="idemo-input" type="text" placeholder="Typ bijv. melk" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done"></div>'+
            '<div class="idemo-tries">'+
              ['melk','bananen','wc-papier','kaas'].map(function(t){return '<button type="button" class="idemo-try" data-try="'+escapeAttr(t)+'">'+escapeHtml(t)+'</button>';}).join("")+
            '</div>'+
            '<div class="idemo-result" id="idemo-result"></div>'+
            '<div class="idemo-hint" id="idemo-hint"></div>'+
          '</div>'+
        '</div>'
      : '<div class="intro-card">'+
          '<div class="ic-glyph emoji">'+s.glyph+'</div>'+
          '<h4>'+escapeHtml(s.title)+'</h4>'+
          '<p>'+escapeHtml(s.body)+'</p>'+
        '</div>';
    sh.innerHTML = '<div class="grip"></div>'+
      '<button id="intro-skip" type="button" aria-label="Sla over" style="position:absolute;top:14px;right:14px;border:0;background:transparent;color:var(--ink-faint);font-size:14px;font-weight:600;padding:6px 10px;border-radius:8px">Sla over</button>'+
      '<div class="intro-stage">'+
        body+
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
    if(s.interactive){
      var di = $("#idemo-input");
      if(di){ di.addEventListener("input", function(){ updateDemo(this.value); }); }
      sh.querySelectorAll(".idemo-try").forEach(function(b){
        b.addEventListener("click", function(){
          var v = b.getAttribute("data-try")||"";
          if(di){ di.value = v; di.focus(); }
          updateDemo(v); vibe("tap");
        });
      });
    }
  };
  openSheetUI();
  render();
}

/* ============================================================
   INIT
   ============================================================ */
function init(){
  // Eerst het IndexedDB-vangnet checken (herstelt localStorage als die gewist is), dan starten.
  ensureRestore().then(initApp);
}
function initApp(){
  load();
  applyTheme();
  applyTextScale();
  applyPriceVisibility();

  if(typeof Cloud !== "undefined"){
    if(typeof Cloud.cfg === "function" && Cloud.cfg() && typeof Cloud._scheduleOnlineRecovery === "function"){
      Cloud._scheduleOnlineRecovery();
    }
    var canCloud = typeof Cloud._canInit === "function" ? Cloud._canInit() : ((typeof navigator === "undefined" || navigator.onLine !== false) && typeof fetch === "function");
    var cfgOn = typeof Cloud.cfg === "function" ? Cloud.cfg() : false;
    var canInitMessage = typeof Cloud._canInitError === "function" ? Cloud._canInitError() : "";
    var safeModeGuard = !Cloud._initInProgress && !Cloud.ready && typeof Cloud._setOfflineMode === "function";
    if(cfgOn && !canInitMessage && canCloud && !Cloud.ready && !Cloud._initInProgress){
      Cloud.init();
    } else if(safeModeGuard){
      if(!cfgOn){
        Cloud._setOfflineMode("Cloud uitgeschakeld: geen configuratie", true);
      } else if(canInitMessage){
        Cloud._setOfflineMode(canInitMessage, true);
      } else if(!canCloud){
        var offReason = (typeof navigator !== "undefined" && navigator.onLine === false) ? "Cloud uitgeschakeld: je bent offline" : "Cloud niet beschikbaar op dit toestel";
        Cloud._setOfflineMode(offReason, true);
      }
    }
  }
  updateSubhead();
  refreshTopShareBtn();
  applyListType();

  $("#add-btn").addEventListener("click",doAdd);
  $("#add-name").addEventListener("keydown",function(e){
    var list=$("#ac-list"), items=list.classList.contains("show") ? list.querySelectorAll(".ac-item") : [];
    if(items.length && (e.key==="ArrowDown" || e.key==="ArrowUp")){
      e.preventDefault();
      // lijst opent naar boven: ↑ vanuit 'niets' kiest de optie het dichtst bij het veld (laatste), ↓ de eerste
      _acIdx = e.key==="ArrowUp" ? (_acIdx<0 ? items.length-1 : (_acIdx-1+items.length)%items.length) : (_acIdx<0 ? 0 : (_acIdx+1)%items.length);
      items.forEach(function(it,i){ it.classList.toggle("active", i===_acIdx); });
      this.setAttribute("aria-activedescendant","ac-opt-"+_acIdx);
      try{ items[_acIdx].scrollIntoView({block:"nearest"}); }catch(x){}
      return;
    }
    if(e.key==="Enter"){ if(_acIdx>=0 && items[_acIdx]){ e.preventDefault(); items[_acIdx].click(); _acIdx=-1; return; } doAdd(); }
  });
  document.addEventListener("keydown", onGlobalKey);   // Escape-hiërarchie, Tab-trap, sneltoetsen (src/overlays.js)
  $("#add-name").addEventListener("input",function(){ buildAC(this.value); });
  $("#add-name").addEventListener("blur",function(){ setTimeout(hideAC,180); });
  attachLongPress($("#add-btn"), function(){
    if(state && state.settings && !state.settings.seenBulkHint){
      state.settings.seenBulkHint = true; save();
    }
    openBulkPasteSheet();
  });
  // Eenmalige ontdek-hint dat de +-knop óók bulk-plakken kan (kort na eerste paar items)
  setTimeout(function(){
    if(state && state.settings && !state.settings.seenBulkHint && Object.keys(state.catalog||{}).length>=4){
      state.settings.seenBulkHint = true; save();
      toast("Tip: houd + ingedrukt om meerdere tegelijk te plakken", {duration:3500});
    }
  }, 1500);
  setupSearchBar();
  setupOfflineIndicator();
  setupTopShareBtn();
  setupPullToRefresh();
  setupServiceWorker();
  setupBarcode();
  // Swipe-down-to-close op beide sheets (1× binden — containers zijn persistent)
  attachSheetDismiss($("#sheet"), closeSheet);
  if(typeof closeSheet2==="function") attachSheetDismiss($("#sheet2"), closeSheet2);
  window.addEventListener("beforeunload", function(){
    if(typeof Cloud!=="undefined" && Cloud.stop) Cloud.stop();
  });
  var gb=$("#gear-btn"); if(gb) gb.addEventListener("click",function(){ switchTab(activeTab==="meer"?"lijst":"meer"); });

  // Keyboard-avoidance via visualViewport (iOS PWA).
  // Verschuift NIET de hele app (dat gaf scherm-sprong), maar tilt alleen
  // de add-balk net boven het toetsenbord via de --kb-lift CSS-var.
  if(window.visualViewport){
    var onVP=function(){
      var vv=window.visualViewport;
      // Toetsenbord-hoogte = layout-viewport minus zichtbaar gebied (+ eventuele scroll-offset)
      var kb = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop||0));
      // Kleine drempel tegen ruis (adresbalk-collaps e.d. is < ~90px)
      var open = kb > 90;
      document.documentElement.style.setProperty("--kb-lift", (open?kb:0) + "px");
      document.body.classList.toggle("kb-open", open);
    };
    window.visualViewport.addEventListener("resize",onVP,{passive:true});
    window.visualViewport.addEventListener("scroll",onVP,{passive:true});
  }

  $("#t-finish").addEventListener("click",finishShopping);

  document.querySelectorAll("[data-tab]").forEach(function(b){ b.addEventListener("click",function(){ switchTab(b.dataset.tab); }); });

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

  // Dubbeltik-zoom voorkomen op touch; op desktop mag dubbelklik gewoon tekst selecteren
  if(!(window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches)){
    document.addEventListener("dblclick",function(e){ e.preventDefault(); },{passive:false});
  }

  renderLijst(); renderDueBanner();
  switchTab("lijst");
  maybeIntro();
  // 1× per dag: voeg autoAdd-vaste-items met "bijna op"-status automatisch toe
  try{ runAutoAddDueItems(); }catch(e){}
  try{ handleLaunchParams(); }catch(e){}
  // PWA-installatie (Chromium): event bewaren voor de knop op de Meer-tab
  window.addEventListener("beforeinstallprompt", function(e){ e.preventDefault(); _installPrompt=e; if(activeTab==="meer") renderMeer(); });
  window.addEventListener("appinstalled", function(){ _installPrompt=null; toast("Mandje staat op je beginscherm ✓"); if(activeTab==="meer") renderMeer(); });
}

/* Start-parameters uit het manifest: snelkoppelingen (?focus=add, ?mode=shop), Android-share_target
   (?title=&text=&url= → "Plak meerdere"-sheet) en de PWA-start_url (?source=pwa). ?join/?send zijn van cloud.js.
   Na afhandeling verdwijnen de parameters uit de adresbalk, zodat een herlaad niets opnieuw doet. */
function handleLaunchParams(){
  var p; try{ p = new URLSearchParams(location.search); }catch(e){ return; }
  if(p.has("join") || p.has("send")) return;
  var known = ["focus","mode","text","title","url","source"];
  if(!known.some(function(k){ return p.has(k); })) return;
  var shared = [p.get("title")||"", p.get("text")||"", p.get("url")||""].map(function(t){ return t.trim(); }).filter(Boolean).join("\n");
  var focus = p.get("focus"), mode = p.get("mode");
  try{ history.replaceState(history.state, "", location.pathname + location.hash); }catch(e){}
  if(shared){
    // Gedeelde tekst: komma's/puntkomma's als scheidingsteken toestaan ("melk, brood, eieren" → drie regels)
    var lines = shared.split(/\r?\n|[;,]/).map(function(l){ return l.trim(); }).filter(Boolean).slice(0, 200);
    if(document.body.classList.contains("sheet-open")) closeSheet();
    openBulkPasteSheet();
    var ta = $("#bulk-input"); if(ta) ta.value = lines.join("\n");
    return;
  }
  if(mode==="shop"){
    if(state.list.some(function(i){ return !i.done; })){ openShoppingMode(); }
    else { toast("Je lijst is leeg — voeg eerst iets toe"); setTimeout(function(){ var i=$("#add-name"); if(i) i.focus(); }, 300); }
    return;
  }
  if(focus==="add"){ setTimeout(function(){ var i=$("#add-name"); if(i){ i.focus(); try{ i.scrollIntoView({block:"nearest"}); }catch(x){} } }, 300); }
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
  window.addMeal = addMeal;
  window.addMealToList = addMealToList;
  window.deleteMeal = deleteMeal;
  window.mealList = mealList;
  window.mapOFFCategory = mapOFFCategory;
  window.lookupBarcode = lookupBarcode;
  window.openShoppingMode = openShoppingMode;
  window.shopToggle = shopToggle;
  window.closeShoppingMode = closeShoppingMode;
  window.renderShopBody = renderShopBody;
  window.flipList = flipList;
  window.scrollToRow = scrollToRow;
  window.classify = classify;
  window.matchKey = matchKey;
  window.snoozeDue = snoozeDue;
  window.finishShopping = finishShopping;
  window.frequentItems = frequentItems;
  window.recordTrip = recordTrip;
  window.openFinishSheet = openFinishSheet;
  window.repeatLastTrip = repeatLastTrip;
  window.addStore = addStore;
  window.createLocalList = createLocalList;
  window.listAsText = listAsText;
  window.saveNow = saveNow;
  window.switchLocalList = switchLocalList;
  window.deleteLocalList = deleteLocalList;
  window.duplicateLocalList = duplicateLocalList;
  window.renameLocalList = renameLocalList;
  window.localLists = localLists;
  window.currentListMeta = currentListMeta;
  window.isPlainList = isPlainList;
  window.openNewListSheet = openNewListSheet;
  window.openListManageSheet = openListManageSheet;
  window.finishPlain = finishPlain;
  window.reorderPlainItems = reorderPlainItems;
  window.templateItems = templateItems;
  window.addToList = addToList;
  window.toggleDone = toggleDone;
  window.activeStore = activeStore;
  window.currentCatOrder = currentCatOrder;
  window.shoppingWeekday = shoppingWeekday;
  window.renameCatalogEntry = renameCatalogEntry;
  window.openCatalogSheet = openCatalogSheet;
  window.renderWeekRitual = renderWeekRitual;
  window.refreshTopShareBtn = refreshTopShareBtn;
  window.getCloudRef = function(){
    if(typeof window !== "undefined" && window.__cloudRef) return window.__cloudRef;
    return (typeof Cloud !== "undefined") ? Cloud : null;
  };
  window.getCloudStateSummary = function(){ return getCloudStateSummary(); };
  window.__shouldAcceptCloudList = shouldAcceptCloudList;
  window.copyText = (typeof copyText==="function") ? copyText : null;
  window.shareNative = (typeof shareNative==="function") ? shareNative : null;
  if(typeof updateSubhead === "function"){ window.updateSubhead = updateSubhead; }
  if(typeof Cloud !== "undefined") window.Cloud = Cloud;
  if(typeof avatarHtml==="function") window.avatarHtml = avatarHtml;
  window.__getLocalMutationEpoch = function(){ return _localMutationEpoch; };
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
else init();

})();

