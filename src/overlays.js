/* ============================================================
   OVERLAYS — overlay-stack, systeem-back, focus, sheet-hulp, toetsenbord
   ============================================================
   Plain-script module: geen export, geen "use strict", alleen function-
   declaraties en `var`. build.js voegt dit bestand BINNEN dezelfde IIFE
   vóór app.js in, dus alles hier is gehoist en overal in de app bereikbaar.
   App-functies waarnaar hier verwezen wordt ($, hideAC, switchTab,
   openShoppingMode, activeTab, state) bestaan pas op runtime — daarom
   overal typeof-guards, nooit op definitie-tijd aanroepen.

   INTEGRATIEPUNTEN (wiring gebeurt in app.js / cloud.js, niet hier):
   ─────────────────────────────────────────────────────────────
   app.js
     openSheetUI()             → modalOpen($("#sheet"), closeSheet)
     closeSheet()              → modalClose($("#sheet"))
     openShoppingMode()        → modalOpen($("#shop-screen"), closeShoppingMode)
     closeShoppingMode()       → modalClose($("#shop-screen"))
     openBarcodeScanScreen()   → modalOpen($("#barcode-screen"), closeBarcodeScanScreen)
     closeBarcodeScanScreen()  → modalClose($("#barcode-screen"))
     initApp()                 → document.addEventListener("keydown", onGlobalKey)
     sheets die hun innerHTML herschrijven (multi-step: intro, bulk, item-sheet)
                               → setSheetContent($("#sheet"), html, closeSheet)
                                 (of: injectSheetX($("#sheet"), closeSheet) ná innerHTML)
   cloud.js
     openSheet2()              → modalOpen($("#sheet2"), closeSheet2)
                                 + injectSheetX(s, closeSheet2) ná innerHTML
     closeSheet2()             → modalClose($("#sheet2"))
     openSendScreen()          → modalOpen($("#send-screen"), <sluitfunctie>, {history:false})
                                 (deep-link-scherm: géén history-entry, anders
                                  sluit Android-back hem meteen weer)
       …en de bijbehorende sluiter → modalClose($("#send-screen"))
   shell.html (CSS, niet hier)
     .sheet-x                  → positie/zichtbaarheid van de X-knop; toon 'm
                                 bijv. alleen bij (hover:hover) and (pointer:fine)
                                 of in de "dialog"/"panel"-layout (zie sheetLayout()).

   GEDRAG IN HET KORT
   ─────────────────────────────────────────────────────────────
   • LIFO-stack `_modals` van {el, close, prevFocus, hist, id}.
   • Eerste overlay maakt #main/#topbar/#addwrap/#totals inert; elke
     volgende overlay maakt de overlay eronder inert. Sluiten herstelt dat.
   • Android/desktop-back: per overlay één history.pushState({mandje:"modal",
     id}). Eén popstate-listener vergelijkt event.state.id met de stack en
     sluit ALLE overlays met een hoger id (LIFO) — robuust tegen ingeslikte
     of samengevoegde popstates. Sluit de UI zelf, dan doet modalClose
     history.back(); komt de sluiting uit een popstate, dan niet (vlag).
   • Focus: na 300 ms naar [autofocus] in de overlay of de overlay zelf;
     bij sluiten terug naar het element dat focus had (mits nog in de DOM
     en niet inert).
   • Toetsenbord (onGlobalKey): Escape-hiërarchie, Tab-trap in de bovenste
     overlay, ⌘/Ctrl+K → naar invoerveld, en zonder overlay/veld: "/" zoeken,
     "n" nieuw item, "w" winkelmodus.
   ============================================================ */

var BG_INERT_SEL = "#main, #topbar, #addwrap, #totals";
var MQ_PANEL  = "(min-width:1024px) and (orientation:landscape), (min-width:1200px)";
var MQ_DIALOG = "(min-width:768px) and (min-height:600px), (max-height:480px) and (orientation:landscape)";
var HAS_POINTER = (function(){
  try{
    return typeof window!=="undefined" && typeof window.matchMedia==="function" &&
           !!window.matchMedia("(hover:hover) and (pointer:fine)").matches;
  }catch(e){ return false; }
})();

