/* Mandje — build
   Voegt src/ + assets/ samen tot één self-contained index.html (voor GitHub Pages).
   Gebruik:  node build.js     (of: npm run build)
*/
const fs = require("fs");
const path = require("path");
const root = __dirname;
const read = p => fs.readFileSync(path.join(root, p), "utf8");

const app   = read("src/app.js");
const cloud = read("src/cloud.js");

// cloud-module wordt BINNEN de IIFE van app.js gevoegd, vlak vóór de init-aanroep
const MARKER = 'if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);';
if (app.indexOf(MARKER) === -1) {
  console.error("✗ Build-marker niet gevonden in src/app.js — build gestopt.");
  process.exit(1);
}
const combined = app.replace(MARKER, "\n/* ===== CLOUD MODULE ===== */\n" + cloud + "\n\n" + MARKER);

// assets (base64)
const icons = {};
read("assets/icon_b64.txt").split(/\r?\n/).forEach(line => {
  const i = line.indexOf(":");
  if (i > 0) icons[line.slice(0, i)] = line.slice(i + 1).trim();
});
const font = read("assets/font_b64.txt").split(":").slice(1).join(":").trim();

// shell vullen
let html = read("src/shell.html").replace("<!-- __SCRIPT__ -->", "<script>\n" + combined + "\n</script>");
html = html.replace("__ICON180__", icons.ICON180)
           .replace("__ICON512__", icons.ICON512)
           .replace("__FONT__", font);

["__ICON180__", "__ICON512__", "__FONT__", "__SCRIPT__"].forEach(t => {
  if (html.indexOf(t) !== -1) { console.error("✗ Token niet vervangen: " + t); process.exit(1); }
});

fs.writeFileSync(path.join(root, "index.html"), html);
console.log("✓ index.html gebouwd (" + html.length + " bytes)");
