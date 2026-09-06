/* Mandje service worker — instant laden + offline-installeerbaar.
   De hele app zit in één index.html (alles inlined), dus de "app-shell" = dat ene bestand.
   Strategie: stale-while-revalidate voor de shell (direct uit cache tonen, op de achtergrond
   verversen voor de volgende keer). Supabase (REST + realtime-WebSocket) en alle cross-origin
   verzoeken gaan ALTIJD rechtstreeks naar het netwerk — nooit cachen.
   __BUILD__ wordt door build.js vervangen door de MANDJE_CONFIG.BUILD-waarde. */
var CACHE = "mandje-__BUILD__";
var SHELL = "./index.html";
// Precache: de shell, het manifest en de kleine iconen (push-icoon + badge). App-navigaties worden in
// de fetch-handler op SHELL gemapt, dus "./" apart cachen zou het 600 KB-document twee keer opslaan.
var PRECACHE = ["./index.html", "./manifest.webmanifest", "./icon-192.png", "./badge-96.png", "./supabase.js"];

self.addEventListener("install", function(e){
  // De shell is verplicht: mislukt die, dan faalt de install en blijft de oude SW + cache bedienen.
  // Het icoon is optioneel (mag de precache niet blokkeren).
  // cache:"reload" omzeilt de HTTP-cache: anders kan een nieuwe SW de shell van een oudere build inpakken
  // als /index.html korter dan tien minuten geleden al was opgehaald.
  var fresh = function(u){ return new Request(u, {cache:"reload"}); };
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.add(fresh(SHELL)).then(function(){
      return Promise.all(PRECACHE.filter(function(u){ return u!==SHELL; }).map(function(u){ return c.add(fresh(u)).catch(function(){}); }));
    });
  }));
});

self.addEventListener("activate", function(e){
  e.waitUntil((async function(){
    var keys = await caches.keys();
    await Promise.all(keys.filter(function(k){ return k.indexOf("mandje-")===0 && k!==CACHE; })
                          .map(function(k){ return caches.delete(k); }));
    await self.clients.claim();
  })());
});

// De pagina vraagt om direct te activeren wanneer de gebruiker op "Ververs" tikt.
self.addEventListener("message", function(e){ if(e.data === "SKIP_WAITING") self.skipWaiting(); });

// Web push (Fase 5) — alleen actief zodra er een backend pusht; anders dormant.
self.addEventListener("push", function(e){
  var data = {};
  try{ data = e.data ? e.data.json() : {}; }catch(x){ try{ data = { body: e.data.text() }; }catch(y){} }
  var title = data.title || "Mandje";
  var opts = {
    body: data.body || "Tijd om je vaste boodschappen te checken?",
    icon: data.icon || "./icon-192.png",
    badge: data.badge || "./badge-96.png",
    tag: data.tag || "mandje-due",
    renotify: !!data.renotify,
    data: { url: data.url || "./" }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
/* Abonnement door de browser vernieuwd: open vensters opnieuw laten abonneren (de app herstelt anders bij de volgende start) */
self.addEventListener("pushsubscriptionchange", function(e){
  e.waitUntil(self.clients.matchAll({type:"window", includeUncontrolled:true}).then(function(cs){
    cs.forEach(function(c){ try{ c.postMessage({type:"PUSH_RESUBSCRIBE"}); }catch(x){} });
  }).catch(function(){}));
});
self.addEventListener("notificationclick", function(e){
  e.notification.close();
  // Doel-url uit de payload, opgelost tegen de SW-scope (= /mandje/ op GitHub Pages).
  var target = (e.notification.data && e.notification.data.url) || "./";
  var url;
  try{ url = new URL(target, self.registration.scope).href; }catch(x){ url = self.registration.scope; }
  e.waitUntil(self.clients.matchAll({type:"window", includeUncontrolled:true}).then(function(cs){
    var client = null, scope = self.registration.scope;
    for(var i=0;i<cs.length;i++){
      if(cs[i].url.indexOf(scope) === 0 && "focus" in cs[i]){ client = cs[i]; break; }   // alleen vensters binnen /mandje/
    }
    if(client){
      // Alleen navigeren bij een expliciete doel-url naar een ánder pad (nooit een draaiende app herladen voor de root)
      var explicit = !!(e.notification.data && e.notification.data.url);
      var samePath = true; try{ samePath = new URL(client.url).pathname === new URL(url).pathname; }catch(x){}
      var hasQuery = false; try{ hasQuery = !!new URL(url).search; }catch(x){}
      if(explicit && (!samePath || hasQuery) && "navigate" in client){
        return client.navigate(url).then(function(c){ return c ? c.focus() : client.focus(); })
                                   .catch(function(){ return client.focus(); });
      }
      return client.focus();
    }
    if(self.clients.openWindow) return self.clients.openWindow(url);
  }));
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;                         // mutaties → netwerk
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;          // Supabase / CDN / cross-origin → netwerk
  if(url.pathname.indexOf("/sw.js") !== -1) return;        // SW-script niet zelf cachen
  if(req.mode === "navigate"){
    // Alleen de app zelf (./ of ./index.html) krijgt de shell. Andere pagina's binnen de scope
    // (tools/…, manifest-preview) gaan gewoon naar het netwerk — anders is elke URL "de app".
    var p = url.pathname;
    if(p.slice(-1) === "/" || p.slice(-11) === "/index.html") e.respondWith(swr(SHELL, req));
    return;
  }
  e.respondWith(swr(req, req));
});

/* stale-while-revalidate: cache → direct terug, en op de achtergrond bijwerken.
   Netwerkfout zonder cache: navigaties krijgen de shell (offline-app), andere verzoeken
   (icoon e.d.) krijgen een echte netwerkfout — nooit 600 KB HTML als "afbeelding". */
function swr(cacheKey, req){
  var isNav = req.mode === "navigate";
  return caches.open(CACHE).then(function(cache){
    return cache.match(cacheKey, {ignoreSearch:true}).then(function(cached){
      var net = fetch(req).then(function(res){
        if(res && res.ok && res.type === "basic"){ cache.put(cacheKey, res.clone()); }
        return res;
      }).catch(function(){ return null; });
      return cached || net.then(function(r){
        if(r) return r;
        if(isNav) return cache.match(SHELL).then(function(s){ return s || Response.error(); });
        return Response.error();
      });
    });
  });
}
