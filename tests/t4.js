/* t4 — bundel-hygiëne. Controles op de GEBOUWDE bestanden (index.html, sw.js, manifest.webmanifest, iconen);
   draait zonder jsdom. Groottes worden altijd gerapporteerd, ook als de budgetten gehaald worden. */
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const root = path.join(__dirname, "..");

let pass = 0, fail = 0;
function ok(name, cond){ if(cond){ pass++; console.log("  ✓ "+name); } else { fail++; console.log("  ✗ FAIL: "+name); } }
const kb = n => (n/1024).toFixed(1)+" KB";
const lineOf = (s, i) => s.slice(0, i).split("\n").length;

// Zelfde marker als in build.js: CP1252-lead-teken gevolgd door een continuation-teken (als \u-escapes).
const CP1252_SPECIALS = "\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178";
const MOJIBAKE = new RegExp("[\u00C2\u00C3\u00E2\u00F0][\u0080-\u00BF" + CP1252_SPECIALS + "]");

const GZIP_MAX = +(process.env.MANDJE_GZIP_MAX || 170*1024);   // budget: gzip van index.html (override: MANDJE_GZIP_MAX)
const HEAD_MAX = +(process.env.MANDJE_HEAD_MAX || 130*1024);   // budget: bytes vóór <body (override: MANDJE_HEAD_MAX)
const PNG_SIG  = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);

console.log("\nt4 — bundel-hygiëne (gebouwde bestanden)");

const htmlPath = path.join(root,"index.html"), swPath = path.join(root,"sw.js");
ok("index.html bestaat in de root", fs.existsSync(htmlPath));
ok("sw.js bestaat in de root", fs.existsSync(swPath));
const htmlBuf = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath) : Buffer.alloc(0);
const html = htmlBuf.toString("utf8");
const sw = fs.existsSync(swPath) ? fs.readFileSync(swPath,"utf8") : "";

// 1. encoding: geen BOM, geen mojibake
ok("index.html: geen BOM", html.length>0 && html.charCodeAt(0)!==0xFEFF);
ok("sw.js: geen BOM", sw.length>0 && sw.charCodeAt(0)!==0xFEFF);
const mh = MOJIBAKE.exec(html), ms = MOJIBAKE.exec(sw);
ok("index.html: geen mojibake"+(mh?" (gevonden "+JSON.stringify(mh[0])+" op regel "+lineOf(html,mh.index)+")":""), !mh);
ok("sw.js: geen mojibake"+(ms?" (gevonden "+JSON.stringify(ms[0])+" op regel "+lineOf(sw,ms.index)+")":""), !ms);

// 2. BUILD: gevuld in MANDJE_CONFIG, en sw.js draagt exact dezelfde cache-naam
const bm = html.match(/BUILD:\s*"([^"]*)"/);
const build = bm ? bm[1] : "";
ok("index.html: MANDJE_CONFIG.BUILD gevuld ("+(build||"leeg")+")", !!build && build!=="__BUILD__");
ok("sw.js: cache-naam \"mandje-"+build+"\" (zelfde BUILD als index.html)", !!build && sw.indexOf('"mandje-'+build+'"')!==-1);
ok("sw.js: geen __BUILD__-placeholder meer", sw.length>0 && sw.indexOf("__BUILD__")===-1);

// 3. document-basics
ok('index.html: <meta charset="UTF-8">', html.indexOf('<meta charset="UTF-8">')!==-1);
ok('index.html: <html lang="nl">', /<html\b[^>]*\slang="nl"/.test(html));

// 4. grootte-budgetten (regressiebewaking) — waarden altijd rapporteren
const gz = zlib.gzipSync(htmlBuf).length;
const bodyIdx = htmlBuf.indexOf("<body");
console.log("  · index.html: "+kb(htmlBuf.length)+" ruw · "+kb(gz)+" gzip (budget "+kb(GZIP_MAX)+") · "+kb(Math.max(bodyIdx,0))+" vóór <body (budget "+kb(HEAD_MAX)+")");
ok("index.html: gzip ≤ "+kb(GZIP_MAX)+" (gemeten "+kb(gz)+")", gz<=GZIP_MAX);
ok("index.html: bytes vóór <body ≤ "+kb(HEAD_MAX)+" (gemeten "+kb(Math.max(bodyIdx,0))+")", bodyIdx>=0 && bodyIdx<=HEAD_MAX);

