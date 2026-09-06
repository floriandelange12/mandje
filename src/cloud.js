/* ============================================================
   CLOUD — gedeelde lijsten via Supabase
   ============================================================ */
/* >>> Sleutels staan in het config-blok bovenaan mandje.html (window.MANDJE_CONFIG) <<< */
var SUPABASE_URL = (window.MANDJE_CONFIG && window.MANDJE_CONFIG.SUPABASE_URL) || "";
var SUPABASE_ANON_KEY = (window.MANDJE_CONFIG && window.MANDJE_CONFIG.SUPABASE_ANON_KEY) || "";

/* Lidkleuren: witte initialen ≥ 5,5:1 op elke kleur (tests/contrast.js). Oude kleuren uit de database worden via MEMBER_COLOR_MAP vertaald. */
var MEMBER_COLORS = ["#24593F","#2F5FA8","#A8501A","#6D45A8","#B0325A","#1E6E6A","#7A5A0F","#B3432F"];
var MEMBER_COLOR_MAP = {"#2F7A4F":"#24593F","#3D8BFF":"#2F5FA8","#E0772E":"#A8501A","#9B5DE5":"#6D45A8","#E5446D":"#B0325A","#1FB6A8":"#1E6E6A","#C9A227":"#7A5A0F","#E07A5F":"#B3432F"};
function pickColor(){ return MEMBER_COLORS[Math.floor(Math.random()*MEMBER_COLORS.length)]; }
/* Kleuren uit de database komen van andere gebruikers: alleen een 6-cijferige hex mag in een
   style-attribuut landen (anders is een gedeelde lijst een XSS-vector). */
function safeColor(c){ c=String(c||"").toUpperCase(); if(MEMBER_COLOR_MAP[c]) c=MEMBER_COLOR_MAP[c]; return /^#[0-9A-F]{6}$/.test(c) ? c : "#24593F"; }
function initials(name){
  name=(name||"").trim(); if(!name) return "?";
  var p=name.split(/\s+/);
  return (p.length>1 ? (p[0][0]+p[1][0]) : name.slice(0,2)).toUpperCase();
}
/* VAPID public key (base64url) → Uint8Array voor pushManager.subscribe */
function urlB64ToUint8Array(base64String){
  var padding="=".repeat((4 - base64String.length % 4) % 4);
  var base64=(base64String + padding).replace(/-/g,"+").replace(/_/g,"/");
  var raw=atob(base64), arr=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i);
  return arr;
}

var SUPABASE_SDK_CDNS = [
  {name:"esm.sh",   url:"https://esm.sh/@supabase/supabase-js@2"},
  {name:"esm.run",  url:"https://esm.run/@supabase/supabase-js@2"},
  {name:"jspm.dev", url:"https://jspm.dev/@supabase/supabase-js@2"}
];
/* Eigen kopie van de SDK als los root-bestand (./supabase.js, in de SW-precache) — niet in het kritieke pad.
   In jsdom (tests) zijn er geen losse bestanden: dan direct null zodat de CDN-fallback synchroon faalt. */
function loadLocalSdk(){
  return new Promise(function(resolve){
    try{
      if(typeof window==="undefined" || typeof document==="undefined"){ resolve(null); return; }
      if(window.supabase){ resolve(window.supabase); return; }
      if(/jsdom/i.test(navigator.userAgent||"")){ resolve(null); return; }
      var s=document.createElement("script"); s.src="./supabase.js"; s.async=true;
      var done=false, t=setTimeout(function(){ if(done) return; done=true; resolve(null); }, 8000);
      s.onload=function(){ if(done) return; done=true; clearTimeout(t); resolve(window.supabase||null); };
      s.onerror=function(){ if(done) return; done=true; clearTimeout(t); resolve(null); };
      document.head.appendChild(s);
    }catch(e){ resolve(null); }
  });
}
function loadSupabaseSDK(){
  return new Promise(function(resolve, reject){
    var lastErr=null, i=0;
    function tryNext(){
      if(i>=SUPABASE_SDK_CDNS.length){ reject(lastErr || new Error("Geen verbinding gevonden")); return; }
      var cdn=SUPABASE_SDK_CDNS[i++]; var done=false;
      var timeout=setTimeout(function(){
        if(done) return; done=true;
        lastErr=new Error(cdn.name+" timeout (8s)");
        console.warn("Mandje: "+cdn.name+" timeout");
        tryNext();
      }, 8000);
      var imp; try{ imp=import(cdn.url); }catch(e){ imp=Promise.reject(e); }
      imp.then(function(mod){
        if(done) return; done=true; clearTimeout(timeout);
        console.log("Mandje: SDK geladen via "+cdn.name);
        resolve(mod);
      }, function(err){
        if(done) return; done=true; clearTimeout(timeout);
        lastErr=err;
        console.warn("Mandje: "+cdn.name+" faalde — "+(err && err.message || err));
        tryNext();
      });
    }
    tryNext();
  });
}