var _modals = [];          // LIFO-stack van open overlays
var _modalSeq = 0;         // oplopend uniek id (ook het history-token)
var _popClosing = false;   // true zolang een sluiting uit een popstate komt
var _popBound = false;     // popstate-listener maar 1× binden
/* Sessie-nonce in elk history-token. Na een herlaad blijft history.state van de
   vorige page-load staan (met een id dat hoger kan zijn dan onze verse teller);
   tokens met een andere nonce tellen daarom als "geen token" (id 0). */
var _modalSession = (function(){
  try{ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }catch(e){ return "s"; }
})();

function _q(sel){ return document.querySelector(sel); }
function _qa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
function _modalIndex(el){
  for(var i=0;i<_modals.length;i++){ if(_modals[i].el===el) return i; }
  return -1;
}
function _setInert(el, on){
  if(!el) return;
  if(on) el.setAttribute("inert",""); else el.removeAttribute("inert");
}
function _setBgInert(on){
  _qa(BG_INERT_SEL).forEach(function(n){ _setInert(n, on); });
}
/* Herstel de inert-laag na een wijziging in de stack: alles onder de top
   inert, de top zelf vrij; zonder overlays is de achtergrond weer vrij. */
function _syncInert(){
  if(!_modals.length){ _setBgInert(false); return; }
  _setBgInert(true);
  for(var i=0;i<_modals.length;i++){ _setInert(_modals[i].el, i<_modals.length-1); }
}
/* id uit een history-state; 0 = geen, vreemde, of verouderde (andere sessie) state. */
function _stateId(st){
  return (st && st.mandje==="modal" && st.s===_modalSession && typeof st.id==="number") ? st.id : 0;
}
function _isInert(node){
  try{ return !!(node && node.closest && node.closest("[inert]")); }catch(e){ return false; }
}

/* ---------- Overlay-stack ---------- */
function modalTop(){ return _modals.length ? _modals[_modals.length-1] : null; }

var _pendingBack = null;   // overlay waarvan de history-entry nog teruggedraaid moet worden (uitgesteld naar een microtask)
function modalOpen(el, closeFn, opts){
  if(!el || _modalIndex(el)!==-1) return null;   // dubbele registratie negeren
  opts = opts || {};
  var entry = {
    el: el,
    close: (typeof closeFn==="function") ? closeFn : function(){ modalClose(el); },
    prevFocus: (typeof document!=="undefined") ? document.activeElement : null,
    hist: null,
    id: ++_modalSeq,
    popClosing: false
  };
  if(!el.hasAttribute("role")) el.setAttribute("role","dialog");
  el.setAttribute("aria-modal","true");
  if(!el.hasAttribute("tabindex")) el.setAttribute("tabindex","-1");
  el.removeAttribute("inert");                          // defensief

  _modals.push(entry);
  _syncInert();

  _ensurePopstate();
  if(opts.history!==false && typeof history!=="undefined" && history && typeof history.pushState==="function"){
    try{
      // Sluit A → open B in dezelfde task: hergebruik A's entry (replaceState) i.p.v. pushState + uitgestelde back()
      if(_pendingBack){ _pendingBack = null; history.replaceState({mandje:"modal", id:entry.id, s:_modalSession}, ""); }
      else history.pushState({mandje:"modal", id:entry.id, s:_modalSession}, "");
      entry.hist = entry.id;
    }catch(e){ entry.hist=null; }
  }

  setTimeout(function(){
    if(modalTop()!==entry) return;                      // intussen gesloten of overdekt
    var active = document.activeElement;
    if(active && el.contains(active)) return;           // overlay heeft al focus
    var target = el.querySelector("[autofocus]") || el;
    try{ target.focus({preventScroll:true}); }catch(e){ try{ target.focus(); }catch(e2){} }
  }, 300);
  return entry;
}

