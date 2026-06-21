/* Mandje service worker — instant laden + offline-installeerbaar.
   De hele app zit in één index.html (alles inlined), dus de "app-shell" = dat ene bestand.
   Strategie: stale-while-revalidate voor de shell (direct uit cache tonen, op de achtergrond
   verversen voor de volgende keer). Supabase (REST + realtime-WebSocket) en alle cross-origin
   verzoeken gaan ALTIJD rechtstreeks naar het netwerk — nooit cachen.
   2026-06-21.3 wordt door build.js vervangen door de MANDJE_CONFIG.BUILD-waarde. */
var CACHE = "mandje-2026-06-21.3";
var SHELL = "./index.html";

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(["./", SHELL]); }).catch(function(){}));
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

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;                         // mutaties → netwerk
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;          // Supabase / CDN / cross-origin → netwerk
  if(url.pathname.indexOf("/sw.js") !== -1) return;        // SW-script niet zelf cachen
  if(req.mode === "navigate"){ e.respondWith(swr(SHELL, req)); return; }
  e.respondWith(swr(req, req));
});

/* stale-while-revalidate: cache → direct terug, en op de achtergrond bijwerken. */
function swr(cacheKey, req){
  return caches.open(CACHE).then(function(cache){
    return cache.match(cacheKey, {ignoreSearch:true}).then(function(cached){
      var net = fetch(req).then(function(res){
        if(res && res.ok && res.type === "basic"){ cache.put(cacheKey, res.clone()); }
        return res;
      }).catch(function(){ return null; });
      return cached || net.then(function(r){ return r || (cacheKey !== SHELL ? cache.match(SHELL) : undefined); });
    });
  });
}