var Cloud = {
  enabled:false, sb:null, ready:false,
    me:null, userId:null,
    lists:[], active:null, members:[], channel:null, presenceTimer:null,
    profile:null, friends:[],
    initError:null, mode:"local", _initInProgress:false, _initToken:0, _openToken:0, _activeRefreshToken:0, _stateSummaryAt:0, _lastLogAt:0, _warnedAt:{},
    _initFailAt:0, _initFailReason:null, _canLogAt:0,
    _openLocalEpoch:0, _openStartedAt:0, _openRefreshToken:0, _openGateUntil:0,
    _notifiedEnabled:false, _notifiedError:false, _onlineBound:false, _onlineRecoverAt:0,

  cfg:function(){ return !!(SUPABASE_URL && SUPABASE_ANON_KEY); },

  loadMe:function(){
    try{ this.me=JSON.parse(localStorage.getItem("mandje.me")||"null"); }catch(e){}
    if(!this.me) this.me={display_name:"", color:pickColor()};
    this.me.color = safeColor(this.me.color);   // oude palette (vóór 2026-09-06) → nieuwe kleuren
  },
  saveMe:function(){ try{ localStorage.setItem("mandje.me", JSON.stringify(this.me)); }catch(e){} },
  myName:function(){ return (this.me && this.me.display_name) || "Ik"; },
  myEmoji:function(){ return (this.me && this.me.emoji) || ""; },
  _log:function(msg, isError){
    var now = (Date.now ? Date.now() : 0);
    if(now - (this._lastLogAt || 0) < 8000) return;
    this._lastLogAt = now;
    if(isError) console.warn("Mandje: "+msg); else console.log("Mandje: "+msg);
  },
   _canInitError:function(){
     try{
      if(!this.cfg()) return "Cloud uitgeschakeld: geen configuratie";
      if(typeof navigator !== "undefined" && navigator.onLine === false) return "Cloud uitgeschakeld: je bent offline";
      if(typeof navigator !== "undefined" && navigator.connection && navigator.connection.effectiveType === "2g") return "Cloud tijdelijk uitgeschakeld: netwerk te traag";
      if(!this._hasFetchLayer()) return "Cloud uitgeschakeld: netwerkservice niet beschikbaar";
    }catch(e){
      return "Cloud uitgeschakeld: technische fout";
    }
    return "";
  },
  _hasFetchLayer:function(){
    try{
      if(typeof fetch !== "function") return false;
      if(typeof window === "undefined") return true;
      return typeof window.fetch === "function";
    }catch(e){
      return false;
    }
  },
  _warned:function(key, msg){
    var now = (Date.now ? Date.now() : 0);
    if(now - ((this._warnedAt && this._warnedAt[key]) || 0) < 9000) return false;
    if(!this._warnedAt) this._warnedAt = {};
    this._warnedAt[key] = now;
    this._log(msg, true);
    return true;
  },
  _nextInitToken:function(){ this._initToken = (this._initToken || 0) + 1; return this._initToken; },
  _nextRefreshToken:function(){ this._activeRefreshToken = (this._activeRefreshToken || 0) + 1; return this._activeRefreshToken; },
  _isCurrentInit:function(token){ return !!token && token === this._initToken; },
  _isCurrentRefresh:function(token){ return !!token && token === this._activeRefreshToken; },
  _suppressNow:function(){ var n = (Date.now ? Date.now() : 0); if(n - (this._canLogAt || 0) < 7000) return true; this._canLogAt = n; return false; },
  getStateSummary:function(){
    return {
      mode:this.mode || "local",
      status:this.ready ? "ready" : (this.enabled ? "connecting" : "not_started"),
      ready:!!this.ready,
      activeListId:this.active || null,
      pendingMutations:Array.isArray((typeof state !== "undefined" && state && state.syncQueue) ? state.syncQueue : []) ? ((typeof state !== "undefined" && state && state.syncQueue) || []).length : 0,
      offline: this.mode === "local",
      reason:this.initError || null,
      lastUpdated:this._stateSummaryAt || 0
    };
  },
    _setOfflineMode:function(reason, noLog){
      var wasActive = this.active;
      this.enabled = false;
      this.ready = false;
      this.mode = "local";
      this.initError = reason || "Cloud niet beschikbaar";
      this.sb = null; this.userId = null;
      this.lists = [];
      this.members = [];
      this.friends = [];
      // Er stond een gedeelde lijst open: zet éérst de persoonlijke lijst terug in state.list,
      // anders schreef save() de cloud-items als persoonlijke lijst weg (stil dataverlies +
      // vervuiling). mandje.activeList blijft staan zodat reconnect de lijst weer opent.
      if(wasActive){
        if(typeof _personalList !== "undefined" && Array.isArray(_personalList)) state.list = _personalList.slice();
        else state.list = [];
      }
      this.active = null;
      this._initInProgress = false;
      this._notifiedEnabled = false;
      this._notifiedError = false;
      this._stateSummaryAt = Date.now ? Date.now() : 0;
      if(typeof this.stop==="function"){ try{ this.stop(); }catch(e){} }
      if(typeof renderListSwitch==="function") renderListSwitch();
      if(typeof renderMembersRow==="function") renderMembersRow();
      if(typeof renderShortcutsRow==="function") renderShortcutsRow();
      if(wasActive){
        if(typeof applyListType==="function") applyListType();
        if(typeof applyListHeader==="function") applyListHeader();
        if(typeof renderLijst==="function" && typeof activeTab!=="undefined" && activeTab==="lijst"){ renderLijst(); if(typeof renderDueBanner==="function") renderDueBanner(); }
        if(typeof renderShoppingMode==="function") renderShoppingMode();   // open winkelmodus toont anders nog de oude (cloud-)rijen
        if(typeof toast==="function") toast("Gedeelde lijst offline — je werkt nu in je eigen lijst", {duration:3500});
      }
      if(!noLog) this._warned("offline", this.initError);
      // Verbindingsprobleem (cloud wél geconfigureerd, wél online): eenmalig een toast met "Opnieuw" — niet in de subkop
      var configured = (typeof this.cfg === "function") ? !!this.cfg() : false;
      var isOnline = (typeof navigator === "undefined") || navigator.onLine !== false;
      if(configured && isOnline && !wasActive && !this._offlineToasted && typeof toast === "function"){
        this._offlineToasted = true;
        var self2 = this;
        toast("Cloud niet bereikbaar — je werkt in je eigen lijst", {duration:5000, action:"Opnieuw", onAction:function(){ self2._offlineToasted = false; if(!self2._initInProgress && !self2.ready) self2.init(); }});
      }
      if(typeof refreshOfflineBadge === "function") refreshOfflineBadge();
      if(typeof window !== "undefined"){
        if(typeof window.refreshTopShareBtn === "function") window.refreshTopShareBtn();
        if(typeof window.updateSubhead === "function") window.updateSubhead();
      }
    },
  _scheduleOnlineRecovery:function(){
    var self=this;
    if(typeof window === "undefined" || this._onlineBound) return;
    this._onlineBound=true;
    window.addEventListener("online", function(){
      if(typeof self.cfg === "function" && !self.cfg()) return;
      if(typeof self._canInit === "function" && !self._canInit()) return;
      if(self.ready){
        if(typeof self.flushPending === "function"){ self.flushPending(); }
        return;
      }
      var now = (Date.now ? Date.now() : 0);
      if(self._onlineRecoverAt > now) return;
      self._onlineRecoverAt = now + 1200;
      if(!self._initInProgress && !self.ready){
        self.init();
      }
    });
    window.addEventListener("offline", function(){
      if(self.ready){
        self._setOfflineMode(typeof navigator !== "undefined" && navigator.onLine === false ? "Cloud uitgeschakeld: je bent offline" : "Cloud uitgeschakeld", true);
      }
    });
  },
  _canInit:function(){
      if(!this.cfg()) return false;
      if(typeof navigator !== "undefined" && navigator.onLine === false) return false;
      if(typeof navigator !== "undefined" && navigator.connection && navigator.connection.effectiveType === "2g") return false;
      try{ if(!this._hasFetchLayer()) return false; }catch(e){ return false; }
      return true;
    },

  /* ---- profiel + vrienden ---- */
  syncProfile:async function(){
    if(!this.ready || !this.me || !this.me.display_name) return null;
    var r=await this.sb.rpc("ensure_profile",{p_name:this.me.display_name, p_color:this.me.color, p_emoji:this.me.emoji||""});
    if(r.error){ console.warn("ensure_profile faalde —", r.error); return null; }
    this.profile=r.data;
    // friendCode + inboxToken cachen in lokaal me-object
    if(r.data){ this.me.friendCode=r.data.friend_code; this.me.inboxToken=r.data.inbox_token; this.saveMe(); }
    return r.data;
  },
  loadFriends:async function(){
    if(!this.ready) return;
    var r=await this.sb.rpc("list_friends");
    if(r.error){ console.warn("list_friends faalde —", r.error); this.friends=[]; return; }
    this.friends=(r.data||[]).map(function(f){
      return { user_id:f.to_user_id, name:f.to_display_name||"Vriend", color:f.to_color||"#2F7A4F",
               emoji:f.to_emoji||"", friend_code:f.to_friend_code||"", inbox_token:f.to_inbox_token||null };
    });
    if(typeof renderShortcutsRow==="function") renderShortcutsRow();
  },
  /* ---- maaltijden/bundels (optioneel cross-device; vereist de 'meals'-tabel) ----
     Alles faalt stil als de tabel niet bestaat → bundels blijven dan puur lokaal. */
  loadMeals:async function(){
    if(!this.ready || !this.userId) return;
    try{
      var r=await this.sb.from("meals").select("*").eq("user_id", this.userId);
      if(r.error || !r.data) return;
      state.meals = state.meals || {};
      r.data.forEach(function(row){
        state.meals[row.id] = { id:row.id, name:row.name, emoji:row.emoji||"🍽️",
          items:Array.isArray(row.items)?row.items:[], updatedAt:row.updated_at };
      });
      if(typeof save==="function") save();
      if(activeTab==="vaste" && typeof renderVaste==="function") renderVaste();
    }catch(e){}
  },
  saveMeal:function(m){
    if(!this.ready || !this.userId || !m) return;
    try{ this.sb.from("meals").upsert({ id:m.id, user_id:this.userId, name:m.name, emoji:m.emoji,
      items:m.items, updated_at:new Date().toISOString() }).then(function(){},function(){}); }catch(e){}
  },
  deleteMeal:function(id){
    if(!this.ready || !this.userId) return;
    try{ this.sb.from("meals").delete().eq("id", id).eq("user_id", this.userId).then(function(){},function(){}); }catch(e){}
  },
  /* ---- web push (Fase 5, dormant tot VAPID_PUBLIC_KEY + backend bestaan) ---- */
  pushEnabled:function(){ return !!((window.MANDJE_CONFIG&&window.MANDJE_CONFIG.VAPID_PUBLIC_KEY)) && ("serviceWorker" in navigator) && ("PushManager" in window) && ("Notification" in window); },
  /* Geeft {ok, reason} terug: ok | unsupported | no-cloud | denied | dismissed | no-sw | error.
     iOS: alleen als de app op het beginscherm staat (anders is PushManager er niet). */
  subscribeToPush:async function(){
    if(!this.pushEnabled()) return {ok:false, reason:"unsupported"};
    if(!this.ready || !this.userId) return {ok:false, reason:"no-cloud"};
    var key=window.MANDJE_CONFIG.VAPID_PUBLIC_KEY;
    try{
      var perm=null;
      try{
        perm=await new Promise(function(res){
          var p=null;
          try{ p=Notification.requestPermission(function(r){ res(r); }); }catch(e){ res(Notification.permission); return; }
          if(p && typeof p.then==="function") p.then(res, function(){ res(Notification.permission); });
        });
      }catch(e){ perm=Notification.permission; }
      if(perm!=="granted") return {ok:false, reason:(perm==="denied" ? "denied" : "dismissed")};
      var reg=await Promise.race([navigator.serviceWorker.ready, new Promise(function(res){ setTimeout(function(){ res(null); }, 8000); })]);
      if(!reg || !reg.pushManager) return {ok:false, reason:"no-sw"};
      var sub=await reg.pushManager.getSubscription();
      if(!sub) sub=await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlB64ToUint8Array(key) });
      var j=sub.toJSON();
      var row={
        user_id:this.userId, endpoint:sub.endpoint,
        p256dh:(j.keys&&j.keys.p256dh)||"", auth:(j.keys&&j.keys.auth)||"",
        updated_at:new Date().toISOString()
      };
      if(this._hasPrefs!==false) row.prefs=this._pushPrefs();
      var r=await this.sb.from("push_subscriptions").upsert(row, { onConflict:"endpoint" });
      if(r.error && this._isMissingCol(r.error, "prefs")){ this._hasPrefs=false; delete row.prefs; r=await this.sb.from("push_subscriptions").upsert(row, { onConflict:"endpoint" }); }
      if(r.error){ console.warn("Mandje: push_subscriptions upsert faalde", r.error); return {ok:false, reason:"error"}; }
      this._hasPrefs=true;
      if(typeof state!=="undefined" && state && state.settings){ state.settings.pushOn = true; if(typeof save==="function") save(); }
      return {ok:true, reason:"ok"};
    }catch(e){ console.warn("Mandje: push aanzetten faalde", e); return {ok:false, reason:"error"}; }
  },
  _hasPrefs:undefined, _shopNotifiedFor:null, _shopNotifiedAt:0,
  _pushPrefs:function(){ return (typeof pushPrefs==="function") ? pushPrefs() : {op:true, shopping:true}; },
  /* Voorkeur per soort bijwerken op het bestaande abonnement */
  updatePushPrefs:async function(){
    if(!this.ready || !this.sb || this._hasPrefs===false) return false;
    try{
      var reg=await navigator.serviceWorker.ready; var sub=await reg.pushManager.getSubscription(); if(!sub) return false;
      var r=await this.sb.from("push_subscriptions").update({prefs:this._pushPrefs(), updated_at:new Date().toISOString()}).eq("endpoint", sub.endpoint);
      if(r.error){ if(this._isMissingCol(r.error,"prefs")) this._hasPrefs=false; return false; }
      return true;
    }catch(e){ return false; }
  },
  /* "Ik ga winkelen" → huisgenoten krijgen (hooguit 1× per 2 u per lijst, ook serverside) een seintje */
  notifyShoppingStart:function(){
    if(!this.ready || !this.sb || !this.active) return;
    var l=this.activeList(); if(!l || ((l.member_count||1)<2 && (this.members||[]).length<2)) return;
    var now=Date.now();
    if(this._shopNotifiedFor===this.active && now-this._shopNotifiedAt<7200000) return;
    this._shopNotifiedFor=this.active; this._shopNotifiedAt=now;
    try{ this.sb.rpc("start_shopping",{p_list_id:this.active}).then(function(){},function(){}); }catch(e){}
  },
  unsubscribePush:async function(){
    // Voorkeur éérst uitzetten (vóór de await) zodat een parallelle init niet her-abonneert
    if(typeof state!=="undefined" && state && state.settings){ state.settings.pushOn = false; if(typeof save==="function") save(); }
    try{
      var reg=await navigator.serviceWorker.ready;
      var sub=await reg.pushManager.getSubscription();
      if(sub){ var ep=sub.endpoint; await sub.unsubscribe(); if(this.ready) this.sb.from("push_subscriptions").delete().eq("endpoint", ep).then(function(){},function(){}); }
      return true;
    }catch(e){ return false; }
  },
  checkPushSubscription:async function(){
    if(!this.pushEnabled() || !this.ready) return;
    var st = (typeof state!=="undefined" && state && state.settings) ? state.settings : null;
    if(!st) return;
    if(st.pushOn == null){
      // Eenmalig verzoenen voor bestaande installaties: was er al een abonnement, dan staat de voorkeur 'aan'
      try{
        var has=false;
        if(Notification.permission==="granted"){ var reg0=await navigator.serviceWorker.ready; has=!!(await reg0.pushManager.getSubscription()); }
        st.pushOn = has;
      }catch(e){ st.pushOn=false; }
      if(typeof save==="function") save();
      if(typeof activeTab!=="undefined" && activeTab==="meer" && typeof renderMeer==="function") renderMeer();
    }
    if(!st.pushOn) return;   // uitgezet = uit
    try{
      if(Notification.permission!=="granted") return;        // alleen her-abonneren als eerder toegestaan
      var reg=await navigator.serviceWorker.ready;
      var sub=await reg.pushManager.getSubscription();
      if(!sub) await this.subscribeToPush();                 // iOS kan een abonnement droppen → herstel
    }catch(e){}
  },
  friendByUser:function(uid){ for(var i=0;i<this.friends.length;i++) if(this.friends[i].user_id===uid) return this.friends[i]; return null; },
  addFriend:async function(code){
    code=(code||"").trim(); if(!code) return null;
    if(!this.ready){ toast("Even moment — we zijn nog niet klaar"); return null; }
    var r=await this.sb.rpc("add_friend",{p_friend_code:code});
    if(r.error){ toast(r.error.message||"Toevoegen lukte niet"); return null; }
    await this.loadFriends();
    var nm=(r.data && r.data.to_display_name) || "Je vriend";
    toast(nm+" is nu je vriend 🎉");
    return r.data;
  },
  removeFriend:async function(uid){
    var r=await this.sb.from("friendships").delete().eq("from_user_id", this.userId).eq("to_user_id", uid);
    if(r.error){ toast("Verwijderen lukte niet"); return false; }
    await this.loadFriends();
    return true;
  },
  sendToFriend:function(friend, itemName){
    var nm=(itemName||"").trim(); if(!nm || !friend || !friend.inbox_token) return Promise.resolve(false);
    var from=this.myName();
    return this.sb.rpc("add_item_via_token",{p_token:friend.inbox_token, p_name:nm, p_qty:1, p_note:"", p_from:from})
      .then(function(r){ return !r.error; }, function(){ return false; });
  },
  addFriendToList:async function(listId, friendUserId){
    var r=await this.sb.rpc("add_friend_to_list",{p_list_id:listId, p_friend_user_id:friendUserId});
    if(r.error){ toast(r.error.message||"Toevoegen lukte niet"); return false; }
    await this.refreshMembers(); await this.loadLists();
    toast("Vriend toegevoegd aan de lijst");
    return true;
  },
  /* Oud pad (Meer-knop vóór Fase 3C): e-mail koppelen zonder codeblad */
  secureWithEmail:function(email){
    return this.linkEmail(email).then(function(r){ toast(r.ok ? "Check je mail voor de code ✉️" : (r.message||"Lukte niet — klopt het e-mailadres?")); return !!r.ok; });
  },
  memberById:function(id){ for(var i=0;i<this.members.length;i++) if(this.members[i].id===id) return this.members[i]; return null; },
  listById:function(id){ for(var i=0;i<this.lists.length;i++) if(this.lists[i].id===id) return this.lists[i]; return null; },
  activeList:function(){ return this.active ? this.listById(this.active) : null; },

  init:async function(){
      var canMsg = this._canInitError();
      if(canMsg){
        this._setOfflineMode(canMsg, true);
        return;
      }
      if(this._initInProgress) return;
      var initToken = this._nextInitToken();
      this._initInProgress = true;
      this.enabled = true;
      this._notifiedEnabled = false;
      this._notifiedError = false;
      this._stateSummaryAt = Date.now ? Date.now() : 0;
      this.initError = null;
      this.loadMe();
      Shortcuts.load();
      var self=this;
      var guard = function(allowLog){
        if(!self._isCurrentInit(initToken)) return false;
        if(!self._canInit()){
          self._setOfflineMode(typeof navigator !== "undefined" && navigator.onLine === false ? "Cloud uitgeschakeld: je bent offline" : "Cloud niet beschikbaar op dit toestel", allowLog === false);
          return false;
        }
        return true;
      };
      this._scheduleOnlineRecovery();
    var params=new URLSearchParams(location.search);
      try{
        var sdk = (typeof window!=="undefined" && window.supabase) ? window.supabase : null;
        if(!guard(true) || !this._canInit()){ 
          return;
        }
        if(!sdk){ sdk = await loadLocalSdk(); }
        if(!sdk){ self._warned("sdk", "Mandje: lokale SDK niet geladen, val terug op CDN"); sdk = await loadSupabaseSDK(); }
        if(!sdk || typeof sdk.createClient !== "function"){ throw new Error("Supabase SDK niet beschikbaar"); }
        if(!this.sb) this.sb=sdk.createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
          {auth:{persistSession:true, autoRefreshToken:true, storageKey:"mandje.sb.auth"}});   // hergebruik na inloggen/uitloggen (één GoTrue-client)
        this._restoreQueue();   // offline-wijzigingen van een vorige sessie

        if(!guard(true)){
          return;
        }

        var s;
        try{
          s=await this.sb.auth.getSession();
        }catch(e){
          throw new Error("Cloud-sessie opvragen faalde");
        }
        if(!self._isCurrentInit(initToken)) return;
        if(!s.data || !s.data.session){
          if(!guard(true)) return;
          var r;
          try{
            r=await this.sb.auth.signInAnonymously();
          }catch(e){
            throw new Error("Anoniem aanmelden niet mogelijk");
          }
          if(r.error){
            console.warn("Mandje: anonieme aanmelding faalde", r.error);
            this.initError = "Niet ingelogd kunnen krijgen — check je internet";
            throw r.error;
          }
        }
        if(!guard(true)) return;
        var u=await this.sb.auth.getUser(); this.userId=(u.data&&u.data.user)?u.data.user.id:null;
        try{ var s2=await this.sb.auth.getSession(); this._accessToken=(s2.data&&s2.data.session&&s2.data.session.access_token)||null; }catch(e){}
        this._bindAuth();
        this._setAuthUser(u.data&&u.data.user);
        if(typeof mirrorAuthSession==="function") mirrorAuthSession();
        this.ready=true;
        this.mode="cloud";
        this._stateSummaryAt = Date.now ? Date.now() : 0;
        this._notifiedEnabled = false;
        this._notifiedError = false;
        if(typeof refreshOfflineBadge === "function") refreshOfflineBadge();   // "Lokaal"-pil weg zodra de cloud er is
        if(typeof window !== "undefined"){
          if(typeof window.refreshTopShareBtn === "function") window.refreshTopShareBtn();
          if(typeof window.updateSubhead === "function") window.updateSubhead();
        }

        if(params.get("send")){
          openSendScreen(params.get("send"));
          return;
        }
  
        await this.loadLists();
        if(!self._isCurrentInit(initToken)) return;

      if(this.me && this.me.display_name){ await this.syncProfile(); }
      await this.loadFriends();
      await this.pullUserState();   // catalogus/instellingen/bundels/geschiedenis/lijsten van je andere toestellen
      this.loadMeals();
      this.checkPushSubscription();

      if(params.get("friend")){
        var fcode = params.get("friend");
        try{ history.replaceState({}, "", location.pathname); }catch(e){}
        ensureIdentity(function(){
          Cloud.syncProfile().then(function(){ Cloud.addFriend(fcode); });
        });
      }

        if(params.get("join")){
          await ensureIdentity(function(){ Cloud.joinList(params.get("join")); });
        } else {
          var act=localStorage.getItem("mandje.activeList");
          var wantList=params.get("list");
          if(wantList){ try{ history.replaceState({}, "", location.pathname); }catch(e){} if(this.listById(wantList)) act=wantList; }
          if(act && act!=="local"){
          if(this.listById(act)){
            await this.open(act);
          } else if(this._listsOk!==false){   // alleen 'vergeten' als de lijsten écht geladen zijn (niet bij een tijdelijke fout)
            try{ localStorage.setItem("mandje.activeList","local"); }catch(e){}
            setTimeout(function(){ toast("Vorige lijst is niet meer beschikbaar"); }, 600);
          }
        }
      }
      }catch(e){
        if(!self._isCurrentInit(initToken)) return;
        this.initError = (e && (e.message || String(e))) || "Cloud init gefaald";
        if(/Sign in|aanmelden|failed|network|networkerror|fetch|timeout/i.test(this.initError + "")){
          this.initError = "Cloud niet bereikbaar — werk nu in lokale modus";
        }
        this._initFailReason = this.initError;
        this._initFailAt = Date.now ? Date.now() : 0;
        var shouldLog = !this._suppressNow();
        if(shouldLog){ self._warned("init", "Cloud init faalde: "+this.initError); }
        this._setOfflineMode(this.initError, !shouldLog);
      }finally{
        if(self._isCurrentInit(initToken)) this._initInProgress = false;
      }
      if(self._isCurrentInit(initToken)){
        renderListSwitch(); renderMembersRow(); renderShortcutsRow();
        if(this.ready && this._pending.length) this.flushPending();
      }
    },
  /* App komt terug in beeld (tab/venster/telefoon): lijst en leden verversen, wachtrij versturen — hooguit 1× per 3 s */
  onResume:function(){
    var now=Date.now ? Date.now() : 0;
    if(now - (this._resumeAt||0) < 3000) return;
    this._resumeAt=now;
    if(!this.ready || !this.sb) return;
    if(this.active){ this.refreshItems(this._activeRefreshToken); this.refreshMembers(this._activeRefreshToken); }
    this.flushPending();
    if(now - (this._usLastPullAt||0) > 60000) this.pullUserState();
    if(!this.hasAccount() && now - (this._authCheckAt||0) > 60000){ this._authCheckAt=now; this.refreshAuthUser(); }   // link in de mail getikt? dan is de koppeling nu klaar
  },

  loadLists:async function(){
    var r=await this.sb.from("lists").select("*").order("created_at",{ascending:true});
    this._listsOk = !r.error;
    if(r.error){
      console.warn("loadLists faalde:", r.error);
      this.lists=[];
      toast("Kon je lijsten niet ophalen — internet aan?");
      renderListSwitch();
      return;
    }
    this.lists=r.data||[];
    if(this.lists.length){
      var ids=this.lists.map(function(l){return l.id;});
      var rm=await this.sb.from("members").select("list_id,user_id").in("list_id", ids);
      var counts={};
      if(!rm.error && rm.data){
        rm.data.forEach(function(m){ counts[m.list_id]=(counts[m.list_id]||0)+1; });
      }
      this.lists.forEach(function(l){ l.member_count=counts[l.id]||1; });
    }
  },

    open:async function(listId){
      if(this._flagsPrimedFor!==listId){ this._seenFlags={}; this._flagsPrimedFor=null; }
      // Bewaar de persoonlijke lijst vóór we de cloud-items in state.list laden (alleen als we
      // nu nog op Persoonlijk staan; bij cloud→cloud houden we de bestaande snapshot).
      var refreshToken = this._nextRefreshToken();
      if(!this.active && typeof _personalList!=="undefined") _personalList = (state.list||[]).slice();
      this._openRefreshToken = refreshToken;
      this._openLocalEpoch = (typeof window !== "undefined" && typeof window.__mandjeLocalMutationEpoch === "number") ? window.__mandjeLocalMutationEpoch : 0;
      this._openStartedAt = Date.now ? Date.now() : 0;
      this._openGateUntil = this._openStartedAt + 1400;
      if(typeof state === "object" && state._meta){
        state._meta.lastCloudOpenAt = this._openStartedAt;
        state._meta.restoreMode = "cloud";
      }
      if(this.active!==listId && typeof _assignFilter!=="undefined") _assignFilter=null;   // lid-filter is lijstgebonden
      this.active=listId; try{ localStorage.setItem("mandje.activeList", listId); }catch(e){}
      await this.refreshItems(refreshToken); await this.refreshMembers(refreshToken);
      this.subscribe(listId); this.startPresence();
      this.loadHouseholdHistory(listId);
      if(typeof applyListType==="function") applyListType();
      applyListHeader(); renderListSwitch(); renderMembersRow();
    },
    openLocal:function(){
      // Eerst een uitgestelde save() wegschrijven zolang 'active' nog gezet is (bron = _personalList, niet de
      // cloud-items in state.list), en de persoonlijke lijst terugzetten vóórdat load() draait.
      if(typeof _savePending!=="undefined" && _savePending && typeof saveNow==="function") saveNow();
      if(typeof _personalList !== "undefined" && Array.isArray(_personalList)) state.list = _personalList.slice();
      this._nextRefreshToken();
      this._openRefreshToken = 0;
      this._openLocalEpoch = 0;
      this._openStartedAt = 0;
      this._openGateUntil = 0;
      if(typeof state === "object" && state._meta){
        state._meta.restoreMode = "local";
        state._meta.lastLocalOpenAt = Date.now ? Date.now() : 0;
      }
      this.active=null; try{ localStorage.setItem("mandje.activeList","local"); }catch(e){}
      this.stop();
      load(); if(typeof applyListType==="function") applyListType(); applyListHeader(); renderListSwitch(); renderMembersRow();
    renderLijst(); renderDueBanner();
  },
  stop:function(){
    if(this.channel){ try{ this.sb.removeChannel(this.channel); }catch(e){} this.channel=null; }
    if(this.presenceTimer){ clearInterval(this.presenceTimer); this.presenceTimer=null; }
    this.present=[]; if(typeof renderPresence==="function") renderPresence();
  },
    refreshItems:async function(token){
      token = token || this._activeRefreshToken;
      if(!token) return;
      var listId = this.active;
      if(!listId || !this._isCurrentRefresh(token)) return;
      if(this._refreshing){ this._refreshAgain=true; return; }   // al bezig: daarna nog één keer
      this._refreshing=true;
      try{
        var r;
        if(this._hasBoughtAt!==false){
          r=await this.sb.from("items").select("*").eq("list_id",listId).is("bought_at", null).order("created_at",{ascending:false});
          if(r.error && this._isMissingCol(r.error, "bought_at")){ this._hasBoughtAt=false; r=null; }
          else if(!r.error && this._hasBoughtAt===undefined){ this._hasBoughtAt=true; }
        }
        if(!r) r=await this.sb.from("items").select("*").eq("list_id",listId).order("created_at",{ascending:false});
        if(!this._isCurrentRefresh(token) || this.active!==listId) return;
        var now = Date.now ? Date.now() : 0;
        var localEpoch = (typeof window !== "undefined" && typeof window.__mandjeLocalMutationEpoch === "number") ? window.__mandjeLocalMutationEpoch : 0;
        var openEpoch = Number(this._openLocalEpoch || 0);
        var skipMerge = (localEpoch > openEpoch && this._openStartedAt && (now - Number(this._openStartedAt)) < 2600);
        if(r.error){
          state.list=[];
          if(activeTab==="lijst"){ renderLijst(); renderDueBanner(); }
          this._warned("refreshItems", "refreshItems faalde: "+((r.error && (r.error.message || r.error.code)) || "onbekend"));
          toast("Items willen niet laden — probeer 't straks");
          return;
        }
        var oldById = {}, self=this;
        state.list.forEach(function(it){ oldById[it.id]=it; });
        var mapped = (r.data||[]).filter(function(it){ return !self._deletedIds[it.id]; }).map(function(it){
          var old = oldById[it.id];
          var fresh = {
            id:it.id, name:it.name, category:it.category||classify(it.name), qty:it.qty||1,
            price:(it.price==null?null:Number(it.price)), note:it.note||"", done:!!it.done,
            unit:(it.unit!=null ? it.unit : ((old&&old.unit)||"")), assigned_to:it.assigned_to||null, added_by_name:it.added_by_name||"", addedAt:it.created_at,
            flaggedAt:it.flagged_at||null, flaggedBy:it.flagged_by_name||""
          };
          if(old && old.name===fresh.name && old.qty===fresh.qty && old.done===fresh.done && old.price===fresh.price && (old.note||"")===(fresh.note||"") && (old.unit||"")===(fresh.unit||"") && old.assigned_to===fresh.assigned_to && (old.category||"")===(fresh.category||"") && (old.flaggedAt||"")===(fresh.flaggedAt||"")){
            return old;
          }
          return fresh;
        });
        var acceptCloudList = true;
        if(typeof shouldAcceptCloudList === "function"){
          acceptCloudList = shouldAcceptCloudList(mapped, {
            openLocalEpoch: Number(this._openLocalEpoch || 0),
            openStartedAt: Number(this._openStartedAt || 0)
          });
        }
        if(!acceptCloudList){
          this._warned("refreshItems", "Cloud-refresh genegeerd: lokale versie is nieuwer");
          return;
        }
        if(skipMerge){
          state.list.forEach(function(localRow){
            if(!localRow || !localRow.id) return;
            if(!mapped.some(function(remoteRow){ return remoteRow.id === localRow.id; })){
              mapped.push(localRow);
            }
          });
          mapped.sort(function(a,b){
            var at = +new Date(a.addedAt || 0);
            var bt = +new Date(b.addedAt || 0);
            return bt - at;
          });
        }
        state.list = mapped;
        this._noticeFlags(listId, mapped);
        this._cacheList(listId, mapped);
        if(activeTab==="lijst"){ renderLijst(); renderDueBanner(); }
        if(typeof renderShoppingMode==="function") renderShoppingMode();
      }catch(e){
        if(!this._isCurrentRefresh(token) || this.active!==listId) return;
        this._warned("refreshItems", "refreshItems faalde: "+((e && (e.message || e.code)) || "onbekend"));
        state.list=[];
        if(activeTab==="lijst"){ renderLijst(); renderDueBanner(); }
        toast("Items willen niet laden — probeer 't straks");
      }finally{
        this._refreshing=false;
        if(this._refreshAgain){ this._refreshAgain=false; var self3=this; setTimeout(function(){ self3.refreshItems(self3._activeRefreshToken); }, 50); }
      }
    },
    /* Laatst gezien items per gedeelde lijst — voor een koude start zonder verbinding (Fase 3) */
    _cacheList:function(listId, items){
      try{
        if(typeof state==="undefined" || !state) return;
        state.cloudCache = state.cloudCache || {};
        var l=this.listById(listId);
        state.cloudCache[listId] = { name:(l && l.name) || "Gedeelde lijst", at:new Date().toISOString(),
          items:(items||[]).slice(0,300).map(function(i){ return { id:i.id, name:i.name, category:i.category, qty:i.qty, unit:i.unit||"", note:i.note||"", done:!!i.done, added_by_name:i.added_by_name||"", flagged_at:i.flaggedAt||null, flagged_by_name:i.flaggedBy||"" }; }) };
        // hooguit 6 lijsten bewaren
        var keys=Object.keys(state.cloudCache); if(keys.length>6){ keys.sort(function(a,b){ return String(state.cloudCache[a].at).localeCompare(String(state.cloudCache[b].at)); }); delete state.cloudCache[keys[0]]; }
        if(typeof save==="function") save();
      }catch(e){}
    },
    /* Huishoud-koopgeschiedenis: wat huisgenoten de laatste 180 dagen kochten telt mee in het ritme ("bijna op", Vaste) */
    loadHouseholdHistory:async function(listId){
      if(!this.sb || this._hasBoughtAt===false || !listId) return;
      try{
        var since=new Date(Date.now()-180*86400000).toISOString();
        var r=await this.sb.from("items").select("name,category,bought_at").eq("list_id",listId).not("bought_at","is",null).gte("bought_at",since).order("bought_at",{ascending:false}).limit(600);
        if(r.error){ if(this._isMissingCol(r.error,"bought_at")) this._hasBoughtAt=false; return; }
        if(this.active!==listId || typeof mergePurchaseDate!=="function") return;
        var n=0; (r.data||[]).forEach(function(row){ if(mergePurchaseDate(row.name, row.category, row.bought_at)) n++; });
        if(n){ if(typeof save==="function") save(); if(typeof renderDueBanner==="function" && activeTab==="lijst") renderDueBanner(); if(activeTab==="vaste" && typeof renderVaste==="function") renderVaste(); }
      }catch(e){}
    },
    refreshMembers:async function(token){
      token = token || this._activeRefreshToken;
      if(!token) return;
      var listId = this.active;
      if(!listId || !this._isCurrentRefresh(token)) return;
      try{
        var r=await this.sb.from("members").select("*").eq("list_id",listId).order("created_at",{ascending:true});
        if(!this._isCurrentRefresh(token) || this.active!==listId) return;
        if(r.error){
          this._warned("refreshMembers", "refreshMembers faalde: "+((r.error && (r.error.message || r.error.code)) || "onbekend"));
          this.members=[];
          renderMembersRow();
          return;
        }
        this.members=r.data||[];
        renderMembersRow();
      }catch(e){
        if(!this._isCurrentRefresh(token) || this.active!==listId) return;
        this._warned("refreshMembers", "refreshMembers faalde: "+((e && (e.message || e.code)) || "onbekend"));
      }
    },

  present:[],  // wie kijkt nu live mee op deze lijst
  subscribe:function(listId){
    if(this.channel){ try{ this.sb.removeChannel(this.channel); }catch(e){} }
    this.present=[];
    var self=this;
      this.channel=this.sb.channel("list-"+listId, { config:{ presence:{ key: self.userId || ("u"+Math.random()) } } })
        .on("postgres_changes",{event:"*",schema:"public",table:"items",filter:"list_id=eq."+listId}, function(){ clearTimeout(self._rtT); self._rtT=setTimeout(function(){ self.refreshItems(self._activeRefreshToken); }, 220); })
        .on("postgres_changes",{event:"*",schema:"public",table:"members",filter:"list_id=eq."+listId}, function(){
          self.refreshMembers(self._activeRefreshToken).then(function(){
          // Als jouw eigen member-rij weg is (gekickt of lijst gedeleted door owner met FK-cascade),
          // val dan netjes terug naar persoonlijk en zeg waarom.
          if(self.active === listId && (!self.members || !self.members.some(function(m){return m.user_id===self.userId;}))){
            toast("Deze lijst is niet meer beschikbaar");
            self.openLocal();
            self.loadLists();
          } else if(self.active === listId && typeof reRenderShareSheetIfOpen==="function"){
            // Ledenlijst in een open deel-sheet live bijwerken (iemand joinde/verliet)
            reRenderShareSheetIfOpen(listId);
          }
        });
      })
      .on("presence",{event:"sync"}, function(){
        // Wie is er nu live (behalve jezelf)?
        var st=self.channel.presenceState(); var seen={}; var others=[];
        Object.keys(st).forEach(function(key){
          (st[key]||[]).forEach(function(m){
            if(m.user_id && m.user_id!==self.userId && !seen[m.user_id]){ seen[m.user_id]=1; others.push(m); }
          });
        });
        self.present=others;
        self._noticeShopping(others);
        renderPresence(); renderMembersRow();
      })
      .subscribe(function(status){
        if(status === "SUBSCRIBED"){
          self._track();
          self.flushPending();
        } else if(status === "CHANNEL_ERROR" || status === "TIMED_OUT"){
          console.warn("Cloud realtime channel:", status);
        }
      });
  },
  startPresence:function(){
    var self=this;
    // De heartbeat dient óók als vangnet: een verwijderde lijst ruimt via FK-cascade
    // de ledenrij op zónder realtime-event. De update raakt dan 0 rijen → we vallen terug.
    var gone=function(listId){ if(self.active!==listId) return; toast("Deze lijst is niet meer beschikbaar"); self.openLocal(); self.loadLists(); };
    var beatUpdate=function(listId){
      self.sb.from("members").update({last_seen:new Date().toISOString()})
        .eq("list_id",listId).eq("user_id",self.userId).select()
        .then(function(r){
          if(!r || r.error) return; // netwerk-/permissie-ruis → niet terugvallen (herstel volgt bij herladen)
          if(Array.isArray(r.data) && r.data.length===0) gone(listId);
        }, function(){ /* netwerkfout → niets doen */ });
    };
    var beat=function(){
      if(!self.active || !self.userId || !self.sb) return;
      if(typeof document!=="undefined" && document.hidden) return;   // verborgen tab/app: geen hartslag
      var listId=self.active;
      if(self._hasHeartbeatRpc===false){ beatUpdate(listId); return; }
      self.sb.rpc("member_heartbeat",{p_list_id:listId}).then(function(r){
        if(r && r.error){ if(self._isMissingFn(r.error)){ self._hasHeartbeatRpc=false; beatUpdate(listId); } return; }
        self._hasHeartbeatRpc=true;
        if(r && r.data===false) gone(listId);
      }, function(){});
    };
    beat(); if(this.presenceTimer) clearInterval(this.presenceTimer);
    this.presenceTimer=setInterval(beat,60000);
  },

  /* ---- mutaties (optimistisch; realtime reconcilieert) ----
     Offline-wachtrij voor ÁLLE mutaties (toevoegen/wijzigen/verwijderen).
     De online-flow verandert niet: pas bij een echte netwerkfout wordt de actie
     bewaard en bij "online" opnieuw verstuurd. Bewerkingen op nog-niet-gesyncte
     items (tmp_-id) worden in de uitgestelde insert gevouwen → niets gaat verloren. */
  _pending:[],
  _deletedIds:{},   // ids die we net afgerond/verwijderd hebben → niet her-toevoegen via realtime-refresh
  _isTmp:function(id){ return typeof id==="string" && id.indexOf("tmp_")===0; },
  _pendingInsert:function(tmpId){
    for(var i=0;i<this._pending.length;i++){ var e=this._pending[i]; if(e.op==="insert"&&e.tmpId===tmpId) return e; }
    return null;
  },
  /* ===== "Wat is op" + "in de winkel" (Fase 4) ===== */
  _seenFlags:{}, _flagsPrimedFor:null, _shoppingSeen:{}, _shopping:false,
  _presencePayload:function(){ return { user_id:this.userId, name:this.myName(), color:(this.me&&this.me.color)||"#24593F", emoji:this.myEmoji(), shopping:!!this._shopping }; },
  _track:function(){ if(!this.channel) return; try{ var p=this.channel.track(this._presencePayload()); if(p && typeof p.catch==="function") p.catch(function(){}); }catch(e){} },
  setShopping:function(on){ on=!!on; if(this._shopping===on) return; this._shopping=on; if(this.active) this._track(); },
  /* Nieuwe vlag van een huisgenoot (niet je eigen, niet bij de eerste laadbeurt) → toast met de namen */
  _noticeFlags:function(listId, mapped){
    var self=this, me=this.myName(), fresh=[], now=Date.now();
    var primed = (this._flagsPrimedFor===listId);
    (mapped||[]).forEach(function(it){
      if(!it.flaggedAt || it.done) return;
      var key=it.id+"|"+it.flaggedAt;
      if(self._seenFlags[key]) return;
      self._seenFlags[key]=1;
      var t=new Date(it.flaggedAt).getTime();
      if(primed && (it.flaggedBy||"")!==me && !isNaN(t) && (now-t) < 6*3600000) fresh.push(it);
    });
    this._flagsPrimedFor=listId;
    if(!fresh.length || typeof toast!=="function") return;
    var who=(fresh[0].flaggedBy||"Iemand"), names=fresh.map(function(i){ return i.name; });
    var txt = who+": "+(names.length===1 ? names[0]+" is op" : (names.slice(0,-1).join(", ")+" en "+names[names.length-1]+" zijn op"));
    toast(txt, {duration:4000, onTap:function(){ if(typeof scrollToRow==="function") scrollToRow(fresh[0].id); }});
    if(typeof vibe==="function") vibe("nudge");
  },
  _noticeShopping:function(others){
    var self=this; if(!Array.isArray(others)) return;
    others.forEach(function(p){
      if(!p || !p.shopping || !p.user_id) return;
      if(self._shoppingSeen[p.user_id]) return;
      self._shoppingSeen[p.user_id]=Date.now();
      if(typeof toast==="function" && !(typeof shopIsOpen==="function" && shopIsOpen())){
        toast("🛒 "+(p.name||"Iemand")+" is in de winkel — nog iets nodig?", {duration:5000, onTap:function(){ var i=document.getElementById("add-name"); if(i) i.focus(); }});
      }
    });
    // wie klaar is, mag later opnieuw gemeld worden
    var live={}; others.forEach(function(p){ if(p && p.shopping && p.user_id) live[p.user_id]=1; });
    Object.keys(this._shoppingSeen).forEach(function(uid2){ if(!live[uid2]) delete self._shoppingSeen[uid2]; });
  },
  /* ===== Account met e-mail (Fase 3C): code per mail, link werkt ook; zelfde user_id dus alles blijft ===== */
  authEmail:null, isAnon:true, _otpSentAt:0, _otpEmail:"", _otpMode:"", _authCheckAt:0,
  _setAuthUser:function(user){ this.authEmail=(user && user.email) ? String(user.email) : null; this.isAnon=!this.authEmail; },
  hasAccount:function(){ return !!this.authEmail; },
  refreshAuthUser:async function(){
    if(!this.sb) return false;
    try{
      var u=await this.sb.auth.getUser(); if(!u || !u.data || !u.data.user) return false;
      var had=this.hasAccount(); this._setAuthUser(u.data.user);
      if(!had && this.hasAccount()){
        toast("E-mail gekoppeld ✓ — je account is veilig", {duration:3000});
        if(typeof activeTab!=="undefined" && activeTab==="meer" && typeof renderMeer==="function") renderMeer();
        if(typeof activeTab!=="undefined" && activeTab==="lijst" && typeof renderDueBanner==="function") renderDueBanner();
      }
      return true;
    }catch(e){ return false; }
  },
  _onAuthEvent:function(ev, session){
    if(typeof mirrorAuthSession==="function" && (ev==="SIGNED_IN" || ev==="TOKEN_REFRESHED" || ev==="USER_UPDATED")) mirrorAuthSession();
    if(ev==="USER_UPDATED") this.refreshAuthUser();
    // magic link in dít venster geopend voor een ander account → alles opnieuw laden onder dat account
    if(ev==="SIGNED_IN" && session && session.user && this.userId && session.user.id!==this.userId && !this._initInProgress){ this._setAuthUser(session.user); this.reinit(); }
  },
  linkEmail:async function(email){
    email=(email||"").trim().toLowerCase(); if(!email || !this.ready || !this.sb) return {ok:false, reason:"no-cloud"};
    try{
      var r=await this.sb.auth.updateUser({email:email});
      if(r.error) return {ok:false, reason:(/rate|too many/i.test(String(r.error.message))?"rate":"error"), message:r.error.message};
      this._otpSentAt=Date.now(); this._otpEmail=email; this._otpMode="email_change";
      return {ok:true};
    }catch(e){ return {ok:false, reason:"error", message:String((e&&e.message)||e)}; }
  },
  sendLoginCode:async function(email){
    email=(email||"").trim().toLowerCase(); if(!email || !this.sb) return {ok:false, reason:"no-cloud"};
    try{
      var r=await this.sb.auth.signInWithOtp({email:email, options:{shouldCreateUser:false, emailRedirectTo:location.origin+location.pathname}});
      if(r.error){ var m=String(r.error.message||""); return {ok:false, reason:(/signup|not allowed|not found|no user/i.test(m)?"unknown":(/rate|too many/i.test(m)?"rate":"error")), message:m}; }
      this._otpSentAt=Date.now(); this._otpEmail=email; this._otpMode="email";
      return {ok:true};
    }catch(e){ return {ok:false, reason:"error", message:String((e&&e.message)||e)}; }
  },
  verifyCode:async function(code){
    code=String(code||"").replace(/\D/g,""); if(!code || !this._otpEmail || !this.sb) return {ok:false, reason:"error"};
    try{
      var r=await this.sb.auth.verifyOtp({email:this._otpEmail, token:code, type:this._otpMode||"email"});
      if(r.error) return {ok:false, reason:(/expired|invalid|not found/i.test(String(r.error.message))?"invalid":"error"), message:r.error.message};
      var user=(r.data&&r.data.user)||null;
      if(this._otpMode==="email_change"){
        this._setAuthUser(user||{email:this._otpEmail});
        if(typeof mirrorAuthSession==="function") mirrorAuthSession();
        this._otpMode=""; this._otpEmail="";
        return {ok:true, mode:"linked"};
      }
      this._setAuthUser(user); if(typeof mirrorAuthSession==="function") mirrorAuthSession();
      this._otpMode=""; this._otpEmail="";
      await this.reinit();
      return {ok:true, mode:"signed-in"};
    }catch(e){ return {ok:false, reason:"error", message:String((e&&e.message)||e)}; }
  },
  signOut:async function(){
    if(!this.sb) return false;
    try{ await this.sb.auth.signOut(); }catch(e){}
    this.authEmail=null; this.isAnon=true;
    try{ if(typeof idbSet==="function") idbSet("sb.auth", ""); }catch(e){}
    await this.reinit();
    return true;
  },
  /* Opnieuw laden onder de huidige sessie (na inloggen/uitloggen): lijsten, profiel, vrienden, bundels, user_state */
  reinit:async function(){
    this.stop();
    this.ready=false; this.active=null; this.lists=[]; this.members=[]; this.friends=[]; this.profile=null;
    this._usRemoteAt=null; this._usPushedHash=""; this._usLastPullAt=0; clearTimeout(this._usPushTimer); this._usPushTimer=null;
    this._initInProgress=false;
    try{ localStorage.setItem("mandje.activeList","local"); }catch(e){}
    if(typeof _personalList!=="undefined" && Array.isArray(_personalList) && typeof state!=="undefined" && state) state.list=_personalList.slice();
    if(typeof load==="function") load();
    await this.init();
    if(typeof applyListHeader==="function") applyListHeader();
    if(typeof renderListSwitch==="function") renderListSwitch();
    if(typeof renderMembersRow==="function") renderMembersRow();
    if(typeof activeTab!=="undefined"){ if(activeTab==="lijst"){ renderLijst(); renderDueBanner(); } if(activeTab==="meer") renderMeer(); }
  },
  deleteAccount:async function(){
    if(!this.ready || !this.sb) return false;
    var r=await this.sb.rpc("delete_my_account");
    if(r.error){ toast(r.error.message||"Verwijderen lukte niet"); return false; }
    try{ await this.sb.auth.signOut(); }catch(e){}
    return true;
  },
  /* ===== user_state: dezelfde slimme app op elk toestel (Fase 3B) ===== */
  _usPushTimer:null, _usPushedHash:"", _usRemoteAt:null, _usPulling:false, _usPushing:false, _usLastPullAt:0, _usHasTable:undefined, _accessToken:null, _authBound:false,
  _bindAuth:function(){
    if(this._authBound || !this.sb || !this.sb.auth || typeof this.sb.auth.onAuthStateChange!=="function") return;
    this._authBound=true; var self=this;
    try{
      this.sb.auth.onAuthStateChange(function(ev, session){
        self._accessToken=(session && session.access_token)||null;
        if(typeof self._onAuthEvent==="function") self._onAuthEvent(ev, session);
      });
    }catch(e){}
  },
  scheduleUserStatePush:function(delay){
    if(!this.ready || !this.userId || !this.sb || this._usHasTable===false) return;
    var self=this; clearTimeout(this._usPushTimer);
    this._usPushTimer=setTimeout(function(){ self._usPushTimer=null; self.pushUserState(); }, delay||5000);
  },
  _userStateRow:function(){
    if(typeof buildUserStatePayload!=="function") return null;
    var p=buildUserStatePayload();
    return Object.assign({ user_id:this.userId, device:(typeof deviceLabel==="function"?deviceLabel():""), updated_at:new Date().toISOString() }, p);
  },
  pushUserState:async function(force, _retry){
    if(!this.ready || !this.userId || !this.sb || this._usHasTable===false) return false;
    if(this._usPulling || this._usPushing){ this.scheduleUserStatePush(2500); return false; }
    var row=this._userStateRow(); if(!row) return false;
    var h=hashStr(stableStr({catalog:row.catalog, co_buy:row.co_buy, settings:row.settings, meals:row.meals, history:row.history, local_lists:row.local_lists}));
    if(!force && h===this._usPushedHash) return true;
    this._usPushing=true;
    try{
      var r;
      if(this._usRemoteAt){
        // alleen schrijven als niemand anders intussen schreef; anders eerst samenvoegen en nog één keer proberen
        r=await this.sb.from("user_state").update(row).eq("user_id", this.userId).lte("updated_at", this._usRemoteAt).select("updated_at");
        if(!r.error && (!r.data || !r.data.length)){
          this._usPushing=false;
          if(_retry) return false;
          await this.pullUserState();
          return this.pushUserState(true, true);
        }
      } else {
        r=await this.sb.from("user_state").upsert(row, {onConflict:"user_id"}).select("updated_at");
      }
      if(r.error){ if(this._isMissingTable(r.error)) this._usHasTable=false; else this._warned("user_state", "user_state push faalde: "+(r.error.message||r.error.code)); return false; }
      this._usPushedHash=h;
      this._usRemoteAt=(r.data && r.data[0] && r.data[0].updated_at) || row.updated_at;
      if(typeof state!=="undefined" && state){ var s=(typeof syncEnsure==="function")?syncEnsure():null; if(s){ s.lastPushAt=Date.now(); if(typeof save==="function") save(); } }
      return true;
    }catch(e){ return false; }
    finally{ this._usPushing=false; }
  },
  pullUserState:async function(){
    if(!this.ready || !this.userId || !this.sb || this._usHasTable===false) return false;
    if(this._usPulling) return false;
    this._usPulling=true;
    try{
      var r=await this.sb.from("user_state").select("*").eq("user_id", this.userId).maybeSingle();
      if(r.error){ if(this._isMissingTable(r.error)) this._usHasTable=false; return false; }
      this._usLastPullAt=Date.now();
      var s=(typeof syncEnsure==="function")?syncEnsure():null;
      if(!r.data){ this._usRemoteAt=null; this._usPushedHash=""; this.scheduleUserStatePush(600); if(s){ s.lastPullAt=Date.now(); } return true; }
      this._usRemoteAt=r.data.updated_at;
      var res=(typeof mergeUserState==="function") ? mergeUserState(r.data) : {changedLocal:false, differsFromRemote:false};
      if(s) s.lastPullAt=Date.now();
      var row=this._userStateRow();
      var h=row ? hashStr(stableStr({catalog:row.catalog, co_buy:row.co_buy, settings:row.settings, meals:row.meals, history:row.history, local_lists:row.local_lists})) : "";
      this._usPushedHash = res.differsFromRemote ? "" : h;
      if(typeof save==="function") save();
      if(res.changedLocal && typeof rerenderAfterSync==="function") rerenderAfterSync();
      if(res.differsFromRemote) this.scheduleUserStatePush(1200);
      return true;
    }catch(e){ return false; }
    finally{ this._usPulling=false; }
  },
  /* Bij verbergen/sluiten: als er nog een push wacht, meteen versturen (keepalive overleeft het sluiten van de pagina) */
  flushUserStateNow:function(){
    if(!this._usPushTimer || !this.ready || !this.userId || this._usHasTable===false) return;
    clearTimeout(this._usPushTimer); this._usPushTimer=null;
    var row=this._userStateRow(); if(!row) return;
    var body=JSON.stringify(row);
    if(!this._accessToken || body.length>60000 || typeof fetch!=="function"){ this.pushUserState(); return; }
    var self=this;
    try{
      fetch(SUPABASE_URL+"/rest/v1/user_state?on_conflict=user_id", { method:"POST", keepalive:true, body:body,
        headers:{ "apikey":SUPABASE_ANON_KEY, "Authorization":"Bearer "+this._accessToken, "Content-Type":"application/json", "Prefer":"resolution=merge-duplicates,return=minimal" } })
        .then(function(resp){ if(resp && resp.ok){ self._usRemoteAt=row.updated_at; self._usPushedHash=hashStr(stableStr({catalog:row.catalog, co_buy:row.co_buy, settings:row.settings, meals:row.meals, history:row.history, local_lists:row.local_lists})); } }, function(){});
    }catch(e){}
  },
  _persistQueue:function(){ try{ if(typeof state!=="undefined" && state){ state.syncQueue = this._pending.slice(); if(typeof save==="function") save(); } }catch(e){} },
  _restoreQueue:function(){ try{ if(typeof state!=="undefined" && state && Array.isArray(state.syncQueue) && state.syncQueue.length && !this._pending.length){ this._pending = state.syncQueue.filter(function(e){ return e && e.op; }); } }catch(e){} },
  _queueInsert:function(tmpId, payload){ this._pending.push({op:"insert", tmpId:tmpId, payload:payload}); this._persistQueue(); },
  _queueUpdate:function(id, fields){
    if(this._isTmp(id)){
      var ins=this._pendingInsert(id);
      if(ins){ for(var key in fields){ ins.payload[key]=fields[key]; } }   // in de insert vouwen
      return;
    }
    for(var i=0;i<this._pending.length;i++){ var e=this._pending[i]; if(e.op==="update"&&e.id===id){ for(var k in fields) e.fields[k]=fields[k]; return; } }
    var f={}; for(var k2 in fields) f[k2]=fields[k2];
    this._pending.push({op:"update", id:id, fields:f});
    this._persistQueue();
  },
  _queueDelete:function(id){
    var self=this;
    this._pending=this._pending.filter(function(e){ return e.id!==id && e.tmpId!==id; }); // eerdere ops vervallen
    if(!this._isTmp(id)) this._pending.push({op:"delete", id:id});
    this._persistQueue();
  },
  _maxFlushAttempts:6,
  flushPending:function(){
    if(!this.sb || !this._pending.length) return;
    var self=this, batch=this._pending.splice(0), toasted=false;
    var note=function(){ if(!toasted){ toasted=true; if(typeof toast==="function") toast("Offline wijzigingen verstuurd"); } };
    batch.forEach(function(e){
      if(self._hasUnit===false){ if(e.payload) delete e.payload.unit; if(e.fields) delete e.fields.unit; }   // kolom ontbreekt nog (migratie M0)
      // Definitief falende acties (bv. bewerken in een lijst waar je uit verwijderd bent)
      // niet eindeloos herproberen: na _maxFlushAttempts laten vallen (realtime reconcilieert tóch).
      var requeue=function(){ e.attempts=(e.attempts||0)+1; if(e.attempts < self._maxFlushAttempts) self._pending.push(e); };
      var done=function(r){ if(r&&r.error) requeue(); else note(); };
      try{
        if(e.op==="insert"){ if(e.payload.list_id!==self.active){ self._pending.push(e); return; }   // andere lijst: bewaren, niet droppen
          self.sb.from("items").insert(e.payload).then(done, requeue); }
        else if(e.op==="update"){ self.sb.from("items").update(e.fields).eq("id", e.id).then(done, requeue); }
        else if(e.op==="delete"){ self.sb.from("items").delete().eq("id", e.id).then(done, requeue); }
      }catch(err){ requeue(); }
    });
    this._persistQueue();
    var self2=this; setTimeout(function(){ self2._persistQueue(); }, 4000);   // na de antwoorden: overgebleven/geherqueuede items bewaren
  },
  addItem:function(name, price, addQty, opts){
    name=(name||"").trim(); if(!name||!this.active) return;
    addQty = Math.max(1, addQty||1);
    opts = opts || {};
    var self=this, k = norm(name), mk = (typeof matchKey==="function") ? matchKey(name) : k;
    var existing = state.list.find(function(i){ return !i.done && ((typeof matchKey==="function") ? matchKey(i.name) : norm(i.name))===mk; });
    if(existing && opts.flag){
      var fnow=new Date().toISOString();
      existing.flaggedAt=fnow; existing.flaggedBy=this.myName(); renderLijst();
      if(this._hasFlag!==false) this._writeItem("update", {flagged_at:fnow, flagged_by_name:this.myName()}, existing.id);
      return;
    }
    if(existing){
      existing.qty += addQty;
      if(price!=null) existing.price = price;
      if(opts.unit && opts.unit!==existing.unit) existing.unit = opts.unit;
      renderLijst();
      if(!opts.silent) toast(name + " → " + existing.qty + "×");
      var fields = {qty: existing.qty};
      if(price!=null) fields.price = price;
      if(opts.unit && this._hasUnit!==false) fields.unit = opts.unit;
      var eid=existing.id;
      this._writeItem("update", fields, eid);
      return;
    }
    var cat=(opts.category && CAT_BY_ID[opts.category]) ? opts.category : ((state.catalog[k]&&state.catalog[k].category)||classify(name));
    var tmpId="tmp_"+uid();
    // unit blijft lokaal (geen DB-kolom) → puur optimistische weergave op cloud-lijsten
    state.list.unshift({ id:tmpId, name:name, category:cat, qty:addQty, price:price, note:"", unit:(opts.unit||""), done:false, assigned_to:null, added_by_name:this.myName(), addedAt:nowISO(), flaggedAt:(opts.flag?nowISO():null), flaggedBy:(opts.flag?this.myName():"") });
    renderLijst();
    if(!opts.silent && addQty>1) toast(name + " ×" + addQty);
    var payload={list_id:this.active, name:name, category:cat, qty:addQty, price:(price==null?null:price), added_by_name:this.myName()};
    if(opts.unit && this._hasUnit!==false) payload.unit = opts.unit;
    if(opts.flag && this._hasFlag!==false){ payload.flagged_at=new Date().toISOString(); payload.flagged_by_name=this.myName(); }
    var fail=function(){ self._queueInsert(tmpId, payload); if(!opts.silent) toast("Offline — wordt verstuurd zodra je weer verbinding hebt"); };
    this._writeItem("insert", payload, null, fail, function(r){ var row=r && r.data && (Array.isArray(r.data) ? r.data[0] : r.data); if(row && row.id) self._adoptId(tmpId, row.id); });
  },
  /* Tijdelijk id vervangen door het echte: in de lijst, de rij-cache en de wachtrij (een update op tmp_ zou anders verloren gaan) */
  _adoptId:function(tmpId, realId){
    if(!tmpId || !realId || tmpId===realId) return;
    var it=state.list.find(function(i){ return i.id===tmpId; });
    if(it){ it.id=realId; if(typeof _rowCache!=="undefined" && _rowCache && _rowCache[tmpId]){ delete _rowCache[tmpId]; } }
    this._pending.forEach(function(e){ if(e.op==="update" && e.id===tmpId) e.id=realId; if(e.op==="delete" && e.id===tmpId) e.id=realId; });
    if(it && typeof renderLijst==="function" && activeTab==="lijst") renderLijst();
    if(typeof shopIsOpen==="function" && shopIsOpen() && typeof renderShopBody==="function") renderShopBody();
  },
  /* Schrijft een item weg en valt terug zonder 'unit' als de kolom (migratie M0) nog ontbreekt —
     zo blijft de app werken vóór én na het draaien van de migratie. */
  _hasUnit:undefined,
  _isMissingUnit:function(err){ return this._hasUnit!==false && this._isMissingCol(err, "unit"); },
  /* Ontbrekende kolom (migratie nog niet gedraaid): Postgres 42703, PostgREST PGRST204 "Could not find the 'x' column …" */
  _isMissingCol:function(err, col){
    if(!err) return false;
    var m=String(err.message||"")+" "+String(err.details||"")+" "+String(err.hint||"");
    if(!(err.code==="42703" || err.code==="PGRST204" || /(column|schema cache)/i.test(m))) return false;
    // de kolomnaam uit de melding halen — anders matcht "name" ook op "flagged_by_name"
    var mm = m.match(/'([a-z0-9_]+)' column/i) || m.match(/column "([a-z0-9_]+)"/i) || m.match(/column [a-z0-9_]+\.([a-z0-9_]+)/i);
    if(mm) return mm[1].toLowerCase()===String(col).toLowerCase();
    return new RegExp("\\b"+col+"\\b","i").test(m);
  },
  _hasFlag:undefined,
  _isMissingTable:function(err){ return !!(err && (err.code==="PGRST205" || err.code==="42P01" || /could not find the table|relation .* does not exist/i.test(String(err.message||"")))); },
  _isMissingFn:function(err){ return !!(err && (err.code==="PGRST202" || /could not find the function/i.test(String(err.message||"")))); },
  _hasBoughtAt:undefined,
  /* Eén update-pad: zonder client (offline koude start) meteen in de wachtrij, anders schrijven en bij een fout in de wachtrij */
  _upd:function(id, fields){
    var self=this;
    if(!this.sb){ this._queueUpdate(id, fields); return; }
    this.sb.from("items").update(fields).eq("id",id).then(function(r){ if(r&&r.error) self._queueUpdate(id, fields); }, function(){ self._queueUpdate(id, fields); });
  },
  _writeItem:function(op, data, id, onFail, onOk){
    var self=this;
    var run=function(d){ return op==="insert" ? self.sb.from("items").insert(d).select("id") : self.sb.from("items").update(d).eq("id", id); };
    var fail = onFail || function(){ self._queueUpdate(id, data); };
    if(!this.sb){ fail(); return; }
    var okk=function(r){ if(typeof onOk==="function"){ try{ onOk(r); }catch(e){} } };
    run(data).then(function(r){
      if(!r || !r.error) okk(r);
      if(r && r.error){
        var missing=Object.keys(data).filter(function(k){ return self._isMissingCol(r.error, k); });
        if("unit" in data && self._isMissingUnit(r.error) && missing.indexOf("unit")===-1) missing.push("unit");
        if(missing.length){
          // in-place, zodat óók de fail-closures (offline-wachtrij) de velden kwijt zijn
          missing.forEach(function(k){ if(k==="unit") self._hasUnit=false; if(k==="flagged_at"||k==="flagged_by_name") self._hasFlag=false; delete data[k]; });
          if(Object.keys(data).length) run(data).then(function(r2){ if(r2&&r2.error) fail(); else okk(r2); }, fail);
          return;
        }
        fail();
      } else if("unit" in data){ self._hasUnit=true; }
    }, fail);
  },
  toggle:function(id, opts){
    opts=opts||{};
    var it=state.list.find(function(i){return i.id===id;}); if(!it) return;
    var nd=!it.done; it.done=nd; if(typeof flipList==="function") flipList(renderLijst); else renderLijst();
    var self=this;
    var fields={done:nd, done_by_name:(nd?this.myName():null)};
    this._upd(id, fields);
    // Undo bij afvinken — gelijk aan de lokale lijst
    if(nd && !opts.quiet && typeof undoToast==="function"){
      undoToast(it.name+" afgevinkt", function(){
        var i2=state.list.find(function(x){return x.id===id;});
        if(i2){ i2.done=false; if(typeof flipList==="function") flipList(renderLijst); else renderLijst(); }
        self._upd(id, {done:false, done_by_name:null});
      });
    }
  },
  qty:function(id,delta){
    var it=state.list.find(function(i){return i.id===id;}); if(!it) return;
    it.qty=Math.max(1,it.qty+delta); renderLijst();
    var self=this, q=it.qty;
    if(!this.sb || this._isTmp(id) || this._hasBumpRpc===false){ this._upd(id, {qty:q}); return; }
    // RPC telt op i.p.v. te overschrijven: twee telefoons die tegelijk +1 doen, komen op +2 uit
    this.sb.rpc("item_bump_qty",{p_id:id, p_delta:delta}).then(function(r){
      if(r && r.error){ if(self._isMissingFn(r.error)) self._hasBumpRpc=false; self._upd(id, {qty:q}); return; }
      self._hasBumpRpc=true;
      var it2=state.list.find(function(i){return i.id===id;});
      if(it2 && typeof r.data==="number" && r.data!==it2.qty){ it2.qty=r.data; renderLijst(); }
    }, function(){ self._upd(id, {qty:q}); });
  },
  remove:function(id){
    var it=state.list.find(function(i){return i.id===id;});
    var snap = it ? Object.assign({}, it) : null;
    state.list=state.list.filter(function(i){return i.id!==id;}); renderLijst();
    var self=this;
    if(!this.sb){ this._queueDelete(id); }
    else this.sb.from("items").delete().eq("id",id).then(function(r){ if(r&&r.error) self._queueDelete(id); }, function(){ self._queueDelete(id); });
    // Undo bij verwijderen — voegt 'm opnieuw toe (realtime reconcilieert)
    if(snap && typeof undoToast==="function"){
      undoToast(snap.name+" verwijderd", function(){
        self.addItem(snap.name, snap.price, snap.qty, {silent:true});
      });
    }
  },
  setFields:function(id, fields){
    var it=state.list.find(function(i){return i.id===id;});
    if(it){ if("qty"in fields)it.qty=fields.qty; if("price"in fields)it.price=fields.price; if("note"in fields)it.note=fields.note; if("unit"in fields)it.unit=fields.unit; if("category"in fields)it.category=fields.category; if("assigned_to"in fields)it.assigned_to=fields.assigned_to; if("flagged_at"in fields)it.flaggedAt=fields.flagged_at||null; if("flagged_by_name"in fields)it.flaggedBy=fields.flagged_by_name||""; renderLijst(); if(typeof shopIsOpen==="function" && shopIsOpen() && typeof renderShopBody==="function") renderShopBody(); }
    if(("flagged_at" in fields || "flagged_by_name" in fields) && this._hasFlag===false){ var f3={}; for(var k3 in fields){ if(k3!=="flagged_at" && k3!=="flagged_by_name") f3[k3]=fields[k3]; } fields=f3; if(!Object.keys(fields).length) return; }
    if("unit" in fields && this._hasUnit===false){ var f2={}; for(var k in fields){ if(k!=="unit") f2[k]=fields[k]; } fields=f2; }
    this._writeItem("update", fields, id);
  },
  /* Afronden = soft-delete (bought_at): omkeerbaar, en de bron van de huishoud-koopgeschiedenis. Zonder de M3-kolom: gewoon verwijderen. */
  finish:function(){
    var done=state.list.filter(function(i){return i.done;}); if(!done.length||!this.active) return;
    var self=this, ids=done.map(function(i){return i.id;}).filter(function(id){ return !self._isTmp(id); });
    ids.forEach(function(id){ self._deletedIds[id]=1; });   // tegen her-toevoegen via realtime-refresh
    state.list=state.list.filter(function(i){return !i.done;}); renderLijst();
    var clear=function(){ setTimeout(function(){ ids.forEach(function(id){ delete self._deletedIds[id]; }); }, 1500); };
    var now=new Date().toISOString();
    var soft=(this._hasBoughtAt!==false);
    var queueSoft=function(){ ids.forEach(function(id){ self._queueUpdate(id, {bought_at:now, done:true}); }); };
    var queueHard=function(){ ids.forEach(function(id){ self._queueDelete(id); }); };
    var hard=function(){ if(!self.sb){ queueHard(); clear(); return; } self.sb.from("items").delete().in("id",ids).then(function(r){ if(r&&r.error) queueHard(); clear(); }, function(){ queueHard(); clear(); }); };
    if(!ids.length){ /* alleen nog-niet-gesyncte items: hun inserts vervallen via de wachtrij */ }
    else if(!this.sb){ if(soft) queueSoft(); else queueHard(); clear(); }
    else if(soft){
      this.sb.from("items").update({bought_at:now, done:true}).in("id",ids).then(function(r){
        if(r && r.error){ if(self._isMissingCol(r.error,"bought_at")){ self._hasBoughtAt=false; soft=false; hard(); return; } queueSoft(); }
        else self._hasBoughtAt=true;
        clear();
      }, function(){ queueSoft(); clear(); });
    } else hard();
    vibrate(12); renderVaste();
    if(typeof celebrate==="function") celebrate();
    var cloudUndo = soft ? function(){
      ids.forEach(function(id){ delete self._deletedIds[id]; });
      if(!self.sb){ ids.forEach(function(id){ self._queueUpdate(id, {bought_at:null}); }); return; }
      self.sb.from("items").update({bought_at:null}).in("id",ids).then(function(){ self.refreshItems(self._activeRefreshToken); }, function(){ ids.forEach(function(id){ self._queueUpdate(id, {bought_at:null}); }); });
    } : null;
    if(typeof finishAfterCloud==="function") finishAfterCloud(done, cloudUndo);
    else toast(done.length+(done.length===1?" boodschap gekocht":" boodschappen gekocht"));
  },

  /* ---- lijstbeheer ---- */
  createList:async function(name){
    if(!this.ready){
      console.warn("Mandje: createList terwijl Cloud niet ready —", this.initError);
      toast("Even moment — we zijn nog niet klaar");
      return null;
    }
    var r=await this.sb.rpc("create_list",{p_name:name||"Boodschappen", p_display_name:this.myName(), p_color:this.me.color});
    if(r.error){
      console.warn("Mandje: create_list RPC faalde —", r.error);
      toast("Aanmaken lukte niet — probeer 't nog eens");
      return null;
    }
    await this.loadLists(); await this.open(r.data.id); switchTab("lijst");
    return r.data;
  },
  joinList:async function(code){
    var r=await this.sb.rpc("join_list",{p_code:(code||"").trim(), p_display_name:this.myName(), p_color:this.me.color});
    if(r.error){ toast(r.error.message||"Joinen lukte niet"); return null; }
    try{ history.replaceState({}, "", location.pathname); }catch(e){}
    await this.loadLists(); await this.open(r.data.id); switchTab("lijst");
    toast("Welkom bij "+r.data.name); return r.data;
  },
  leaveList:async function(listId){
    await this.sb.from("members").delete().eq("list_id",listId).eq("user_id",this.userId);
    this.lists=this.lists.filter(function(l){return l.id!==listId;});
    if(this.active===listId) this.openLocal();
    else { renderListSwitch(); }
  },
  deleteList:async function(listId){
    var l = this.listById(listId);
    if(!l) return false;
    if(l.owner_user_id !== this.userId){ toast("Alleen de eigenaar kan deze lijst verwijderen"); return false; }
    var r = await this.sb.from("lists").delete().eq("id", listId);
    if(r.error){ toast("Verwijderen lukte niet"); return false; }
    // FK cascade ruimt members + items op. Refresh lokale state en val terug op persoonlijk.
    if(this.active === listId) this.openLocal();
    await this.loadLists();
    renderListSwitch();
    toast("Lijst verwijderd");
    return true;
  },
  renameList:async function(listId, newName){
    newName=(newName||"").trim(); if(!newName) return null;
    var r=await this.sb.from("lists").update({name:newName}).eq("id",listId).select().single();
    if(r.error){ toast("Naam wijzigen lukte niet"); return null; }
    await this.loadLists();
    if(this.active===listId){ applyListHeader(); }
    renderListSwitch();
    toast("Lijst hernoemd");
    return r.data;
  },
  kickMember:async function(listId, userId){
    var r=await this.sb.from("members").delete().eq("list_id",listId).eq("user_id",userId);
    if(r.error){ toast("Verwijderen lukte niet"); return false; }
    // Uitnodig-code en stuur-token vernieuwen (RPC uit migratie M0); faalt stil als de RPC nog niet bestaat
    var rotated=false;
    try{ var rr=await this.sb.rpc("rotate_list_codes",{p_list_id:listId}); rotated=!(rr&&rr.error); }catch(e){}
    // FK ON DELETE SET NULL clearde assigned_to op zijn items, maar onze lokale state
    // ziet dat pas via realtime — forceer een refresh zodat de UI direct klopt.
    await this.refreshMembers();
    await this.refreshItems();
    await this.loadLists();
    if(typeof reRenderShareSheetIfOpen==="function") reRenderShareSheetIfOpen(listId);
    toast(rotated ? "Lid verwijderd — uitnodig- en stuur-link vernieuwd (oude links werken niet meer)" : "Lid verwijderd", {duration:4000});
    return true;
  },
  recentActivity:async function(listId){
    if(!this.sb) return [];
    var r=await this.sb.from("items").select("name,added_by_name,done_by_name,done,created_at").eq("list_id",listId).order("created_at",{ascending:false}).limit(5);
    if(r.error) return [];
    return r.data||[];
  },
  shareLink:function(list){ return location.origin+location.pathname+"?join="+list.join_code; },
  sendLink:function(list){ return location.origin+location.pathname+"?send="+list.send_token; },
  waitReady:function(maxMs){
    var self=this;
    return new Promise(function(resolve){
      if(self.ready){ resolve(true); return; }
      if(self.initError){ resolve(false); return; }
      var step=100, elapsed=0;
      var t=setInterval(function(){
        elapsed+=step;
        if(self.ready){ clearInterval(t); resolve(true); }
        else if(self.initError){ clearInterval(t); resolve(false); }
        else if(elapsed>=(maxMs||5000)){ clearInterval(t); resolve(false); }
      }, step);
    });
  }
};