function modalClose(el){
  var idx = _modalIndex(el);
  if(idx===-1) return false;
  var entry = _modals[idx];
  var wasTop = (idx===_modals.length-1);
  _modals.splice(idx,1);

  el.removeAttribute("aria-modal");
  el.removeAttribute("inert");                          // defensief
  _syncInert();

  // History: alleen terug als de sluiting uit de UI komt (niet uit een popstate)
  // en het de bovenste overlay was (anders zou back() de overlay erboven wegpoppen).
  if(entry.hist!=null && !entry.popClosing && !_popClosing && wasTop){
    // history.back() is asynchroon: een modalOpen in dezelfde task zou door de latere traversal weer
    // dichtgaan. Daarom uitstellen; opent er intussen een overlay, dan hergebruikt die deze entry.
    _pendingBack = entry;
    Promise.resolve().then(function(){
      if(_pendingBack!==entry) return;
      _pendingBack = null;
      try{ history.back(); }catch(e){}
    });
  }

  // Focus terug naar waar we vandaan kwamen
  if(wasTop){
    var pf = entry.prevFocus;
    if(pf && pf!==document.body && typeof pf.focus==="function" &&
       document.contains(pf) && !_isInert(pf)){
      try{ pf.focus({preventScroll:true}); }catch(e){ try{ pf.focus(); }catch(e2){} }
    }
  }
  return true;
}

/* Sluit één entry alsof het uit een popstate komt (geen history.back()). */
function _closeFromPop(entry){
  entry.popClosing = true;
  _popClosing = true;
  try{ entry.close(); }catch(e){}
  // Riep de close-functie modalClose niet aan? Dan zelf opruimen.
  if(_modalIndex(entry.el)!==-1) modalClose(entry.el);
  _popClosing = false;
}
function _onPopstate(ev){
  var sid = _stateId(ev ? ev.state : null);
  // Sluit alle overlays met een history-token boven de huidige state, LIFO.
  // Overlays zonder token ({history:false}) blijven staan: die sluit alleen de UI.
  for(var i=_modals.length-1;i>=0;i--){
    var m=_modals[i];
    if(m.hist!=null && m.hist>sid) _closeFromPop(m);
  }
}
function _ensurePopstate(){
  if(_popBound || typeof window==="undefined") return;
  _popBound = true;
  window.addEventListener("popstate", _onPopstate);
}

/* ---------- Sheet-hulpfuncties ---------- */
function sheetLayout(){
  if(typeof window==="undefined" || typeof window.matchMedia!=="function") return "bottom";
  try{
    if(window.matchMedia(MQ_PANEL).matches)  return "panel";
    if(window.matchMedia(MQ_DIALOG).matches) return "dialog";
  }catch(e){}
  return "bottom";
}
var SHEET_X_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
function injectSheetX(sheetEl, closeFn){
  if(!sheetEl) return null;
  var btn = sheetEl.querySelector(":scope > .sheet-x") || sheetEl.querySelector(".sheet-x");
  if(!btn){
    btn = document.createElement("button");
    btn.className = "sheet-x";
    btn.type = "button";
    btn.setAttribute("aria-label","Sluiten");
    btn.innerHTML = SHEET_X_SVG;
    sheetEl.insertBefore(btn, sheetEl.firstChild);
  }
  if(!btn._sxBound){
    btn._sxBound = true;
    btn.addEventListener("click", function(ev){
      ev.preventDefault();
      if(typeof closeFn==="function") closeFn();
      else modalClose(sheetEl);
    });
  }
  return btn;
}
function setSheetContent(sheetEl, html, closeFn){
  if(!sheetEl) return null;
  sheetEl.innerHTML = (html==null) ? "" : html;
  injectSheetX(sheetEl, closeFn);
  return sheetEl;
}

/* ---------- Focus-hulp ---------- */
var FOCUSABLE_SEL = 'a[href],area[href],button,input,select,textarea,summary,iframe,' +
                    'audio[controls],video[controls],[contenteditable=""],[contenteditable="true"],[tabindex]';
