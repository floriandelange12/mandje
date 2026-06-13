/* ============================================================
   CLOUD — gedeelde lijsten via Supabase
   ============================================================ */
/* >>> Sleutels staan in het config-blok bovenaan mandje.html (window.MANDJE_CONFIG) <<< */
var SUPABASE_URL = (window.MANDJE_CONFIG && window.MANDJE_CONFIG.SUPABASE_URL) || "";
var SUPABASE_ANON_KEY = (window.MANDJE_CONFIG && window.MANDJE_CONFIG.SUPABASE_ANON_KEY) || "";

var MEMBER_COLORS = ["#2F7A4F","#3D8BFF","#E0772E","#9B5DE5","#E5446D","#1FB6A8","#C9A227","#E07A5F"];
function pickColor(){ return MEMBER_COLORS[Math.floor(Math.random()*MEMBER_COLORS.length)]; }
function initials(name){
  name=(name||"").trim(); if(!name) return "?";
  var p=name.split(/\s+/);
  return (p.length>1 ? (p[0][0]+p[1][0]) : name.slice(0,2)).toUpperCase();
}

var SUPABASE_SDK_CDNS = [
  {name:"esm.sh",   url:"https://esm.sh/@supabase/supabase-js@2"},
  {name:"esm.run",  url:"https://esm.run/@supabase/supabase-js@2"},
  {name:"jspm.dev", url:"https://jspm.dev/@supabase/supabase-js@2"}
];
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
      import(cdn.url).then(function(mod){
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

  cfg:function(){ return !!(SUPABASE_URL && SUPABASE_ANON_KEY); },

  loadMe:function(){
    try{ this.me=JSON.parse(localStorage.getItem("mandje.me")||"null"); }catch(e){}
    if(!this.me) this.me={display_name:"", color:pickColor()};
  },
  saveMe:function(){ try{ localStorage.setItem("mandje.me", JSON.stringify(this.me)); }catch(e){} },
  myName:function(){ return (this.me && this.me.display_name) || "Ik"; },
  myEmoji:function(){ return (this.me && this.me.emoji) || ""; },

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
  /* Optioneel account beveiligen: koppelt een e-mail aan de huidige (anonieme) user.
     Zelfde user_id blijft → vrienden/lijsten overleven een nieuw toestel na inloggen. */
  secureWithEmail:async function(email){
    email=(email||"").trim(); if(!email || !this.ready) return false;
    var r=await this.sb.auth.updateUser({email:email});
    if(r.error){ toast(r.error.message||"Lukte niet — klopt het e-mailadres?"); return false; }
    toast("Check je mail om te bevestigen ✉️");
    return true;
  },
  memberById:function(id){ for(var i=0;i<this.members.length;i++) if(this.members[i].id===id) return this.members[i]; return null; },
  listById:function(id){ for(var i=0;i<this.lists.length;i++) if(this.lists[i].id===id) return this.lists[i]; return null; },
  activeList:function(){ return this.active ? this.listById(this.active) : null; },

  init:async function(){
    if(!this.cfg()) return;
    this.enabled=true; this.loadMe();
    Shortcuts.load();
    var params=new URLSearchParams(location.search);
    try{
      var sdk = (typeof window!=="undefined" && window.supabase) ? window.supabase : null;
      if(!sdk){ console.warn("Mandje: SDK niet ingebakken, val terug op CDN"); sdk = await loadSupabaseSDK(); }
      this.sb=sdk.createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
        {auth:{persistSession:true, autoRefreshToken:true, storageKey:"mandje.sb.auth"}});
      var s=await this.sb.auth.getSession();
      if(!s.data || !s.data.session){
        var r=await this.sb.auth.signInAnonymously();
        if(r.error){
          console.warn("Mandje: anonieme aanmelding faalde —", r.error);
          this.initError = "Niet ingelogd kunnen krijgen — check je internet";
          throw r.error;
        }
      }
      var u=await this.sb.auth.getUser(); this.userId=(u.data&&u.data.user)?u.data.user.id:null;
      this.ready=true;

      // Publieke stuur-pagina?
      if(params.get("send")){ openSendScreen(params.get("send")); return; }

      await this.loadLists();

      // Profiel + vrienden: alleen als er al een naam is (anders pas na ensureIdentity)
      if(this.me && this.me.display_name){ await this.syncProfile(); }
      await this.loadFriends();

      // Vriend-uitnodiging via ?friend=CODE
      if(params.get("friend")){
        var fcode = params.get("friend");
        try{ history.replaceState({}, "", location.pathname); }catch(e){}
        ensureIdentity(function(){
          Cloud.syncProfile().then(function(){ Cloud.addFriend(fcode); });
        });
      }

      if(params.get("join")){ await ensureIdentity(function(){ Cloud.joinList(params.get("join")); }); }
      else{
        var act=localStorage.getItem("mandje.activeList");
        if(act && act!=="local"){
          if(this.listById(act)){
            await this.open(act);
          } else {
            // Saved active-list bestaat niet meer (door owner verwijderd of jij gekickt) —
            // val terug op persoonlijk en laat 't weten zodat de gebruiker niet verward raakt.
            try{ localStorage.setItem("mandje.activeList","local"); }catch(e){}
            setTimeout(function(){ toast("Vorige lijst is niet meer beschikbaar"); }, 600);
          }
        }
      }
    }catch(e){
      console.warn("Cloud init faalde:", e);
      this.ready=false;
      if(!this.initError) this.initError = (e && e.message) || String(e);
    }
    renderListSwitch(); renderMembersRow(); renderShortcutsRow();
  },

  loadLists:async function(){
    var r=await this.sb.from("lists").select("*").order("created_at",{ascending:true});
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
    this.active=listId; try{ localStorage.setItem("mandje.activeList", listId); }catch(e){}
    await this.refreshItems(); await this.refreshMembers();
    this.subscribe(listId); this.startPresence();
    applyListHeader(); renderListSwitch(); renderMembersRow();
  },
  openLocal:function(){
    this.active=null; try{ localStorage.setItem("mandje.activeList","local"); }catch(e){}
    this.stop();
    load(); applyListHeader(); renderListSwitch(); renderMembersRow();
    renderLijst(); renderDueBanner();
  },
  stop:function(){
    if(this.channel){ try{ this.sb.removeChannel(this.channel); }catch(e){} this.channel=null; }
    if(this.presenceTimer){ clearInterval(this.presenceTimer); this.presenceTimer=null; }
    this.present=[]; if(typeof renderPresence==="function") renderPresence();
  },

  refreshItems:async function(){
    if(!this.active) return;
    var r=await this.sb.from("items").select("*").eq("list_id",this.active).order("created_at",{ascending:false});
    if(r.error){
      console.warn("refreshItems faalde:", r.error);
      // Voorkom dat items van een vorige lijst blijven plakken — leeg de view
      state.list=[];
      if(activeTab==="lijst"){ renderLijst(); renderDueBanner(); }
      toast("Items willen niet laden — probeer 't straks");
      return;
    }
    // Diff-merge per ID — voorkomt onnodige scroll-jank/animation-reset bij realtime updates
    var oldById = {};
    state.list.forEach(function(it){ oldById[it.id]=it; });
    state.list = (r.data||[]).map(function(it){
      var fresh = {
        id:it.id, name:it.name, category:it.category||classify(it.name), qty:it.qty||1,
        price:(it.price==null?null:Number(it.price)), note:it.note||"", done:!!it.done,
        assigned_to:it.assigned_to||null, added_by_name:it.added_by_name||"", addedAt:it.created_at
      };
      var old = oldById[it.id];
      // Hergebruik object-reference voor unchanged rows zodat itemRow-animaties niet opnieuw starten
      if(old && old.name===fresh.name && old.qty===fresh.qty && old.done===fresh.done && old.price===fresh.price && old.note===fresh.note && old.assigned_to===fresh.assigned_to){
        return old;
      }
      return fresh;
    });
    if(activeTab==="lijst"){ renderLijst(); renderDueBanner(); }
  },
  refreshMembers:async function(){
    if(!this.active) return;
    var r=await this.sb.from("members").select("*").eq("list_id",this.active).order("created_at",{ascending:true});
    if(r.error){
      console.warn("refreshMembers faalde:", r.error);
      this.members=[];
      renderMembersRow();
      return;
    }
    this.members=r.data||[];
    renderMembersRow();
  },

  present:[],  // wie kijkt nu live mee op deze lijst
  subscribe:function(listId){
    if(this.channel){ try{ this.sb.removeChannel(this.channel); }catch(e){} }
    this.present=[];
    var self=this;
    this.channel=this.sb.channel("list-"+listId, { config:{ presence:{ key: self.userId || ("u"+Math.random()) } } })
      .on("postgres_changes",{event:"*",schema:"public",table:"items",filter:"list_id=eq."+listId}, function(){ self.refreshItems(); })
      .on("postgres_changes",{event:"*",schema:"public",table:"members",filter:"list_id=eq."+listId}, function(){
        self.refreshMembers().then(function(){
          // Als jouw eigen member-rij weg is (gekickt of lijst gedeleted door owner met FK-cascade),
          // val dan netjes terug naar persoonlijk en zeg waarom.
          if(self.active === listId && (!self.members || !self.members.some(function(m){return m.user_id===self.userId;}))){
            toast("Deze lijst is niet meer beschikbaar");
            self.openLocal();
            self.loadLists();
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
        renderPresence(); renderMembersRow();
      })
      .subscribe(function(status){
        if(status === "SUBSCRIBED"){
          try{ self.channel.track({ user_id:self.userId, name:self.myName(), color:(self.me&&self.me.color)||"#2F7A4F", emoji:self.myEmoji() }); }catch(e){}
        } else if(status === "CHANNEL_ERROR" || status === "TIMED_OUT"){
          console.warn("Cloud realtime channel:", status);
        }
      });
  },
  startPresence:function(){
    var self=this;
    var beat=function(){ if(self.active&&self.userId) self.sb.from("members").update({last_seen:new Date().toISOString()}).eq("list_id",self.active).eq("user_id",self.userId).then(function(){},function(){}); };
    beat(); if(this.presenceTimer) clearInterval(this.presenceTimer);
    this.presenceTimer=setInterval(beat,60000);
  },

  /* ---- mutaties (optimistisch; realtime reconcilieert) ---- */
  addItem:function(name, price, addQty, opts){
    name=(name||"").trim(); if(!name||!this.active) return;
    addQty = Math.max(1, addQty||1);
    opts = opts || {};
    var k = norm(name);
    var existing = state.list.find(function(i){ return !i.done && norm(i.name)===k; });
    if(existing){
      existing.qty += addQty;
      if(price!=null) existing.price = price;
      renderLijst();
      if(!opts.silent) toast(name + " → " + existing.qty + "×");
      var fields = {qty: existing.qty};
      if(price!=null) fields.price = price;
      this.sb.from("items").update(fields).eq("id", existing.id).then(function(){},function(){});
      return;
    }
    var cat=(state.catalog[k]&&state.catalog[k].category)||classify(name);
    state.list.unshift({ id:"tmp_"+uid(), name:name, category:cat, qty:addQty, price:price, note:"", done:false, assigned_to:null, added_by_name:this.myName(), addedAt:nowISO() });
    renderLijst();
    if(!opts.silent && addQty>1) toast(name + " ×" + addQty);
    this.sb.from("items").insert({list_id:this.active, name:name, category:cat, qty:addQty, price:(price==null?null:price), added_by_name:this.myName()}).then(function(r){ if(r.error) toast("Toevoegen lukte niet"); },function(){});
  },
  toggle:function(id){
    var it=state.list.find(function(i){return i.id===id;}); if(!it) return;
    var nd=!it.done; it.done=nd; renderLijst();
    this.sb.from("items").update({done:nd, done_by_name:(nd?this.myName():null)}).eq("id",id).then(function(){},function(){});
  },
  qty:function(id,delta){
    var it=state.list.find(function(i){return i.id===id;}); if(!it) return;
    it.qty=Math.max(1,it.qty+delta); renderLijst();
    this.sb.from("items").update({qty:it.qty}).eq("id",id).then(function(){},function(){});
  },
  remove:function(id){
    state.list=state.list.filter(function(i){return i.id!==id;}); renderLijst();
    this.sb.from("items").delete().eq("id",id).then(function(){},function(){});
  },
  setFields:function(id, fields){
    var it=state.list.find(function(i){return i.id===id;});
    if(it){ if("qty"in fields)it.qty=fields.qty; if("price"in fields)it.price=fields.price; if("note"in fields)it.note=fields.note; if("category"in fields)it.category=fields.category; if("assigned_to"in fields)it.assigned_to=fields.assigned_to; renderLijst(); }
    this.sb.from("items").update(fields).eq("id",id).then(function(){},function(){});
  },
  finish:function(){
    var done=state.list.filter(function(i){return i.done;}); if(!done.length||!this.active) return;
    var ids=done.map(function(i){return i.id;});
    done.forEach(function(it){ recordPurchase(it.name, it.price); });
    if(typeof recordCoBuy==="function") recordCoBuy(done.map(function(it){return it.name;}));
    save();
    state.list=state.list.filter(function(i){return !i.done;}); renderLijst();
    this.sb.from("items").delete().in("id",ids).then(function(){},function(){});
    toast(done.length+(done.length===1?" gekocht":" gekocht")); vibrate(12); renderVaste();
    if(typeof celebrate==="function") celebrate();
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
    // FK ON DELETE SET NULL clearde assigned_to op zijn items, maar onze lokale state
    // ziet dat pas via realtime — forceer een refresh zodat de UI direct klopt.
    await this.refreshMembers();
    await this.refreshItems();
    await this.loadLists();
    toast("Lid verwijderd");
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
  if(!Cloud.enabled){ toast("Delen is niet aangezet"); return; }
  if(Cloud.initError){ toast(Cloud.initError); return; }
  toast("Even ophalen…");
  Cloud.waitReady(28000).then(function(ok){
    if(ok) cb();
    else if(Cloud.initError) toast(Cloud.initError);
    else toast("Geen verbinding — probeer 't straks");
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
      '<span class="sc-dot" style="background:'+s.color+'"></span>'+
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
      '<h3 style="display:flex;align-items:center;gap:10px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:'+s.color+';flex:0 0 auto"></span><span id="sc-title" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">Sturen naar '+escapeHtml(prettyListName(displayName))+'</span></h3>'+
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
    '<h3 style="display:flex;align-items:center;gap:10px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:'+s.color+';flex:0 0 auto"></span><span>'+escapeHtml(s.name)+'</span></h3>'+
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
function ownerColor(l){
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
    title.textContent="Boodschappen";
    title.classList.remove("has-dot");
    title.style.removeProperty("--list-dot");
    ctitle.textContent="Boodschappen";
    ctitle.classList.remove("has-dot");
    ctitle.style.removeProperty("--list-dot");
    if(shareTop) shareTop.classList.remove("show");
  }
}

function renderListSwitch(){
  var wrap=$("#list-switch-wrap"); if(!wrap) return;
  wrap.innerHTML="";
  if(activeTab!=="lijst") return;          // pill alleen op de lijst-tab
  if(!Cloud.enabled) return; // sharing niet geconfigureerd → niets tonen
  var l=Cloud.activeList();
  var name = Cloud.active ? (l?listDisplayName(l):"Gedeeld") : "Persoonlijk";
  // Gedeeld = gekleurde owner-stip; inbox = 📥; Persoonlijk = mandje-emoji
  var icoHtml;
  if(Cloud.active && isInboxList(l)){
    icoHtml = '<span class="ls-ico">📥</span>';
  } else if(Cloud.active){
    var col = ownerColor(l);
    icoHtml = '<span class="ls-ico-dot" style="background:'+col+'"></span>';
  } else {
    icoHtml = '<span class="ls-ico">🧺</span>';
  }
  var sub = Cloud.active ? "Gedeeld" : "Op dit toestel";
  var pill=el("button","list-switch",icoHtml+'<span class="ls-name">'+escapeHtml(name)+'</span><span class="ls-pill-sub">'+sub+'</span><svg class="ls-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>');
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
  var liveIds = {}; (Cloud.present||[]).forEach(function(p){ liveIds[p.user_id]=1; });
  var avs=others.map(function(m){
    var live = !!liveIds[m.user_id];
    var online = live || (m.last_seen && (now-new Date(m.last_seen).getTime() < 120000));
    return '<div class="av'+(online?'':' offline')+(live?' live':'')+'" title="'+escapeHtml(m.display_name)+(live?' · kijkt nu mee':'')+'" style="background:'+m.color+'">'+escapeHtml(initials(m.display_name).slice(0,1))+'</div>';
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
  return s;
}
function closeSheet2(){
  $("#scrim2").classList.remove("show"); $("#sheet2").classList.remove("show");
  if(!$("#sheet").classList.contains("show")) document.body.classList.remove("sheet-open");
}
$("#scrim2").addEventListener("click",closeSheet2);

function openSwitchSheet(){
  var html='<h3>Mijn lijsten</h3>';
  // Persoonlijk (lokaal, altijd bovenaan) — subtiele grijze ico zodat 't visueel verschilt van cloud-lijsten
  html+='<div class="ls-item'+(!Cloud.active?" active":"")+'" data-act="local">'+
    '<div class="lsi-ico" style="background:var(--surface-3);color:var(--ink-soft)">🧺</div>'+
    '<div style="flex:1;min-width:0"><div class="lsi-name">Persoonlijk</div>'+
    '<div class="lsi-sub">Alleen op dit toestel</div></div>'+
    (!Cloud.active?'<span class="lsi-check">✓</span>':'')+
  '</div>';
  // Cloud-lijsten — inbox eerst, rest daarna
  var sortedLists = Cloud.lists.slice().sort(function(a,b){ return (isInboxList(b)?1:0)-(isInboxList(a)?1:0); });
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
      ? '<div class="lsi-ico" style="background:var(--green-2)">📥</div>'
      : '<div class="lsi-ico" style="background:'+col+';color:#fff;font-size:13px;font-weight:700;letter-spacing:.02em">'+escapeHtml(initials(nm))+'</div>';
    html+='<div class="ls-item'+(Cloud.active===l.id?" active":"")+'" data-act="'+l.id+'">'+
      ico+
      '<div class="lsi-meta"><div class="lsi-name lsi-text">'+escapeHtml(nm)+'</div>'+
      '<div class="lsi-sub">'+escapeHtml(badge)+'</div></div>'+
      (Cloud.active===l.id?'<span class="lsi-check">✓</span>':'')+
    '</div>';
  });
  // Inline aanmaken — type+Enter = direct nieuwe lijst, geen extra sheet nodig
  html+='<div class="quick-create"><input class="txt" id="ls-new-name" type="text" placeholder="+ Nieuwe lijst… (Thuis, Weekend, Vakantie)" autocapitalize="words" autocomplete="off" enterkeyhint="done"></div>'+
    '<button class="mbtn" id="ls-join" style="width:100%;margin-top:8px">Code invoeren</button>';
  var s=openSheet2(html);
  s.querySelectorAll(".ls-item").forEach(function(it){
    it.addEventListener("click",function(){
      var act=it.dataset.act; closeSheet2();
      if(act==="local") Cloud.openLocal(); else Cloud.open(act).then(function(){ switchTab("lijst"); });
    });
  });
  var newInp = s.querySelector("#ls-new-name");
  if(newInp){
    newInp.addEventListener("keydown", function(e){
      if(e.key !== "Enter") return;
      var nm = (newInp.value||"").trim();
      if(!nm) return;
      newInp.value = "";
      closeSheet2();
      ensureIdentity(function(){ Cloud.createList(nm); });
    });
  }
  s.querySelector("#ls-join").addEventListener("click",function(){ closeSheet2(); ensureIdentity(function(){ promptJoin(); }); });
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
function promptJoin(code){
  var html='<h3>Lijst joinen</h3><div class="frow"><input class="txt" id="jn-code" placeholder="6-cijferige code" autocapitalize="characters" value="'+(code?escapeAttr(code):"")+'" style="text-transform:uppercase;letter-spacing:.1em;font-weight:700"></div><div class="sheet-actions"><button class="save" id="jn-go">Meedoen</button></div>';
  var s=openSheet2(html);
  setTimeout(function(){ var i=s.querySelector("#jn-code"); if(i) i.focus(); },250);
  s.querySelector("#jn-go").addEventListener("click",function(){ var c=(s.querySelector("#jn-code").value||"").trim(); if(!c){toast("Vul een code in");return;} closeSheet2(); Cloud.joinList(c); });
}

/* Avatar-render: emoji indien gekozen (zelf getypt), anders initialen-cirkel in de kleur.
   Eén helper voor leden, vrienden en de switcher. */
function avatarHtml(name, color, emoji, size){
  size = size || 34;
  var inner, bg;
  if(emoji){
    // In dark mode meer kleur-mix zodat de stip niet verdwijnt
    var dark = (typeof effectiveTheme==="function" && effectiveTheme()==="dark");
    inner = '<span class="emoji" style="font-size:'+Math.round(size*0.56)+'px">'+emoji+'</span>';
    bg = "color-mix(in srgb, "+color+" "+(dark?28:18)+"%, var(--surface))";
  } else {
    inner = '<span style="color:#fff;font-weight:700;font-size:'+Math.round(size*0.4)+'px;letter-spacing:.02em">'+escapeHtml(initials(name))+'</span>';
    bg = color;
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
      '<div class="code-box"><div class="cb-lbl">Code</div><div class="cb-code">'+codePretty+'</div></div>'+
      '<button class="mbtn primary" id="sh-invite">Stuur uitnodiging</button>'+
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
              '<button class="lsi-member-action add-friend-to-list" data-user="'+f.user_id+'" type="button" style="color:var(--green);font-weight:700">+ Toevoegen</button></div>';
          }).join("");
      })()+
      (activityHtml||'')+
      (isOwner ? '<div class="sheet-label" style="margin-top:22px"><span class="lbl-cap">Let op</span></div><button class="mbtn danger" id="sh-delete-list" type="button" style="width:100%;color:var(--red);border-color:color-mix(in srgb, var(--red) 25%, var(--line))">Lijst verwijderen</button><div class="hint" style="margin:4px 6px 0">Alle items en leden zijn dan weg voor altijd.</div>' : '');
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
      inp.addEventListener("keydown", function(e){ if(e.key==="Enter") doSave(); if(e.key==="Escape") openShareSheet(l.id); });
    });
  }
}

function copyText(txt,msg){
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){toast(msg);},function(){ prompt("Kopieer:",txt); }); }
  else prompt("Kopieer:",txt);
}
function shareNative(url, text, fallbackMsg){
  if(navigator.share){
    navigator.share({title:"Mandje", text:text, url:url}).then(function(){},function(){});
  } else {
    copyText(url, fallbackMsg);
  }
}

/* ---- publieke stuur-pagina (geen lidmaatschap) ---- */
function openSendScreen(token){
  var scr=$("#send-screen"); scr.classList.add("show");
  var added=[];
  function renderError(msg){
    scr.innerHTML =
      '<div class="ss-badge" style="background:var(--amber-2)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></div>'+
      '<div class="eyebrow">Niet beschikbaar</div>'+
      '<h1>Link werkt niet</h1>'+
      '<div class="ss-sub">'+escapeHtml(msg||"Deze stuur-link is verlopen of de lijst is verwijderd.")+'</div>'+
      '<button class="mbtn primary" id="ss-back" style="margin-top:26px">Terug naar Mandje</button>';
    var back = scr.querySelector("#ss-back");
    if(back) back.addEventListener("click", function(){
      try{ history.replaceState({}, "", location.pathname); }catch(e){}
      scr.classList.remove("show");
    });
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
        if(r.error){ toast("Versturen lukte niet"); return; }
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