function whenCloudReady(cb){
  if(Cloud.ready){ cb(); return; }
  if(!Cloud.enabled){
    if(!Cloud._notifiedEnabled){
      Cloud._notifiedEnabled = true;
      toast("Delen is niet aangezet");
    }
    return;
  }
  if(Cloud.initError){
    if(!Cloud._notifiedError){
      Cloud._notifiedError = true;
      toast(Cloud.initError);
    }
    return;
  }
  if(!Cloud._notifiedEnabled){
    Cloud._notifiedEnabled = true;
    toast("Even ophalen…");
  }
  Cloud.waitReady(28000).then(function(ok){
    if(ok){
      Cloud._notifiedEnabled = false;
      cb();
      return;
    }
    if(Cloud.initError){
      if(!Cloud._notifiedError){
        Cloud._notifiedError = true;
        toast(Cloud.initError);
      }
    } else if(!Cloud._notifiedError){
      Cloud._notifiedError = true;
      toast("Geen verbinding — probeer 't straks");
    }
  });
}

/* ============================================================
   SHORTCUTS — "Stuur naar"-snelkoppelingen (lokaal opgeslagen)
   ============================================================ */
var Shortcuts = {
  items:[],
  load:function(){
    try{ var raw=localStorage.getItem("mandje.shortcuts"); this.items=raw?JSON.parse(raw):[]; }catch(e){ this.items=[]; }
    if(!Array.isArray(this.items)) this.items=[];
  },
  save:function(){ try{ localStorage.setItem("mandje.shortcuts", JSON.stringify(this.items)); }catch(e){} },
  byToken:function(t){ for(var i=0;i<this.items.length;i++) if(this.items[i].token===t) return this.items[i]; return null; },
  byId:function(id){ for(var i=0;i<this.items.length;i++) if(this.items[i].id===id) return this.items[i]; return null; },
  add:function(name, token, color){
    var id="sc_"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    this.items.push({id:id, name:(name||"Lijst"), token:token, color:color||pickColor(), lastUsed:nowISO()});
    this.save(); renderShortcutsRow(); return id;
  },
  remove:function(id){ this.items=this.items.filter(function(s){return s.id!==id;}); this.save(); renderShortcutsRow(); },
  rename:function(id, name){ var s=this.byId(id); if(s){ s.name=name; this.save(); renderShortcutsRow(); } },
  touch:function(id){ var s=this.byId(id); if(s){ s.lastUsed=nowISO(); this.save(); } }
};

