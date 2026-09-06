/* Mandje — QR-encoder rondje: eigen encoder (src/qr.js) → canvas → jsQR (van CDN) → tekst terug.
   Ontwikkeltool; vereist playwright + internet. Gebruik: node tools/qr-check.js [tekst …] */
const fs = require("fs");
const path = require("path");
(async () => {
  const pw = require("playwright");
  const qrSrc = fs.readFileSync(path.join(__dirname, "..", "src", "qr.js"), "utf8");
  const texts = process.argv.slice(2).length ? process.argv.slice(2) : [
    "https://floriandelange12.github.io/mandje/?join=ABC123",
    "Mandje",
    "https://floriandelange12.github.io/mandje/?send=0f7c1a2b-3d4e-4f60-8a9b-0c1d2e3f4a5b",
    "Een wat langere tekst met accenten: éü — en emoji 🧺 om versie 7+ te raken, nog wat meer tekst erbij zodat we boven de 124 bytes komen voor versie 8 of hoger.",
    "x".repeat(210)
  ];
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js" });
  await page.addScriptTag({ content: qrSrc });
  let fail = 0;
  for (const t of texts) {
    const res = await page.evaluate((text) => {
      const q = qrMatrix(text); if (!q) return { err: "geen matrix (te lang?)" };
      const scale = 6, quiet = 4, dim = (q.size + quiet * 2) * scale;
      const cv = document.createElement("canvas"); cv.width = dim; cv.height = dim;
      const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, dim, dim); ctx.fillStyle = "#000";
      for (let r = 0; r < q.size; r++) for (let c = 0; c < q.size; c++) if (q.get(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      const img = ctx.getImageData(0, 0, dim, dim);
      const d = jsQR(img.data, dim, dim);
      return { version: q.version, size: q.size, decoded: d ? d.data : null };
    }, t);
    const ok = res.decoded === t;
    if (!ok) fail++;
    console.log((ok ? "  ✓ " : "  ✗ FAIL: ") + "v" + res.version + " (" + res.size + "×" + res.size + ") " + JSON.stringify(t.slice(0, 50)) + (ok ? "" : " → " + JSON.stringify(res.decoded || res.err)));
  }
  await browser.close();
  console.log("\nqr-check: " + (texts.length - fail) + " geslaagd, " + fail + " gefaald");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("✗ " + (e && e.stack || e)); process.exit(1); });
