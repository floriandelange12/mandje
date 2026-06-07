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
      if(i>=SUPABASE_SDK_CDNS.length){ reject(lastErr || new Error("Alle CDN's faalden")); return; }
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

  cfg:function(){ return !!(SUPABASE_URL && SUPABASE_ANON_KEY); },

  loadMe:function(){
    try{ this.me=JSON.parse(localStorage.getItem("mandje.me")||"null"); }catch(e){}
    if(!this.me) this.me={display_name:"", color:pickColor()};
  },
  saveMe:function(){ try{ localStorage.setItem("mandje.me", JSON.stringify(this.me)); }catch(e){} },
  myName:function(){ return (this.me && this.me.display_name) || "Ik"; },
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
          this.initError = "Anonieme aanmelding: " + (r.error.message || "onbekend");
          throw r.error;
        }
      }
      var u=await this.sb.auth.getUser(); this.userId=(u.data&&u.data.user)?u.data.user.id:null;
      this.ready=true;

      // Publieke stuur-pagina?
      if(params.get("send")){ openSendScreen(params.get("send")); return; }

      await this.loadLists();
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
      toast("Lijsten laden mislukt — check verbinding");
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
  },

  refreshItems:async function(){
    if(!this.active) return;
    var r=await this.sb.from("items").select("*").eq("list_id",this.active).order("created_at",{ascending:false});
    if(r.error){
      console.warn("refreshItems faalde:", r.error);
      // Voorkom dat items van een vorige lijst blijven plakken — leeg de view
      state.list=[];
      if(activeTab==="lijst"){ renderLijst(); renderDueBanner(); }
      toast("Items laden mislukt — check verbinding");
      return;
    }
    state.list=(r.data||[]).map(function(it){ return {
      id:it.id, name:it.name, category:it.category||classify(it.name), qty:it.qty||1,
      price:(it.price==null?null:Number(it.price)), note:it.note||"", done:!!it.done,
      assigned_to:it.assigned_to||null, added_by_name:it.added_by_name||"", addedAt:it.created_at
    };});
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

  subscribe:function(listId){
    if(this.channel){ try{ this.sb.removeChannel(this.channel); }catch(e){} }
    var self=this;
    this.channel=this.sb.channel("list-"+listId)
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
      .subscribe(function(status){
        if(status === "CHANNEL_ERROR" || status === "TIMED_OUT"){
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
    this.sb.from("items").insert({list_id:this.active, name:name, category:cat, qty:addQty, price:(price==null?null:price), added_by_name:this.myName()}).then(function(r){ if(r.error) toast("Toevoegen mislukt"); },function(){});
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
  },

  /* ---- lijstbeheer ---- */
  createList:async function(name){
    if(!this.ready){
      console.warn("Mandje: createList terwijl Cloud niet ready —", this.initError);
      toast("Cloud nog niet klaar: " + (this.initError || "onbekend"));
      return null;
    }
    var r=await this.sb.rpc("create_list",{p_name:name||"Boodschappen", p_display_name:this.myName(), p_color:this.me.color});
    if(r.error){
      console.warn("Mandje: create_list RPC faalde —", r.error);
      toast("Aanmaken mislukt: " + (r.error.message || "onbekend"));
      return null;
    }
    await this.loadLists(); await this.open(r.data.id); switchTab("lijst");
    return r.data;
  },
  joinList:async function(code){
    var r=await this.sb.rpc("join_list",{p_code:(code||"").trim(), p_display_name:this.myName(), p_color:this.me.color});
    if(r.error){ toast(r.error.message||"Join mislukt"); return null; }
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
    if(r.error){ toast("Verwijderen mislukt: " + (r.error.message||"")); return false; }
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
    if(r.error){ toast("Hernoemen mislukt: "+(r.error.message||"")); return null; }
    await this.loadLists();
    if(this.active===listId){ applyListHeader(); }
    renderListSwitch();
    toast("Lijst hernoemd");
    return r.data;
  },
  kickMember:async function(listId, userId){
    var r=await this.sb.from("members").delete().eq("list_id",listId).eq("user_id",userId);
    if(r.error){ toast("Verwijderen mislukt: "+(r.error.message||"")); return false; }
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
  if(!Cloud.enabled){ toast("Cloud niet geconfigureerd"); return; }
  if(Cloud.initError){ toast("Cloud: " + Cloud.initError); return; }
  toast("Verbinding maken…");
  Cloud.waitReady(28000).then(function(ok){
    if(ok) cb();
    else if(Cloud.initError) toast("Cloud: " + Cloud.initError);
    else toast("Verbinding lukt niet — check je internet of probeer later");
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
  var sorted=Shortcuts.items.slice().sort(function(a,b){
    return new Date(b.lastUsed||0).getTime() - new Date(a.lastUsed||0).getTime();
  });
  var inner='<div class="sc-scroll">';
  sorted.forEach(function(s){
    inner+='<button class="sc-chip" data-id="'+s.id+'">'+
      '<span class="sc-dot" style="background:'+s.color+'"></span>'+
      '<span class="sc-name">'+escapeHtml(prettyListName(s.name))+'</span>'+
    '</button>';
  });
  if(sorted.length===0){
    inner+='<button class="sc-chip sc-action sc-action-wide" data-actions="1"><span class="sc-act-ico">+</span><span class="sc-act-lbl">Snelkoppeling</span></button>';
  } else {
    inner+='<button class="sc-chip sc-action" data-actions="1" aria-label="Snelkoppeling-acties">+</button>';
  }
  inner+='</div>';
  wrap.innerHTML=inner;
  wrap.querySelectorAll(".sc-chip").forEach(function(b){
    if(b.dataset.actions){
      b.addEventListener("click", function(){ openShareActionSheet(); });
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
  var shareSvg='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>';
  var html='<div class="grip"></div>'+
    '<h3>Snelkoppelingen</h3>'+
    '<button class="sa-row" id="sa-add">'+
      '<span class="sa-ico"><span style="font-size:21px;font-weight:800;line-height:1">+</span></span>'+
      '<span class="sa-meta"><span class="sa-ttl">Naar iemand sturen</span><span class="sa-sub">Plak iemands stuur-link en sla op als chip.</span></span>'+
      '<span class="sa-chev">›</span>'+
    '</button>'+
    '<button class="sa-row" id="sa-receive">'+
      '<span class="sa-ico">'+shareSvg+'</span>'+
      '<span class="sa-meta"><span class="sa-ttl">Laat iemand sturen</span><span class="sa-sub">Deel jouw stuur-link via WhatsApp.</span></span>'+
      '<span class="sa-chev">›</span>'+
    '</button>';
  var sh=openSheet2(html);
  sh.querySelector("#sa-add").addEventListener("click", function(){ closeSheet2(); openAddShortcutSheet(); });
  sh.querySelector("#sa-receive").addEventListener("click", function(){ closeSheet2(); openReceiveFlow(); });
}

function openSendSheet(scId){
  var s=Shortcuts.byId(scId); if(!s) return;
  var sent=[];
  function renderSheet(displayName){
    return '<div class="grip"></div>'+
      '<h3 style="display:flex;align-items:center;gap:10px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:'+s.color+';flex:0 0 auto"></span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">Sturen naar '+escapeHtml(prettyListName(displayName))+'</span></h3>'+
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
        },function(){ toast("Versturen mislukt"); });
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
        sh.innerHTML = renderSheet(s.name);
        // Hervind sent-chips na re-render
        var sentWrap = sh.querySelector("#sc-sent");
        if(sentWrap) sentWrap.innerHTML = sent.map(function(n){return '<span class="chip"><span class="emoji">✓</span>'+escapeHtml(n)+'</span>';}).join("");
        wire();
      }
    },function(){ /* netwerkfout — laat lokale naam staan, geen toast */ });
  });
}

function openAddShortcutSheet(prefilledToken){
  var html='<div class="grip"></div>'+
    '<h3>Snelkoppeling toevoegen</h3>'+
    '<div class="hint" style="margin:0 6px 14px;line-height:1.5">Vraag de ander om in <b>hun Mandje</b> op de <b>Delen-knop</b> te tikken en daarna op <b>"Deel \'stuur items\'-link"</b>. Ze sturen \'m bv. via WhatsApp naar jou — plak die link hier.</div>'+
    '<div class="frow"><input class="txt" id="sc-tokin" placeholder="Plak stuur-link" value="'+escapeAttr(prefilledToken||"")+'" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" inputmode="url"></div>'+
    '<div class="sheet-actions"><button class="save" id="sc-save-add">Opslaan</button></div>';
  var sh=openSheet2(html);
  setTimeout(function(){ var t=sh.querySelector("#sc-tokin"); if(t) t.focus(); }, 280);
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
    var nm=prettyListName(l?l.name:"Gedeeld");
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
  var ico = Cloud.active ? "👥" : "🧺";
  var name = Cloud.active ? prettyListName(l?l.name:"Gedeeld") : "Persoonlijk";
  var pill=el("button","list-switch",'<span class="ls-ico">'+ico+'</span><span class="ls-name">'+escapeHtml(name)+'</span><svg class="ls-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>');
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
  var avs=others.map(function(m){
    var online = m.last_seen && (now-new Date(m.last_seen).getTime() < 120000);
    return '<div class="av" title="'+escapeHtml(m.display_name)+'" style="background:'+m.color+';'+(online?'':'opacity:.55')+'">'+escapeHtml(initials(m.display_name).slice(0,1))+'</div>';
  }).join("");
  var avBlock = others.length ? '<div class="avatars" aria-label="Leden">'+avs+'</div>' : '';
  row.innerHTML = avBlock +
    '<button class="share-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>Delen</button>';
  var avEl=row.querySelector(".avatars");
  if(avEl) avEl.addEventListener("click",function(){ if(Cloud.active) openShareSheet(Cloud.active); });
  row.querySelector(".share-btn").addEventListener("click",function(){ if(Cloud.active) openShareSheet(Cloud.active); });
}

/* --- tweede sheet helpers --- */
function openSheet2(html){ var s=$("#sheet2"); s.innerHTML='<div class="grip"></div>'+html; $("#scrim2").classList.add("show"); s.classList.add("show"); return s; }
function closeSheet2(){ $("#scrim2").classList.remove("show"); $("#sheet2").classList.remove("show"); }
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
  // Cloud-lijsten
  Cloud.lists.forEach(function(l){
    var col=ownerColor(l);
    var nm=prettyListName(l.name);
    var cnt=l.member_count||1;
    var iOwn=l.owner_user_id===Cloud.userId;
    var badge;
    if(cnt<=1) badge=iOwn?'Alleen jij · niet gedeeld':'Alleen jij';
    else if(iOwn) badge='Jij + '+(cnt-1)+' ander'+(cnt-1>1?'en':'');
    else badge=cnt+' leden';
    html+='<div class="ls-item'+(Cloud.active===l.id?" active":"")+'" data-act="'+l.id+'">'+
      '<div class="lsi-ico" style="background:'+col+';color:#fff;font-size:13px;font-weight:700;letter-spacing:.02em">'+escapeHtml(initials(nm))+'</div>'+
      '<div style="flex:1;min-width:0"><div class="lsi-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(nm)+'</div>'+
      '<div class="lsi-sub">'+escapeHtml(badge)+'</div></div>'+
      (Cloud.active===l.id?'<span class="lsi-check">✓</span>':'')+
    '</div>';
  });
  // Acties: prominent + Nieuwe lijst, daaronder code-invoeren
  html+='<div class="sheet-actions" style="flex-direction:column;gap:10px;margin-top:14px">'+
    '<button class="save" id="ls-new" style="display:flex;align-items:center;justify-content:center;gap:8px"><span style="font-size:20px;font-weight:800;line-height:1">+</span><span>Nieuwe lijst</span></button>'+
    '<button class="mbtn" id="ls-join" style="width:100%">Lijst-code invoeren</button>'+
  '</div>';
  var s=openSheet2(html);
  s.querySelectorAll(".ls-item").forEach(function(it){
    it.addEventListener("click",function(){
      var act=it.dataset.act; closeSheet2();
      if(act==="local") Cloud.openLocal(); else Cloud.open(act).then(function(){ switchTab("lijst"); });
    });
  });
  s.querySelector("#ls-new").addEventListener("click",function(){ closeSheet2(); ensureIdentity(function(){ promptNewList(); }); });
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

/* vraag eenmalig naam + kleur; daarna callback */
function ensureIdentity(cb){
  if(Cloud.me && Cloud.me.display_name){ cb(); return; }
  var color=Cloud.me ? Cloud.me.color : pickColor();
  var dots=MEMBER_COLORS.map(function(c){ return '<button class="cadchip clr" data-c="'+c+'" style="width:34px;height:34px;border-radius:50%;padding:0;background:'+c+';'+(c===color?'outline:3px solid var(--ink);outline-offset:2px':'border-color:transparent')+'"></button>'; }).join("");
  var html='<h3>Hoe heet je?</h3><div class="frow"><input class="txt" id="id-name" placeholder="Je naam" autocapitalize="words"></div>'+
    '<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);margin:6px 6px 10px">Kleur</div>'+
    '<div class="cadrow" id="id-colors" style="gap:10px">'+dots+'</div>'+
    '<div class="sheet-actions"><button class="save" id="id-go">Doorgaan</button></div>';
  var s=openSheet2(html);
  setTimeout(function(){ var i=s.querySelector("#id-name"); if(i) i.focus(); },250);
  var chosen=color;
  s.querySelectorAll("#id-colors .clr").forEach(function(b){
    b.addEventListener("click",function(){ chosen=b.dataset.c; s.querySelectorAll("#id-colors .clr").forEach(function(x){x.style.outline="";}); b.style.outline="3px solid var(--ink)"; b.style.outlineOffset="2px"; });
  });
  s.querySelector("#id-go").addEventListener("click",function(){
    var nm=(s.querySelector("#id-name").value||"").trim(); if(!nm){ toast("Vul je naam in"); return; }
    Cloud.me={display_name:nm, color:chosen}; Cloud.saveMe(); closeSheet2(); cb();
  });
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
  var prettyName = prettyListName(l.name);

  function memberRowHtml(m){
    var isYou = (m.user_id === Cloud.userId);
    var action = '';
    if(isYou){
      action = '<button class="lsi-member-action leave" type="button">Verlaten</button>';
    } else if(isOwner){
      action = '<button class="lsi-member-action kick" data-user="'+m.user_id+'" data-name="'+escapeAttr(m.display_name)+'" type="button">Verwijder</button>';
    }
    return '<div class="ls-item">'+
      '<div class="av" style="width:34px;height:34px;background:'+m.color+';color:#fff;border:0">'+escapeHtml(initials(m.display_name))+'</div>'+
      '<div class="lsi-name" style="flex:1;min-width:0;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(m.display_name)+(isYou?' <span style="color:var(--ink-faint);font-weight:500">(jij)</span>':'')+'</div>'+
      action+
    '</div>';
  }

  function buildHtml(activityHtml){
    var memberHtml = Cloud.members.map(memberRowHtml).join("");
    var titleHtml = '<h3 id="sh-title-row" style="display:flex;align-items:center;gap:10px"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:'+dotCol+';flex:0 0 auto"></span><span id="sh-title-name" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(prettyName)+'</span>'+
      (isOwner?'<button id="sh-rename" type="button" aria-label="Hernoem" style="border:0;background:transparent;color:var(--ink-soft);padding:6px;border-radius:8px"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>':'')+
    '</h3>';
    return titleHtml +
      '<div class="code-box"><div class="cb-lbl">Join-code</div><div class="cb-code">'+l.join_code+'</div></div>'+
      '<button class="mbtn" id="sh-invite" style="background:var(--green);color:var(--on-green);border-color:transparent">Deel uitnodiging</button>'+
      '<button class="mbtn" id="sh-link">Kopieer uitnodig-link</button>'+
      '<button class="mbtn" id="sh-send">Deel "stuur items"-link</button>'+
      '<div class="hint" style="margin:2px 6px 14px;line-height:1.5">De <b>uitnodig-link</b> laat iemand meedoen en alles zien. De <b>stuur-link</b> geeft iemand alleen een drop-pagina om dingen aan jou te sturen — zonder app, zonder mee te kijken.</div>'+
      (memberHtml?('<div class="sheet-label"><span class="lbl-cap">Leden ('+Cloud.members.length+')</span></div>'+memberHtml):'')+
      (activityHtml||'')+
      (isOwner ? '<div class="sheet-label" style="margin-top:22px"><span class="lbl-cap">Gevaren-zone</span></div><button class="mbtn danger" id="sh-delete-list" type="button" style="width:100%;color:var(--red);border-color:color-mix(in srgb, var(--red) 25%, var(--line))">Lijst verwijderen</button><div class="hint" style="margin:4px 6px 0">Items en leden worden definitief verwijderd. Niet terug te halen.</div>' : '');
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
      '<button class="mbtn" id="ss-back" style="margin-top:26px;background:var(--green);color:var(--on-green);border-color:transparent">Terug naar Mandje</button>';
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
      '<button class="mbtn" id="ss-remember" style="margin-top:22px;'+(alreadySaved?'opacity:.55;pointer-events:none;':'background:var(--green);color:var(--on-green);border-color:transparent;')+'">'+(alreadySaved?'✓ Al een snelkoppeling':'Onthoud deze lijst als snelkoppeling')+'</button>'+
      '<div class="hint" style="margin:4px 6px 0">Daarna kun je vanaf je Mandje-hoofdscherm in 1 tap items hierheen sturen.</div>';
    var nameI=scr.querySelector("#ss-name");
    function send(){
      var nm=(nameI.value||"").trim(); if(!nm) return;
      var from=(scr.querySelector("#ss-from").value||"").trim();
      Cloud.sb.rpc("add_item_via_token",{p_token:token,p_name:nm,p_qty:1,p_note:"",p_from:from}).then(function(r){
        if(r.error){ toast("Versturen mislukt"); return; }
        added.unshift(nm); nameI.value="";
        scr.querySelector("#ss-chips").innerHTML=added.map(function(n){return '<span class="chip"><span class="emoji">✓</span>'+escapeHtml(n)+'</span>';}).join("");
        nameI.focus();
      },function(){ toast("Versturen mislukt"); });
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