function parseTokenFromInput(input){
  input=(input||"").trim(); if(!input) return null;
  try{ var u=new URL(input); var t=u.searchParams.get("send"); if(t) return t; }catch(e){}
  var m=input.match(/[?&]send=([^&\s#]+)/); if(m){ try{ return decodeURIComponent(m[1]); }catch(e){ return m[1]; } }
  if(/^[A-Za-z0-9_\-]{8,}$/.test(input)) return input;
  return null;
}

function renderShortcutsRow(){
  var wrap=document.getElementById("shortcuts-row"); if(!wrap) return;
  if(activeTab!=="lijst" || !Cloud.enabled){ wrap.innerHTML=""; wrap.className="shortcuts-row empty"; return; }
  wrap.className="shortcuts-row";
  var inner='<div class="sc-scroll">';
  // Vrienden eerst (sturen = 1 tap)
  (Cloud.friends||[]).forEach(function(f){
    inner+='<button class="sc-chip" data-friend="'+f.user_id+'">'+
      avatarHtml(f.name, f.color, f.emoji, 22)+
      '<span class="sc-name">'+escapeHtml(f.name)+'</span>'+
    '</button>';
  });
  // Legacy snelkoppelingen (stuur-tokens zonder vriend) blijven werken
  var sorted=Shortcuts.items.slice().sort(function(a,b){
    return new Date(b.lastUsed||0).getTime() - new Date(a.lastUsed||0).getTime();
  });
  sorted.forEach(function(s){
    inner+='<button class="sc-chip" data-id="'+s.id+'">'+
      '<span class="sc-dot" style="background:'+safeColor(s.color)+'"></span>'+
      '<span class="sc-name">'+escapeHtml(prettyListName(s.name))+'</span>'+
    '</button>';
  });
  var hasAny = (Cloud.friends&&Cloud.friends.length) || sorted.length;
  if(!hasAny){
    inner+='<button class="sc-chip sc-action sc-action-wide" data-actions="1"><span class="sc-act-ico">+</span><span class="sc-act-lbl">Vriend toevoegen</span></button>';
  } else {
    inner+='<button class="sc-chip sc-action" data-actions="1" aria-label="Vrienden">+</button>';
  }
  inner+='</div>';
  wrap.innerHTML=inner;
  wrap.querySelectorAll(".sc-chip").forEach(function(b){
    if(b.dataset.actions){
      b.addEventListener("click", function(){ openFriendsSheet(); });
    } else if(b.dataset.friend){
      var uid=b.dataset.friend;
      b.addEventListener("click", function(){ var f=Cloud.friendByUser(uid); if(f) openSendToFriendSheet(f); });
    } else {
      var id=b.dataset.id;
      b.addEventListener("click", function(){ openSendSheet(id); });
      var lpTimer=null;
      var startLP=function(){ lpTimer=setTimeout(function(){ vibrate(15); openManageShortcutSheet(id); }, 550); };
      var clrLP=function(){ if(lpTimer){ clearTimeout(lpTimer); lpTimer=null; } };
      b.addEventListener("touchstart", startLP, {passive:true});
      b.addEventListener("touchend", clrLP);
      b.addEventListener("touchmove", clrLP);
      b.addEventListener("touchcancel", clrLP);
    }
  });
}

/* Sturen naar een vriend — hergebruikt add_item_via_token op diens inbox-token */
function openSendToFriendSheet(friend){
  if(!friend) return;
  var sent=[];
  var html='<div class="grip"></div>'+
    '<h3 style="display:flex;align-items:center;gap:10px"><span id="sf-avatar">'+avatarHtml(friend.name, friend.color, friend.emoji, 30)+'</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">Sturen naar '+escapeHtml(friend.name)+'</span></h3>'+
    '<div class="field" style="margin-bottom:6px">'+
      '<svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'+
      '<input class="name" id="sf-input" type="search" enterkeyhint="send" placeholder="Bijv. melk, brood…" autocapitalize="sentences" autocomplete="off" autocorrect="off" spellcheck="false">'+
      '<button class="addbtn" id="sf-send" aria-label="Stuur"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button>'+
    '</div>'+
    '<div class="chips" id="sf-sent" style="margin:14px 0 4px"></div>'+
    '<div class="hint" style="margin:8px 6px 4px">'+escapeHtml(friend.name)+' ziet je toevoegingen direct.</div>';
  var sh=openSheet2(html);
  var inp=sh.querySelector("#sf-input"), btn=sh.querySelector("#sf-send");
  function send(){
    var nm=(inp.value||"").trim(); if(!nm) return;
    flyToAvatar(inp, sh.querySelector("#sf-avatar"), nm);  // item "vliegt" naar de vriend-avatar
    Cloud.sendToFriend(friend, nm).then(function(ok){
      if(!ok){ toast("Versturen lukte niet"); return; }
      sent.unshift(nm); inp.value="";
      sh.querySelector("#sf-sent").innerHTML=sent.map(function(n){return '<span class="chip"><span class="emoji">✓</span>'+escapeHtml(n)+'</span>';}).join("");
      inp.focus(); vibe("tick");
    });
  }
  btn.addEventListener("click", send);
  inp.addEventListener("keydown", function(e){ if(e.key==="Enter") send(); });
  setTimeout(function(){ if(inp) inp.focus(); }, 280);
}

/* Vrienden-scherm: jouw profiel + vriendcode delen + je vrienden + toevoegen */
function openFriendsSheet(){
  whenCloudReady(function(){
    ensureIdentity(function(){
      Cloud.syncProfile().then(function(){ Cloud.loadFriends().then(renderFriendsSheet); });
    });
  });
}
function renderFriendsSheet(){
  var me=Cloud.me||{};
  var code=(me.friendCode||"");
  var friendsHtml=(Cloud.friends||[]).map(function(f){
    return '<div class="ls-item" data-friend="'+f.user_id+'">'+
      avatarHtml(f.name, f.color, f.emoji, 36)+
      '<div class="lsi-meta lsi-text lsi-name" style="font-size:16px">'+escapeHtml(f.name)+'</div>'+
      '<button class="lsi-member-action friend-send" data-friend="'+f.user_id+'" type="button">Stuur</button>'+
      '<button class="lsi-member-action friend-del" data-friend="'+f.user_id+'" data-name="'+escapeAttr(f.name)+'" type="button" aria-label="Verwijder">✕</button>'+
    '</div>';
  }).join("");
  var html='<div class="grip"></div>'+
    '<h3>Vrienden</h3>'+
    '<div class="friend-me">'+avatarHtml(me.display_name, me.color, me.emoji, 44)+
      '<div class="lsi-meta"><div class="fm-name lsi-text">'+escapeHtml(me.display_name||"Jij")+'</div>'+
      '<div class="fm-sub">Jouw vriendcode</div><span class="friend-code-box">'+escapeHtml(code||"…")+'</span></div>'+
      '<button class="lsi-member-action" id="fr-edit" type="button" aria-label="Profiel bewerken"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>'+
    '</div>'+
    '<button class="mbtn primary" id="fr-share">Deel je vriendcode</button>'+
    '<button class="mbtn" id="fr-add">Vriend toevoegen via code</button>'+
    (friendsHtml ? ('<div class="sheet-label"><span class="lbl-cap">Jouw vrienden ('+Cloud.friends.length+')</span></div>'+friendsHtml)
                 : '<div class="hint" style="margin:14px 6px 0">Nog geen vrienden. Deel je code, of voeg iemand toe — daarna stuur je elkaar boodschappen in één tik.</div>');
  var sh=openSheet2(html);
  var link=location.origin+location.pathname+"?friend="+encodeURIComponent(code);
  sh.querySelector("#fr-share").addEventListener("click", function(){
    shareNative(link, "Voeg me toe in Mandje 🧺 — mijn vriendcode is "+code, "Vriend-link gekopieerd");
  });
  sh.querySelector("#fr-add").addEventListener("click", function(){
    var c=prompt("Vriendcode van je vriend:");
    if(c===null) return;
    Cloud.addFriend(c).then(function(ok){ if(ok) openFriendsSheet(); });
  });
  var edit=sh.querySelector("#fr-edit");
  if(edit) edit.addEventListener("click", function(){ openProfileSheet(function(){ openFriendsSheet(); }, true); });
  sh.querySelectorAll(".friend-send").forEach(function(b){
    b.addEventListener("click", function(e){ e.stopPropagation(); var f=Cloud.friendByUser(b.dataset.friend); if(f){ closeSheet2(); openSendToFriendSheet(f); } });
  });
  sh.querySelectorAll(".friend-del").forEach(function(b){
    b.addEventListener("click", function(e){
      e.stopPropagation();
      var nm=b.dataset.name||"deze vriend";
      if(confirm(nm+" uit je vrienden verwijderen?")){
        Cloud.removeFriend(b.dataset.friend).then(function(){ openFriendsSheet(); });
      }
    });
  });
}

function openReceiveFlow(){
  whenCloudReady(function(){
    if(Cloud.active){ openShareSheet(Cloud.active); return; }
    if(Cloud.lists && Cloud.lists.length){
      var firstId=Cloud.lists[0].id;
      Cloud.open(firstId).then(function(){ openShareSheet(firstId); }, function(){ openShareSheet(firstId); });
      return;
    }
    ensureIdentity(function(){
      var nm=(Cloud.myName && Cloud.myName()) || "Mijn lijst";
      Cloud.createList(nm).then(function(newList){
        if(newList && newList.id) openShareSheet(newList.id);
      });
    });
  });
}

function openShareActionSheet(){
  // Vrienden zijn nu de hoofdweg; oude stuur-link-snelkoppeling blijft als extra optie.
  var html='<div class="grip"></div>'+
    '<h3>Sturen & delen</h3>'+
    '<button class="sa-row" id="sa-friends">'+
      '<span class="sa-ico"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>'+
      '<span class="sa-meta"><span class="sa-ttl">Vrienden</span><span class="sa-sub">Voeg een vriend toe en stuur elkaar boodschappen in één tik.</span></span>'+
      '<span class="sa-chev">›</span>'+
    '</button>'+
    '<button class="sa-row" id="sa-add">'+
      '<span class="sa-ico"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>'+
      '<span class="sa-meta"><span class="sa-ttl">Stuur-link plakken</span><span class="sa-sub">Iemand stuurde je een link? Plak \'m hier.</span></span>'+
      '<span class="sa-chev">›</span>'+
    '</button>';
  var sh=openSheet2(html);
  sh.querySelector("#sa-friends").addEventListener("click", function(){ closeSheet2(); openFriendsSheet(); });
  sh.querySelector("#sa-add").addEventListener("click", function(){ closeSheet2(); openAddShortcutSheet(); });
}

function openSendSheet(scId){
  var s=Shortcuts.byId(scId); if(!s) return;
  var sent=[];
  function renderSheet(displayName){
    return '<div class="grip"></div>'+
      '<h3 style="display:flex;align-items:center;gap:10px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:'+safeColor(s.color)+';flex:0 0 auto"></span><span id="sc-title" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">Sturen naar '+escapeHtml(prettyListName(displayName))+'</span></h3>'+
      '<div class="field" style="margin-bottom:6px">'+
        '<svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'+
        '<input class="name" id="sc-input" type="search" enterkeyhint="send" placeholder="Bijv. melk, brood…" autocapitalize="sentences" autocomplete="off" autocorrect="off" spellcheck="false">'+
        '<button class="addbtn" id="sc-send" aria-label="Stuur"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button>'+
      '</div>'+
      '<div class="chips" id="sc-sent" style="margin:14px 0 4px"></div>'+
      '<div class="hint" style="margin:8px 6px 4px">De ander ziet je toevoegingen direct in hun lijst.</div>';
  }
  var sh=openSheet2(renderSheet(s.name));
  // Wire send-functie tegen actuele sheet (re-wire na eventuele re-render)
  function wire(){
    var inp=sh.querySelector("#sc-input");
    var btn=sh.querySelector("#sc-send");
    if(!inp || !btn) return;
    function send(){
      var nm=(inp.value||"").trim(); if(!nm) return;
      whenCloudReady(function(){
        var from=Cloud.myName();
        Cloud.sb.rpc("add_item_via_token",{p_token:s.token, p_name:nm, p_qty:1, p_note:"", p_from:from}).then(function(r){
          if(r.error){
            toast(r.error.message && /ongeldige stuur-link/i.test(r.error.message)
              ? "Deze lijst is niet meer beschikbaar"
              : "Versturen mislukt");
            return;
          }
          sent.unshift(nm); inp.value="";
          sh.querySelector("#sc-sent").innerHTML=sent.map(function(n){return '<span class="chip"><span class="emoji">✓</span>'+escapeHtml(n)+'</span>';}).join("");
          inp.focus();
          Shortcuts.touch(s.id);
        },function(){ toast("Versturen lukte niet"); });
      });
    }
    btn.addEventListener("click", send);
    inp.addEventListener("keydown", function(e){ if(e.key==="Enter") send(); });
    setTimeout(function(){ if(inp) inp.focus(); }, 280);
  }
  wire();
  // Pre-fetch actuele lijstnaam: als owner ondertussen hernoemt, update shortcut + sheet-kop
  whenCloudReady(function(){
    Cloud.sb.rpc("list_name_by_token",{p_token:s.token}).then(function(r){
      if(r.error || !r.data){
        // Token bestaat niet meer — wis shortcut + meld
        Shortcuts.remove(scId);
        closeSheet2();
        toast("Deze snelkoppeling werkt niet meer — verwijderd");
        return;
      }
      if(r.data !== s.name){
        s.name = r.data;
        Shortcuts.rename(scId, r.data);
        // Update ALLEEN de titel-node — herrender niet de hele sheet (anders verlies je
        // wat de gebruiker net aan 't typen is in #sc-input).
        var titleEl = sh.querySelector("#sc-title");
        if(titleEl) titleEl.textContent = "Sturen naar " + prettyListName(s.name);
      }
    },function(){ /* netwerkfout — laat lokale naam staan, geen toast */ });
  });
}

function openAddShortcutSheet(prefilledToken){
  var html='<div class="grip"></div>'+
    '<h3>Snelkoppeling toevoegen</h3>'+
    '<div class="hint" style="margin:0 6px 14px;line-height:1.5">Plak hieronder de link die iemand jou stuurde. Tik <b>📋 Plak</b> om \'m direct uit je klembord te halen.</div>'+
    '<div class="frow"><input class="txt" id="sc-tokin" placeholder="Plak iemands link" value="'+escapeAttr(prefilledToken||"")+'" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" inputmode="url"></div>'+
    '<button class="mbtn" id="sc-paste" type="button" style="margin:0 0 4px;font-weight:600">📋 Plak uit klembord</button>'+
    '<div class="sheet-actions"><button class="save" id="sc-save-add">Opslaan</button></div>';
  var sh=openSheet2(html);
  setTimeout(function(){ var t=sh.querySelector("#sc-tokin"); if(t) t.focus(); }, 280);
  var pasteBtn = sh.querySelector("#sc-paste");
  if(pasteBtn){
    pasteBtn.addEventListener("click", function(){
      if(navigator.clipboard && navigator.clipboard.readText){
        navigator.clipboard.readText().then(function(text){
          if(text && sh.querySelector("#sc-tokin")){
            sh.querySelector("#sc-tokin").value = text.trim();
            sh.querySelector("#sc-tokin").focus();
          } else { toast("Klembord is leeg"); }
        }, function(){ toast("Geen toegang tot klembord — plak handmatig"); });
      } else {
        toast("Plak handmatig in het veld");
      }
    });
  }
  sh.querySelector("#sc-save-add").addEventListener("click", function(){
    var saveBtn=sh.querySelector("#sc-save-add");
    var raw=sh.querySelector("#sc-tokin").value;
    var token=parseTokenFromInput(raw);
    if(!token){ toast("Deze link werkt niet"); return; }
    if(Shortcuts.byToken(token)){ toast("Al opgeslagen"); closeSheet2(); return; }
    if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent="Controleren…"; saveBtn.style.opacity=".7"; }
    var done=function(ok){
      if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent="Opslaan"; saveBtn.style.opacity=""; }
    };
    whenCloudReady(function(){
      Cloud.sb.rpc("list_name_by_token",{p_token:token}).then(function(r){
        if(r.error || !r.data){ toast("Link verlopen of ongeldig"); done(false); return; }
        Shortcuts.add(r.data, token, pickColor());
        closeSheet2(); toast("“"+r.data+"” opgeslagen"); done(true);
      }, function(){ toast("Geen verbinding — check je internet"); done(false); });
    });
  });
}

function openManageShortcutSheet(id){
  var s=Shortcuts.byId(id); if(!s) return;
  var html='<div class="grip"></div>'+
    '<h3 style="display:flex;align-items:center;gap:10px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:'+safeColor(s.color)+';flex:0 0 auto"></span><span>'+escapeHtml(s.name)+'</span></h3>'+
    '<div class="frow"><input class="txt" id="sc-rename" value="'+escapeAttr(s.name)+'" autocapitalize="words"></div>'+
    '<div class="sheet-actions"><button class="save" id="sc-save-name">Naam opslaan</button><button class="del" id="sc-delete">Verwijder</button></div>';
  var sh=openSheet2(html);
  sh.querySelector("#sc-save-name").addEventListener("click", function(){
    var v=(sh.querySelector("#sc-rename").value||"").trim();
    if(!v){ toast("Naam mag niet leeg zijn"); return; }
    Shortcuts.rename(id, v); closeSheet2(); toast("Hernoemd");
  });
  sh.querySelector("#sc-delete").addEventListener("click", function(){
    if(confirm("Snelkoppeling '"+s.name+"' verwijderen?")){
      Shortcuts.remove(id); closeSheet2(); toast("Verwijderd");
    }
  });
}

/* ============================================================
   CLOUD UI
   ============================================================ */
/* "Boodschappen van X" → "X" voor cosmetische rendering; raw DB-naam blijft onaangetast */
function prettyListName(name){
  if(!name) return "Gedeeld";
  var m=String(name).match(/^\s*boodschappen van\s+(.+?)\s*$/i);
  return m ? m[1] : name;
}
/* Is dit lijst-object de eigen inbox van de gebruiker? */
function isInboxList(l){
  return !!(l && Cloud.profile && Cloud.profile.inbox_list_id && l.id === Cloud.profile.inbox_list_id);
}
/* Vriendelijke weergavenaam voor een lijst — eigen inbox krijgt "Naar mij gestuurd". */
function listDisplayName(l){
  if(!l) return "Gedeeld";
  if(isInboxList(l)) return "Naar mij gestuurd";
  return prettyListName(l.name);
}
function ownerColor(l){ return safeColor(ownerColorRaw(l)); }
function ownerColorRaw(l){
  if(l && Cloud.members && l.owner_user_id){
    for(var i=0;i<Cloud.members.length;i++){
      if(Cloud.members[i].user_id===l.owner_user_id) return Cloud.members[i].color;
    }
  }
  return (Cloud.me && Cloud.me.color) || "#2F7A4F";
}
function applyListHeader(){
  if(activeTab!=="lijst") return;
  var title=$("#title"), ctitle=$("#ctitle"), shareTop=$("#share-top-btn");
  // Fade titel in zodra we de juiste tekst hebben — voorkomt "Boodschappen → Florian" flikker.
  var lh=document.querySelector(".largehead"); if(lh) lh.removeAttribute("data-loading");
  if(Cloud.active){
    var l=Cloud.activeList();
    var nm=l?listDisplayName(l):"Gedeeld";
    var col=ownerColor(l);
    title.textContent=nm;
    title.classList.add("has-dot");
    title.style.setProperty("--list-dot", col);
    ctitle.textContent=nm;
    ctitle.classList.add("has-dot");
    ctitle.style.setProperty("--list-dot", col);
    if(shareTop) shareTop.classList.add("show");
  } else {
    title.textContent=(typeof localListName==="function") ? localListName() : "Boodschappen";
    title.classList.remove("has-dot");
    title.style.removeProperty("--list-dot");
    ctitle.textContent=(typeof localListName==="function") ? localListName() : "Boodschappen";
    ctitle.classList.remove("has-dot");
    ctitle.style.removeProperty("--list-dot");
    if(shareTop) shareTop.classList.remove("show");
  }
}

function renderListSwitch(){
  var wrap=$("#list-switch-wrap"); if(!wrap) return;
  wrap.innerHTML="";
  if(activeTab!=="lijst") return;          // pill alleen op de lijst-tab
  var locals = (typeof localLists==="function") ? localLists() : [];
  if(!Cloud.enabled && locals.length<=1) return;   // één lokale lijst en geen cloud → niets te kiezen
  var l=Cloud.activeList();
  var meta = (typeof currentListMeta==="function") ? currentListMeta() : null;
  var name = Cloud.active ? (l?listDisplayName(l):"Gedeeld") : ((meta && meta.name) || "Boodschappen");
  var icoHtml;
  if(Cloud.active && isInboxList(l)){
    icoHtml = '<span class="ls-ico">📥</span>';
  } else if(Cloud.active){
    var col = ownerColor(l);
    icoHtml = '<span class="ls-ico-dot" style="background:'+col+'"></span>';
  } else {
    icoHtml = '<span class="ls-ico">'+escapeHtml((meta && meta.glyph) || "🧺")+'</span>';
  }
  var sub = Cloud.active ? "Gedeeld" : "Op dit toestel";
  var pill=el("button","list-switch",icoHtml+'<span class="ls-name">'+escapeHtml(name)+'</span><span class="ls-pill-sub">'+sub+'</span><svg class="ls-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>');
  pill.type="button"; pill.setAttribute("aria-label","Lijst kiezen: "+name);
  pill.addEventListener("click",openSwitchSheet);
  wrap.appendChild(pill);
}

function renderMembersRow(){
  var row=$("#members-row"); if(!row) return;
  if(!Cloud.active || activeTab!=="lijst"){ row.className="members-row empty"; row.innerHTML=""; return; }
  row.className="members-row";
  var now=Date.now();
  // toon alleen ANDERE leden (jij ben je zelf al — geen zin in een avatar van jezelf)
  var others=Cloud.members.filter(function(m){ return m.user_id !== Cloud.userId; });
  // wie is nu live aanwezig (via realtime presence)?
  var liveIds = {}, shopIds={}; (Cloud.present||[]).forEach(function(p){ liveIds[p.user_id]=1; if(p.shopping) shopIds[p.user_id]=1; });
  var avs=others.map(function(m){
    var live = !!liveIds[m.user_id], shopping=!!shopIds[m.user_id];
    var online = live || (m.last_seen && (now-new Date(m.last_seen).getTime() < 120000));
    return '<div class="av'+(online?'':' offline')+(live?' live':'')+(shopping?' shopping':'')+'" title="'+escapeHtml(m.display_name)+(shopping?' · in de winkel':(live?' · kijkt nu mee':''))+'" style="background:'+safeColor(m.color)+'">'+escapeHtml(initials(m.display_name).slice(0,1))+'</div>';
  }).join("");
  var avBlock = others.length ? '<div class="avatars" aria-label="Leden">'+avs+'</div>' : '';
  row.innerHTML = avBlock +
    '<button class="share-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>Delen</button>';
  var avEl=row.querySelector(".avatars");
  if(avEl) avEl.addEventListener("click",function(){ if(Cloud.active) openShareSheet(Cloud.active); });
  row.querySelector(".share-btn").addEventListener("click",function(){ if(Cloud.active) openShareSheet(Cloud.active); });
}

/* "Bob kijkt mee"-balkje op een gedeelde lijst (live presence) */
function renderPresence(){
  var bar=document.getElementById("presence-bar"); if(!bar) return;
  var present=(Cloud.present||[]);
  if(activeTab!=="lijst" || !Cloud.active || !present.length){ bar.className="presence-bar empty"; bar.innerHTML=""; return; }
  var shoppers=present.filter(function(p){ return p && p.shopping; });
  if(shoppers.length){
    var sn=shoppers.map(function(p){ return p.name||"Iemand"; });
    var st = (sn.length===1 ? sn[0]+" is" : (sn.length===2 ? sn[0]+" en "+sn[1]+" zijn" : sn.length+" mensen zijn"))+" in de winkel";
    bar.className="presence-bar shopping";
    bar.innerHTML='<span class="pb-dot"></span><span class="pb-txt"></span><button class="pb-act" type="button">Nog iets nodig?</button>';
    bar.querySelector(".pb-txt").textContent="🛒 "+st;
    bar.querySelector(".pb-act").addEventListener("click", function(){ var i=document.getElementById("add-name"); if(i){ i.focus(); try{ i.scrollIntoView({block:"nearest"}); }catch(e){} } });
    return;
  }
  var names=present.map(function(p){return p.name||"Iemand";});
  var txt;
  if(names.length===1) txt=names[0]+" kijkt mee";
  else if(names.length===2) txt=names[0]+" en "+names[1]+" kijken mee";
  else txt=names.length+" mensen kijken mee";
  bar.className="presence-bar";
  bar.innerHTML='<span class="pb-dot"></span><span>'+escapeHtml(txt)+'</span>';
}

/* --- tweede sheet helpers --- */
function openSheet2(html){
  var s=$("#sheet2"); s.innerHTML='<div class="grip"></div>'+html;
  $("#scrim2").classList.add("show"); s.classList.add("show");
  document.body.classList.add("sheet-open");
  if(typeof bindSheetKeyboardScroll==="function") bindSheetKeyboardScroll(s);
  if(typeof injectSheetX==="function") injectSheetX(s, closeSheet2);
  if(typeof modalOpen==="function") modalOpen(s, closeSheet2);
  return s;
}
function closeSheet2(){
  $("#scrim2").classList.remove("show"); $("#sheet2").classList.remove("show");
  if(!$("#sheet").classList.contains("show")) document.body.classList.remove("sheet-open");
  if(typeof modalClose==="function") modalClose($("#sheet2"));
}
$("#scrim2").addEventListener("click",closeSheet2);

function openSwitchSheet(){
  var html='<h3>Mijn lijsten</h3>';
  // Lokale lijsten (op dit toestel) — met beheer-knop
  var locals = (typeof localLists==="function") ? localLists() : [];
  var activeLocal = (typeof state!=="undefined" && state) ? state.activeLocalId : null;
  locals.forEach(function(ll){
    var isOn = !Cloud.active && ll.id===activeLocal;
    var kind = (typeof presetOf==="function") ? presetOf(ll.preset).name : "Lijst";
    var cnt = (ll.id===activeLocal && !Cloud.active ? state.list : (ll.items||[])).filter(function(i){ return !i.done; }).length;
    html+='<div class="ls-item'+(isOn?" active":"")+'" data-act="local:'+escapeAttr(ll.id)+'" role="button" tabindex="0">'+
      '<div class="lsi-ico" style="background:var(--surface-3)">'+escapeHtml(ll.glyph||"🧺")+'</div>'+
      '<div class="lsi-meta"><div class="lsi-name lsi-text">'+escapeHtml(ll.name)+'</div>'+
      '<div class="lsi-sub">'+escapeHtml(kind)+' · op dit toestel'+(cnt?' · '+cnt+' open':'')+'</div></div>'+
      (isOn?'<span class="lsi-check">✓</span>':'')+
      '<button class="lsi-more" type="button" data-manage="'+escapeAttr(ll.id)+'" aria-label="Beheer '+escapeAttr(ll.name)+'">⋯</button>'+
    '</div>';
  });
  // Cloud-lijsten — inbox eerst, rest daarna
  var sortedLists = (Cloud.lists||[]).slice().sort(function(a,b){ return (isInboxList(b)?1:0)-(isInboxList(a)?1:0); });
  sortedLists.forEach(function(l){
    var col=ownerColor(l);
    var inbox=isInboxList(l);
    var nm=inbox?"Naar mij gestuurd":prettyListName(l.name);
    var cnt=l.member_count||1;
    var iOwn=l.owner_user_id===Cloud.userId;
    var badge;
    if(inbox) badge="Wat vrienden je sturen";
    else if(cnt<=1) badge=iOwn?'Alleen jij · niet gedeeld':'Alleen jij';
    else if(iOwn) badge='Jij + '+(cnt-1)+' ander'+(cnt-1>1?'en':'');
    else badge=cnt+' leden';
    var ico = inbox
      ? '<div class="lsi-ico" style="background:var(--brand-2)">📥</div>'
      : '<div class="lsi-ico" style="background:'+col+';color:#fff;font-size:var(--fs-sm);font-weight:var(--fw-bold);letter-spacing:.02em">'+escapeHtml(initials(nm))+'</div>';
    html+='<div class="ls-item'+(Cloud.active===l.id?" active":"")+'" data-act="'+escapeAttr(l.id)+'" role="button" tabindex="0">'+
      ico+
      '<div class="lsi-meta"><div class="lsi-name lsi-text">'+escapeHtml(nm)+'</div>'+
      '<div class="lsi-sub">'+escapeHtml(badge)+'</div></div>'+
      (Cloud.active===l.id?'<span class="lsi-check">✓</span>':'')+
    '</div>';
  });
  html+='<button class="mbtn" id="ls-new" type="button" style="width:100%;margin-top:12px">+ Nieuwe lijst</button>'+
    (Cloud.enabled ? '<button class="mbtn" id="ls-join" type="button" style="width:100%;margin-top:8px">Code invoeren</button>' : '');
  var s=openSheet2(html);
  s.querySelectorAll(".ls-item").forEach(function(it){
    var go=function(){
      var act=it.dataset.act; closeSheet2();
      if(act.indexOf("local:")===0){ if(typeof switchLocalList==="function") switchLocalList(act.slice(6)); }
      else Cloud.open(act).then(function(){ switchTab("lijst"); });
    };
    it.addEventListener("click",function(e){ if(e.target && e.target.closest && e.target.closest(".lsi-more")) return; go(); });
    it.addEventListener("keydown",function(e){ if(e.target!==it) return; if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } });
  });
  s.querySelectorAll(".lsi-more").forEach(function(b){
    b.addEventListener("click",function(e){ e.stopPropagation(); var id=b.dataset.manage; closeSheet2(); if(typeof openListManageSheet==="function") openListManageSheet(id); });
  });
  s.querySelector("#ls-new").addEventListener("click",function(){ closeSheet2(); if(typeof openNewListSheet==="function") openNewListSheet(); });
  var jb=s.querySelector("#ls-join"); if(jb) jb.addEventListener("click",function(){ closeSheet2(); ensureIdentity(function(){ promptJoin(); }); });
}