// 5. PWA-bestanden: iconen zijn echte PNG's, manifest is geldig en verwijst naar bestaande bestanden, <head> zonder base64-iconen
const ICON_FILES = ["icon-180.png","icon-192.png","icon-512.png","icon-512-maskable.png","badge-96.png"];
ICON_FILES.forEach(function(f){
  const p = path.join(root, f);
  const buf = fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0);
  ok(f+": aanwezig en een echte PNG ("+kb(buf.length)+")", buf.length>=8 && buf.subarray(0,8).equals(PNG_SIG));
});
const mfPath = path.join(root, "manifest.webmanifest");
let mf = null; try{ mf = JSON.parse(fs.readFileSync(mfPath, "utf8")); }catch(e){}
ok("manifest.webmanifest: aanwezig en geldige JSON", !!mf);
ok("manifest: id/scope \"./\" en relatieve start_url", !!mf && mf.id==="./" && mf.scope==="./" && (mf.start_url||"").indexOf("./")===0);
ok("manifest: iconen 192 any, 512 any, 512 maskable → bestaande bestanden", !!mf && Array.isArray(mf.icons)
   && ["192x192","512x512"].every(function(sz){ return mf.icons.some(function(i){ return i.sizes===sz && i.purpose==="any"; }); })
   && mf.icons.some(function(i){ return i.purpose==="maskable"; })
   && mf.icons.every(function(i){ return fs.existsSync(path.join(root, i.src)); }));
ok("manifest: shortcuts (≥2) en share_target (GET)", !!mf && Array.isArray(mf.shortcuts) && mf.shortcuts.length>=2 && !!mf.share_target && mf.share_target.method==="GET");
ok("index.html: <link rel=\"manifest\" href=\"./manifest.webmanifest\"> (geen data-URI)", html.indexOf('<link rel="manifest" href="./manifest.webmanifest">')!==-1 && html.indexOf("data:application/manifest+json")===-1);
ok("index.html: geen base64-iconen meer vóór <body", html.slice(0, Math.max(bodyIdx,0)).indexOf("data:image/png;base64")===-1);
const sdkPath = path.join(root, "supabase.js");
ok("supabase.js: los root-bestand (≥ 100 KB), niet meer inline in index.html", fs.existsSync(sdkPath) && fs.statSync(sdkPath).size > 100*1024 && htmlBuf.length < 520*1024);

// 5b. design-systeem: geen losse pixelmaten/legacy-tokens meer in de CSS (tokens zijn de enige bron)
{
  const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ""])[1];
  const fsPx = (css.match(/font-size:\s*[0-9.]+px/g) || []).length;
  const brPx = (css.match(/border-radius:\s*[0-9.]+px/g) || []).length;   // 1 toegestaan: confetti (2px)
  const legacy = (html.match(/var\(--(green|amber|red|surface|shadow|shadow-sm|shadow-lg|ease|r-card|h1-size|h2-size)\)/g) || []).length;
  ok("css: geen font-size in px (gevonden "+fsPx+")", fsPx===0);
  ok("css: border-radius in px hooguit 1× (confetti) (gevonden "+brPx+")", brPx<=1);
  ok("bundel: geen legacy-tokens (--green/--amber/--red/--surface/--shadow/--ease/--r-card/--h1-size) (gevonden "+legacy+")", legacy===0);
  ok("bundel: geen #34c759 (oud iOS-groen)", !/#34c759/i.test(html));
}

// 6. sw.js precache-lijst: ./index.html erin, "./" niet als losse entry
const pm = sw.match(/PRECACHE\s*=\s*(\[[^\]]*\])/) || sw.match(/addAll\(\s*(\[[^\]]*\])/);
let precache = null;
try{ precache = pm ? JSON.parse(pm[1]) : null; }catch(e){ precache = null; }
ok("sw.js: precache-lijst gevonden en leesbaar"+(precache?" ("+precache.join(", ")+")":""), Array.isArray(precache));
ok("sw.js: precache bevat ./index.html", !!precache && precache.indexOf("./index.html")!==-1);
ok("sw.js: precache bevat ./manifest.webmanifest, ./icon-192.png, ./badge-96.png en ./supabase.js", !!precache && ["./manifest.webmanifest","./icon-192.png","./badge-96.png","./supabase.js"].every(function(u){ return precache.indexOf(u)!==-1; }));
ok("sw.js: precache bevat geen 512-iconen (te groot voor de installatie-download)", !!precache && !precache.some(function(u){ return /512/.test(u); }));
ok("sw.js: push-icoon en badge wijzen naar icon-192.png / badge-96.png", sw.indexOf("./icon-192.png")!==-1 && sw.indexOf("./badge-96.png")!==-1);
ok("sw.js: alleen app-navigaties (/ of /index.html) krijgen de shell", sw.indexOf('p.slice(-11) === "/index.html"')!==-1 && sw.indexOf('p.slice(-1) === "/"')!==-1);
ok("sw.js: precache bevat GEEN losse \"./\"", !!precache && precache.indexOf("./")===-1);

console.log("\nt4: "+pass+" geslaagd, "+fail+" gefaald");
process.exit(fail ? 1 : 0);