/* Let op: NIET op offsetParent filteren (jsdom heeft geen layout). */
function focusables(root){
  root = root || document;
  return _qa(FOCUSABLE_SEL, root).filter(function(n){
    if(n.disabled || n.hidden) return false;
    if(n.tagName==="INPUT" && n.type==="hidden") return false;
    if(n.closest && n.closest("[hidden]")) return false;
    if(n.getAttribute("aria-hidden")==="true") return false;
    var ti = n.getAttribute("tabindex");
    if(ti!==null && parseInt(ti,10)===-1) return false;
    return true;
  });
}
function trapTab(e, root){
  if(!root) return;
  var f = focusables(root);
  // Zichtbare toast-actieknoppen (Ongedaan/Opnieuw) staan buiten de overlay maar zijn niet inert: meenemen in de cyclus
  _qa("#toast.show .toast-action, #toast2.show .toast-action", document).forEach(function(b){ if(f.indexOf(b)===-1) f.push(b); });
  if(!f.length){ e.preventDefault(); try{ root.focus({preventScroll:true}); }catch(x){} return; }
  var first=f[0], last=f[f.length-1], a=document.activeElement;
  var inside = a && (root.contains(a) || f.indexOf(a)!==-1);
  if(e.shiftKey){
    if(!inside || a===first){ e.preventDefault(); try{ last.focus(); }catch(x){} }
  } else {
    if(!inside || a===last){ e.preventDefault(); try{ first.focus(); }catch(x){} }
  }
}
function _isEditable(t){
  if(!t || !t.tagName) return false;
  var tag = t.tagName;
  if(tag==="INPUT" || tag==="TEXTAREA" || tag==="SELECT") return true;
  if(t.isContentEditable) return true;
  try{ return !!(t.closest && t.closest('[contenteditable=""],[contenteditable="true"]')); }catch(e){ return false; }
}
function focusAdd(){
  if(typeof activeTab!=="undefined" && activeTab!=="lijst" && typeof switchTab==="function"){
    try{ switchTab("lijst"); }catch(e){}
  }
  var inp = _q("#add-name"); if(!inp) return;
  try{ inp.focus({preventScroll:true}); }catch(e){ try{ inp.focus(); }catch(e2){} }
  try{ inp.select(); }catch(e){}
}
function focusSearchOrAdd(){
  var bar = _q("#search-bar"), si = _q("#search-input");
  var searchVisible = !!(si && bar && !bar.classList.contains("collapsed") && !bar.hidden);
  if(searchVisible){
    try{ si.focus({preventScroll:true}); }catch(e){ try{ si.focus(); }catch(e2){} }
    try{ si.select(); }catch(e){}
    return;
  }
  focusAdd();
}

/* ---------- Toetsenbordlaag (bind op document in initApp) ---------- */
function onGlobalKey(e){
  if(!e || e.defaultPrevented || e.isComposing) return;
  var key = e.key;
  var top = modalTop();
  var t = e.target;
  var inField = _isEditable(t);

  if(key==="Escape" || key==="Esc"){
    var ac = _q("#ac-list");
    if(ac && ac.classList.contains("show") && typeof hideAC==="function"){ e.preventDefault(); hideAC(); return; }
    if(top){ e.preventDefault(); top.close(); return; }
    var si = _q("#search-input");
    if(si && document.activeElement===si){
      e.preventDefault();
      if(si.value){
        si.value = "";
        try{ si.dispatchEvent(new Event("input",{bubbles:true})); }catch(x){}
      } else {
        try{ si.blur(); }catch(x){}
      }
      return;
    }
    if(inField && typeof t.blur==="function"){ try{ t.blur(); }catch(x){} }
    return;
  }

  if(key==="Tab" && top){ trapTab(e, top.el); return; }

  if((e.metaKey || e.ctrlKey) && !e.altKey && (key==="k" || key==="K")){
    e.preventDefault();
    if(top) top.close();
    focusAdd();
    return;
  }

  // Enkel-toets-snelkoppelingen: alleen buiten velden, zonder overlay en zonder modifier
  if(inField || top || e.metaKey || e.ctrlKey || e.altKey) return;
  if(key==="/"){ e.preventDefault(); focusSearchOrAdd(); return; }
  if(key==="n"){ e.preventDefault(); focusAdd(); return; }
  if(key==="w"){
    if(typeof openShoppingMode!=="function") return;
    if(typeof activeTab==="undefined" || activeTab!=="lijst") return;
    if(typeof state==="undefined" || !state || !state.list || !state.list.some(function(i){ return !i.done; })) return;
    e.preventDefault();
    openShoppingMode();
    return;
  }
}

/* ---------- Exports voor de tests ---------- */
if(typeof window!=="undefined"){
  window.modalOpen=modalOpen; window.modalClose=modalClose; window.modalTop=modalTop;
  window.sheetLayout=sheetLayout; window.__HAS_POINTER=HAS_POINTER;
  window.onGlobalKey=onGlobalKey; window.setSheetContent=setSheetContent;
}