function promptNewList(){
  var html='<h3>Nieuwe lijst</h3>'+
    '<div class="frow"><input class="txt" id="nl-name" placeholder="Naam, bijv. Thuis, Weekend, Vakantie" autocapitalize="words"></div>'+
    '<div class="hint" style="margin:0 6px 14px;line-height:1.5">Privé voor jou — delen kan later via de Delen-knop.</div>'+
    '<div class="sheet-actions"><button class="save" id="nl-go">Aanmaken</button></div>';
  var s=openSheet2(html);
  setTimeout(function(){ var i=s.querySelector("#nl-name"); if(i){ i.focus(); } },250);
  s.querySelector("#nl-go").addEventListener("click",function(){
    var nm=(s.querySelector("#nl-name").value||"").trim();
    if(!nm) nm="Mijn lijst";
    closeSheet2();
    Cloud.createList(nm);
  });
}
/* Wacht tot de cloud klaar is (SDK lazy geladen, sessie hersteld) voordat een RPC loopt */
function whenCloudReady(fn){
  if(Cloud.ready){ fn(); return; }
  var tries=0;
  var t=setInterval(function(){
    if(Cloud.ready){ clearInterval(t); fn(); return; }
    var busy = Cloud._initInProgress || Cloud.enabled;
    if(++tries>60 || !busy){ clearInterval(t); toast("Cloud is nog niet klaar — probeer het zo nog eens"); }
  }, 250);
}
function promptJoin(code){
  var html='<h3>Lijst joinen</h3><div class="frow"><input class="txt" id="jn-code" placeholder="6-cijferige code" autocapitalize="characters" value="'+(code?escapeAttr(code):"")+'" style="text-transform:uppercase;letter-spacing:.1em;font-weight:700"></div><div class="sheet-actions"><button class="save" id="jn-go">Meedoen</button></div>';
  var s=openSheet2(html);
  setTimeout(function(){ var i=s.querySelector("#jn-code"); if(i) i.focus(); },250);
  s.querySelector("#jn-go").addEventListener("click",function(){ var c=(s.querySelector("#jn-code").value||"").trim(); if(!c){toast("Vul een code in");return;} closeSheet2(); whenCloudReady(function(){ Cloud.joinList(c); }); });
}

