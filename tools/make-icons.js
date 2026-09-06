/* Mandje — app-iconen rasteren (ontwikkeltool, niet nodig voor de build).
   Opent tools/make-icons.html in headless Chromium (playwright, moet lokaal aanwezig zijn) en schrijft
   de base64-regels naar assets/icon_b64.txt. Gebruik: node tools/make-icons.js
   Daarna: npm run build (build.js schrijft icon-192.png, icon-512.png, icon-512-maskable.png, icon-180.png). */
const fs = require("fs");
const path = require("path");
(async function(){
  let pw;
  try{ pw = require("playwright"); }catch(e){ console.error("✗ playwright niet gevonden (npm i -D playwright) — of open tools/make-icons.html in een browser en plak de regels handmatig in assets/icon_b64.txt."); process.exit(1); }
  const root = path.resolve(__dirname, "..");
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  await page.goto("file:///" + path.join(root, "tools", "make-icons.html").split(path.sep).join("/"));
  await page.waitForFunction(() => window.__iconsReady === true, null, { timeout: 20000 });
  const out = await page.$eval("#out", el => el.value);
  await browser.close();
  const lines = out.split("\n").filter(Boolean);
  const bad = lines.filter(l => /:ERROR$/.test(l));
  if(bad.length){ console.error("✗ rasteren mislukt voor: " + bad.map(l => l.split(":")[0]).join(", ")); process.exit(1); }
  const target = path.join(root, "assets", "icon_b64.txt");
  fs.writeFileSync(target, lines.join("\n") + "\n", "utf8");
  lines.forEach(l => { const [k, v] = l.split(":"); console.log("✓ " + k + ": " + Math.round(Buffer.from(v, "base64").length / 1024) + " KB PNG"); });
  console.log("→ " + path.relative(root, target) + " bijgewerkt");
})().catch(e => { console.error("✗ " + (e && e.message || e)); process.exit(1); });
