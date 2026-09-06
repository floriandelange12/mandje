/* t4 — bundel-hygiëne. Controles op de GEBOUWDE bestanden (index.html, sw.js, icon-512.png);
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

const GZIP_MAX = 230*1024;   // budget: gzip van index.html
const HEAD_MAX = 180*1024;   // budget: bytes vóór <body (CSS + config + inline-assets in <head>)
const PNG_SIG  = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);

console.log("\nt4 — bundel-hygiëne (gebouwde bestanden)");

const htmlPath = path.join(root,"index.html"), swPath = path.join(root,"sw.js"), iconPath = path.join(root,"icon-512.png");
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

// 5. icon-512.png: aanwezig en een echte PNG
ok("icon-512.png bestaat in de root", fs.existsSync(iconPath));
const icon = fs.existsSync(iconPath) ? fs.readFileSync(iconPath) : Buffer.alloc(0);
ok("icon-512.png: begint met de PNG-signature ("+kb(icon.length)+")", icon.length>=8 && icon.subarray(0,8).equals(PNG_SIG));

// 6. sw.js precache-lijst: ./index.html erin, "./" niet als losse entry
const pm = sw.match(/PRECACHE\s*=\s*(\[[^\]]*\])/) || sw.match(/addAll\(\s*(\[[^\]]*\])/);
let precache = null;
try{ precache = pm ? JSON.parse(pm[1]) : null; }catch(e){ precache = null; }
ok("sw.js: precache-lijst gevonden en leesbaar"+(precache?" ("+precache.join(", ")+")":""), Array.isArray(precache));
ok("sw.js: precache bevat ./index.html", !!precache && precache.indexOf("./index.html")!==-1);
ok("sw.js: precache bevat ./icon-512.png", !!precache && precache.indexOf("./icon-512.png")!==-1);
ok("sw.js: precache bevat GEEN losse \"./\"", !!precache && precache.indexOf("./")===-1);

console.log("\nt4: "+pass+" geslaagd, "+fail+" gefaald");
process.exit(fail ? 1 : 0);