/* Avatar-render: emoji indien gekozen (zelf getypt), anders initialen-cirkel in de kleur.
   Eén helper voor leden, vrienden en de switcher. */
function avatarHtml(name, color, emoji, size){
  size = size || 34;
  var inner, bg;
  if(emoji){
    // In dark mode meer kleur-mix zodat de stip niet verdwijnt
    var dark = (typeof effectiveTheme==="function" && effectiveTheme()==="dark");
    inner = '<span class="emoji" style="font-size:'+Math.round(size*0.56)+'px">'+escapeHtml(String(emoji).slice(0,8))+'</span>';
    bg = "color-mix(in srgb, "+safeColor(color)+" "+(dark?28:18)+"%, var(--surface-1))";
  } else {
    inner = '<span style="color:#fff;font-weight:700;font-size:'+Math.round(size*0.4)+'px;letter-spacing:.02em">'+escapeHtml(initials(name))+'</span>';
    bg = safeColor(color);
  }
  return '<span class="avatar" style="width:'+size+'px;height:'+size+'px;background:'+bg+'">'+inner+'</span>';
}

/* Profiel-sheet: naam + kleur + optioneel zelf-getypte emoji.
   editMode=true → vooraf invullen vanuit Cloud.me en altijd tonen (profiel bewerken). */
function openProfileSheet(cb, editMode){
  var existing = Cloud.me || {};
  var color = existing.color || pickColor();
  var chosen = color, chosenEmoji = existing.emoji || "";
  var dots = MEMBER_COLORS.map(function(c){
    return '<button class="color-chip clr'+(c===color?" on":"")+'" data-c="'+c+'" type="button" style="background:'+c+'"></button>';
  }).join("");
  var html='<h3>'+(editMode?"Je profiel":"Hoe heet je?")+'</h3>'+
    '<div class="frow"><input class="txt" id="id-name" placeholder="Je naam" autocapitalize="words" value="'+escapeAttr(existing.display_name||"")+'"></div>'+
    '<div class="sheet-label"><span class="lbl-cap">Kleur</span></div>'+
    '<div class="cadrow" id="id-colors" style="gap:10px">'+dots+'</div>'+
    '<div class="sheet-label"><span class="lbl-cap">Avatar-emoji</span><span class="lbl-hint">optioneel</span></div>'+
    '<div class="frow"><input class="txt" id="id-emoji" maxlength="2" placeholder="bijv. 🦊 (laat leeg voor initialen)" value="'+escapeAttr(chosenEmoji)+'" autocomplete="off"></div>'+
    '<div class="sheet-actions"><button class="save" id="id-go">'+(editMode?"Opslaan":"Doorgaan")+'</button></div>';
  var s=openSheet2(html);
  setTimeout(function(){ var i=s.querySelector("#id-name"); if(i) i.focus(); },250);
  s.querySelectorAll("#id-colors .clr").forEach(function(b){
    b.addEventListener("click",function(){ chosen=b.dataset.c; s.querySelectorAll("#id-colors .clr").forEach(function(x){x.classList.remove("on");}); b.classList.add("on"); });
  });
  s.querySelector("#id-go").addEventListener("click",function(){
    var nm=(s.querySelector("#id-name").value||"").trim(); if(!nm){ toast("Vul je naam in"); return; }
    var em=(s.querySelector("#id-emoji").value||"").trim();
    // Houd alleen het eerste teken/emoji aan (Array.from telt emoji als 1)
    if(em){ try{ em = Array.from(em)[0] || ""; }catch(e){ em = em.slice(0,2); } }
    Cloud.me={display_name:nm, color:chosen, emoji:em,
              friendCode:existing.friendCode, inboxToken:existing.inboxToken};
    Cloud.saveMe(); closeSheet2();
    if(Cloud.ready){ Cloud.syncProfile().then(function(){ if(typeof cb==="function") cb(); }); }
    else if(typeof cb==="function") cb();
  });
}

/* Eenmalig identiteit vragen (alleen als nog geen naam); daarna callback */
function ensureIdentity(cb){
  if(Cloud.me && Cloud.me.display_name){ cb(); return; }
  openProfileSheet(cb, false);
}

function relativeTime(iso){
  if(!iso) return "";
  var t = new Date(iso).getTime(); if(isNaN(t)) return "";
  var diff = (Date.now() - t) / 1000;
  if(diff < 45) return "net";
  if(diff < 3600) return Math.floor(diff/60)+" min";
  if(diff < 86400) return Math.floor(diff/3600)+" u";
  if(diff < 604800) return Math.floor(diff/86400)+" d";
  try{ return new Date(iso).toLocaleDateString("nl-NL",{day:"numeric",month:"short"}); }catch(e){ return ""; }
}

/* Werk een geopende deel-sheet live bij (iemand joinde/verliet), maar niet midden in
   een inline-hernoem — dan zou je de getypte naam kwijtraken. */
function reRenderShareSheetIfOpen(listId){
  var s2=document.getElementById("sheet2");
  if(!s2 || !s2.classList.contains("show")) return;
  if(!s2.querySelector("#sh-invite")) return;       // is dit wel de deel-sheet?
  if(s2.querySelector("#sh-rename-input")) return;  // niet herrenderen tijdens hernoemen
  openShareSheet(listId);
}
function openShareSheet(listId){
  var l=Cloud.listById(listId); if(!l) return;
  var isOwner = (l.owner_user_id === Cloud.userId);
  var dotCol = ownerColor(l);
  var prettyName = listDisplayName(l);

  function memberRowHtml(m){
    var isYou = (m.user_id === Cloud.userId);
    var action = '';
    if(isYou){
      action = '<button class="lsi-member-action leave" type="button">Verlaten</button>';
    } else if(isOwner){
      action = '<button class="lsi-member-action kick" data-user="'+m.user_id+'" data-name="'+escapeAttr(m.display_name)+'" type="button">Verwijder</button>';
    }
    return '<div class="ls-item">'+
      avatarHtml(m.display_name, m.color, "", 34)+
      '<div class="lsi-meta lsi-text lsi-name" style="font-size:16px">'+escapeHtml(m.display_name)+(isYou?' <span style="color:var(--ink-faint);font-weight:500">(jij)</span>':'')+'</div>'+
      action+
    '</div>';
  }

  function buildHtml(activityHtml){
    var memberHtml = Cloud.members.map(memberRowHtml).join("");
    var titleHtml = '<h3 id="sh-title-row" style="display:flex;align-items:center;gap:10px"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:'+dotCol+';flex:0 0 auto"></span><span id="sh-title-name" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(prettyName)+'</span>'+
      (isOwner?'<button id="sh-rename" type="button" aria-label="Hernoem" style="border:0;background:transparent;color:var(--ink-soft);padding:6px;border-radius:8px"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>':'')+
    '</h3>';
    // Join-code prettier: spaties tussen halves voor leesbaarheid
    var codePretty = l.join_code.length === 6 ? l.join_code.slice(0,3)+" "+l.join_code.slice(3) : l.join_code;
    return titleHtml +
      '<div class="code-box"><div class="cb-lbl">Code</div><div class="cb-code">'+escapeHtml(codePretty)+'</div></div>'+
      '<button class="mbtn primary" id="sh-invite">Stuur uitnodiging</button>'+
      '<button class="mbtn" id="sh-qr-toggle" type="button">Laat een QR-code scannen</button>'+
      '<div class="qr-box" id="sh-qr" hidden><div class="qr-svg"></div><div class="qr-cap">Scan met de camera of via de scanknop in Mandje — je doet dan direct mee.</div></div>'+
      '<button class="mbtn" id="sh-more-toggle" type="button" style="font-weight:500;color:var(--ink-soft);background:transparent;border:0;box-shadow:none;padding:8px 4px;margin:4px 0 6px">Andere opties ▾</button>'+
      '<div id="sh-more" style="display:none">'+
        '<button class="mbtn" id="sh-link">Kopieer uitnodig-link</button>'+
        '<button class="mbtn" id="sh-send">Deel "stuur items"-link</button>'+
        '<div class="hint" style="margin:2px 6px 14px;line-height:1.5">De <b>uitnodig-link</b> laat iemand meedoen en alles zien. De <b>stuur-link</b> geeft iemand alleen een drop-pagina om dingen aan jou te sturen — zonder app, zonder mee te kijken.</div>'+
      '</div>'+
      (memberHtml?('<div class="sheet-label"><span class="lbl-cap">Leden ('+Cloud.members.length+')</span></div>'+memberHtml):'')+
      // Vrienden die nog geen lid zijn → 1-tap toevoegen
      (function(){
        var memberIds = Cloud.members.map(function(m){return m.user_id;});
        var addable = (Cloud.friends||[]).filter(function(f){ return memberIds.indexOf(f.user_id)===-1; });
        if(!addable.length) return '';
        return '<div class="sheet-label" style="margin-top:14px"><span class="lbl-cap">Vrienden toevoegen</span></div>'+
          addable.map(function(f){
            return '<div class="ls-item"><span style="flex:0 0 auto">'+avatarHtml(f.name,f.color,f.emoji,32)+'</span>'+
              '<div class="lsi-name" style="flex:1;min-width:0;font-size:16px">'+escapeHtml(f.name)+'</div>'+
              '<button class="lsi-member-action add-friend-to-list" data-user="'+f.user_id+'" type="button" style="color:var(--brand);font-weight:700">+ Toevoegen</button></div>';
          }).join("");
      })()+
      (activityHtml||'')+
      (isOwner ? '<div class="sheet-label" style="margin-top:22px"><span class="lbl-cap">Let op</span></div><button class="mbtn danger" id="sh-delete-list" type="button" style="width:100%;color:var(--danger);border-color:color-mix(in srgb, var(--danger) 25%, var(--line))">Lijst verwijderen</button><div class="hint" style="margin:4px 6px 0">Alle items en leden zijn dan weg voor altijd.</div>' : '');
  }

  var s = openSheet2(buildHtml(''));
  wireShareSheet(s, l, isOwner, prettyName);

  // recente activiteit laden + onder de leden injecteren
  Cloud.recentActivity(l.id).then(function(rows){
    if(!rows || !rows.length) return;
    var html = '<div class="sheet-label" style="margin-top:18px"><span class="lbl-cap">Recente activiteit</span></div>';
    rows.forEach(function(it){
      var who = escapeHtml(it.added_by_name || "iemand");
      var name = escapeHtml(it.name||"");
      html += '<div class="activity-row"><div class="ar-icon add">+</div><div class="ar-text"><b>'+who+'</b>: '+name+'</div><div class="ar-time">'+escapeHtml(relativeTime(it.created_at))+'</div></div>';
    });
    s.innerHTML = '<div class="grip"></div>' + buildHtml(html);
    wireShareSheet(s, l, isOwner, prettyName);
  });
}

function wireShareSheet(s, l, isOwner, prettyName){
  var invite = s.querySelector("#sh-invite");
  var lnk = s.querySelector("#sh-link");
  var snd = s.querySelector("#sh-send");
  var moreT = s.querySelector("#sh-more-toggle");
  var moreW = s.querySelector("#sh-more");
  if(moreT && moreW){
    moreT.addEventListener("click", function(){
      var open = moreW.style.display !== "none";
      moreW.style.display = open ? "none" : "block";
      moreT.textContent = open ? "Andere opties ▾" : "Andere opties ▴";
    });
  }
  if(invite) invite.addEventListener("click",function(){ shareNative(Cloud.shareLink(l), "Doe mee met onze boodschappenlijst \""+prettyName+"\" in Mandje 🧺", "Uitnodig-link gekopieerd"); });
  var qrT = s.querySelector("#sh-qr-toggle"), qrB = s.querySelector("#sh-qr");
  if(qrT && qrB){
    qrT.addEventListener("click", function(){
      var open = !qrB.hidden;
      if(open){ qrB.hidden=true; qrT.textContent="Laat een QR-code scannen"; return; }
      if(typeof qrSvg==="function" && !qrB.querySelector("svg")){ qrB.querySelector(".qr-svg").innerHTML = qrSvg(Cloud.shareLink(l), {px:220, label:"QR-code van de uitnodig-link"}); }
      qrB.hidden=false; qrT.textContent="Verberg QR-code";
    });
  }
  if(lnk) lnk.addEventListener("click",function(){ copyText(Cloud.shareLink(l),"Uitnodig-link gekopieerd"); });
  if(snd) snd.addEventListener("click",function(){ shareNative(Cloud.sendLink(l), "Stuur boodschappen naar onze lijst \""+prettyName+"\" 🧺", "Stuur-link gekopieerd"); });

  s.querySelectorAll(".lsi-member-action.leave").forEach(function(b){
    b.addEventListener("click",function(){ if(confirm("Deze gedeelde lijst verlaten?")){ closeSheet2(); Cloud.leaveList(l.id); } });
  });
  s.querySelectorAll(".lsi-member-action.kick").forEach(function(b){
    b.addEventListener("click",function(){
      var nm = b.dataset.name || "Dit lid";
      if(confirm(nm+" uit deze lijst verwijderen?")){
        Cloud.kickMember(l.id, b.dataset.user).then(function(){ openShareSheet(l.id); });
      }
    });
  });

  s.querySelectorAll(".add-friend-to-list").forEach(function(b){
    b.addEventListener("click", function(){
      Cloud.addFriendToList(l.id, b.dataset.user).then(function(ok){ if(ok) openShareSheet(l.id); });
    });
  });

  var delBtn = s.querySelector("#sh-delete-list");
  if(delBtn){
    delBtn.addEventListener("click", function(){
      // Naam-confirmation om accidentele kliks te voorkomen
      var typed = prompt('Typ de naam "'+prettyName+'" om te bevestigen dat je deze lijst wilt verwijderen. Items en leden worden definitief weg.');
      if(typed === null) return;
      if(typed.trim().toLowerCase() !== prettyName.trim().toLowerCase()){
        toast("Naam komt niet overeen");
        return;
      }
      closeSheet2();
      Cloud.deleteList(l.id);
    });
  }

  var rename = s.querySelector("#sh-rename");
  if(rename){
    rename.addEventListener("click",function(){
      var row = s.querySelector("#sh-title-row");
      if(!row) return;
      row.innerHTML = '<div class="inline-rename"><input id="sh-rename-input" type="text" value="'+escapeAttr(prettyName)+'" maxlength="50" autocomplete="off"><button class="ir-save" id="sh-rename-save" type="button">Opslaan</button><button class="ir-cancel" id="sh-rename-cancel" type="button">Annuleer</button></div>';
      var inp = s.querySelector("#sh-rename-input");
      setTimeout(function(){ if(inp){ inp.focus(); inp.select(); } }, 50);
      s.querySelector("#sh-rename-cancel").addEventListener("click",function(){ openShareSheet(l.id); });
      var doSave = function(){
        var nv = (inp.value||"").trim();
        if(!nv){ toast("Naam mag niet leeg zijn"); return; }
        Cloud.renameList(l.id, nv).then(function(ok){ if(ok) openShareSheet(l.id); });
      };
      s.querySelector("#sh-rename-save").addEventListener("click", doSave);
      inp.addEventListener("keydown", function(e){ if(e.key==="Enter") doSave(); if(e.key==="Escape"){ e.stopPropagation(); openShareSheet(l.id); } });
    });
  }
}

function copyText(txt,msg){
  msg = msg || "Kopieer deze tekst";
  if(typeof txt !== "string" && txt != null) txt = String(txt);
  if(!txt){
    if(typeof toast === "function") toast("Niets om te kopiëren");
    return Promise.resolve(false);
  }
  if(typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText==="function"){
    return navigator.clipboard.writeText(txt).then(function(){
      if(msg) toast(msg);
      return true;
    },function(){
      try{
        if(typeof window !== "undefined" && typeof window.prompt==="function"){
          window.prompt("Kopieer handmatig:", txt);
          if(typeof toast === "function") toast(msg);
        } else if(typeof toast === "function"){
          toast(msg + " — kopieer met Ctrl/Cmd + C");
        }
      }catch(e){ if(typeof toast === "function") toast(msg + " — kopieer met Ctrl/Cmd + C"); }
      return false;
    });
  }
  try{
    if(typeof window !== "undefined" && typeof window.prompt==="function"){
      window.prompt("Kopieer handmatig:", txt);
      if(typeof toast === "function") toast(msg + " — niet automatisch gekopieerd");
    } else if(typeof toast === "function"){
      toast(msg + " — niet automatisch gekopieerd");
    }
  }catch(e){
    if(typeof toast === "function") toast(msg + " — niet automatisch gekopieerd");
  }
  return Promise.resolve(false);
}
function shareNative(url, text, fallbackMsg){
  if(typeof navigator !== "undefined" && navigator.share){
    return navigator.share({title:"Mandje", text:text, url:url}).then(function(){ return true;},function(){ return copyText(url, fallbackMsg);});
  }
  return copyText(url, fallbackMsg);
}

/* ---- publieke stuur-pagina (geen lidmaatschap) ---- */
function openSendScreen(token){
  var scr=$("#send-screen"); scr.classList.add("show");
  // Deep-link-pagina (?send=…): geen eigen history-entry (back = browser-geschiedenis), wel Escape/X
  function closeSendScreen(){ try{ history.replaceState({}, "", location.pathname); }catch(e){} scr.classList.remove("show"); if(typeof modalClose==="function") modalClose(scr); }
  if(typeof modalOpen==="function") modalOpen(scr, closeSendScreen, {history:false});
  var added=[];
  function renderError(msg){
    scr.innerHTML =
      '<div class="ss-badge" style="background:var(--accent-2)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></div>'+
      '<div class="eyebrow">Niet beschikbaar</div>'+
      '<h1>Link werkt niet</h1>'+
      '<div class="ss-sub">'+escapeHtml(msg||"Deze stuur-link is verlopen of de lijst is verwijderd.")+'</div>'+
      '<button class="mbtn primary" id="ss-back" style="margin-top:26px">Terug naar Mandje</button>';
    var back = scr.querySelector("#ss-back");
    if(back) back.addEventListener("click", closeSendScreen);
  }
  function render(listName){
    Shortcuts.load();
    var alreadySaved = !!Shortcuts.byToken(token);
    scr.innerHTML=
      '<div class="ss-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></div>'+
      '<div class="eyebrow">Stuur naar</div>'+
      '<h1>'+escapeHtml(prettyListName(listName)||"de lijst")+'</h1>'+
      '<div class="ss-sub">Voeg producten toe. De ander ziet ze meteen verschijnen.</div>'+
      '<div class="field"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'+
        '<input class="name" id="ss-name" placeholder="Bijv. melk, brood…" enterkeyhint="send" autocapitalize="sentences">'+
        '<button class="addbtn" id="ss-add" aria-label="Stuur"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>'+
      '</div>'+
      '<div class="frow" style="margin-top:12px"><input class="txt" id="ss-from" placeholder="Je naam (optioneel)" autocapitalize="words" value="'+escapeAttr((Cloud.me&&Cloud.me.display_name)||"")+'"></div>'+
      '<div class="ss-added"><div class="chips" id="ss-chips"></div></div>'+
      '<button class="mbtn'+(alreadySaved?'':' primary')+'" id="ss-remember" style="margin-top:22px;'+(alreadySaved?'opacity:.55;pointer-events:none;':'')+'">'+(alreadySaved?'✓ Al een snelkoppeling':'Onthoud deze lijst als snelkoppeling')+'</button>'+
      '<div class="hint" style="margin:4px 6px 0">Daarna kun je vanaf je Mandje-hoofdscherm in 1 tap items hierheen sturen.</div>';
    var nameI=scr.querySelector("#ss-name");
    function send(){
      var nm=(nameI.value||"").trim(); if(!nm) return;
      var from=(scr.querySelector("#ss-from").value||"").trim();
      Cloud.sb.rpc("add_item_via_token",{p_token:token,p_name:nm,p_qty:1,p_note:"",p_from:from}).then(function(r){
        if(r.error){ toast(/rustig/i.test(r.error.message||"") ? "Even wachten — te veel tegelijk" : "Versturen lukte niet"); return; }
        added.unshift(nm); nameI.value="";
        scr.querySelector("#ss-chips").innerHTML=added.map(function(n){return '<span class="chip"><span class="emoji">✓</span>'+escapeHtml(n)+'</span>';}).join("");
        nameI.focus();
      },function(){ toast("Versturen lukte niet"); });
    }
    scr.querySelector("#ss-add").addEventListener("click",send);
    nameI.addEventListener("keydown",function(e){ if(e.key==="Enter") send(); });
    var remBtn=scr.querySelector("#ss-remember");
    if(remBtn && !alreadySaved){
      remBtn.addEventListener("click", function(){
        var defaultName=prettyListName(listName)||"Lijst";
        var nm=prompt("Naam voor deze snelkoppeling:", defaultName);
        if(nm===null) return;
        nm=(nm||"").trim(); if(!nm) nm=defaultName;
        Shortcuts.add(nm, token, pickColor());
        remBtn.textContent="✓ Snelkoppeling opgeslagen";
        remBtn.style.background=""; remBtn.style.color=""; remBtn.style.borderColor="";
        remBtn.style.opacity=".55"; remBtn.style.pointerEvents="none";
        toast("Snelkoppeling opgeslagen");
      });
    }
  }
  // lijstnaam ophalen — bij ongeldige token een duidelijke error-state ipv generic "de lijst"
  if(Cloud.sb){
    Cloud.sb.rpc("list_name_by_token",{p_token:token}).then(function(r){
      if(r && r.data){ render(r.data); }
      else if(r && r.error){ renderError("Deze stuur-link is verlopen of de lijst is verwijderd."); }
      else { renderError("Deze stuur-link bestaat niet."); }
    },function(){ renderError("Geen verbinding — probeer 't later opnieuw."); });
  } else render(null);
}

/* Exposeer Cloud vroegtijdig als publieke property voor test- en diagnosepaden. */
if(typeof window !== "undefined"){
  window.Cloud = Cloud;
  window.__cloudRef = Cloud;
}

