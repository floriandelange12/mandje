#!/usr/bin/env node
/* Mandje — deploy
   build → tests → (niets te committen? melden en stoppen) → git add -A → git commit → git push
   Gebruik:  npm run deploy                        commit-bericht: "deploy: build <buildId>"
             npm run deploy -- "feat: bericht"     eigen commit-bericht
   Rode tests = geen commit, geen push. Cross-platform (Windows/macOS/Linux).
*/
const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const root = __dirname;

function run(cmd){
  console.log("\n$ " + cmd);
  execSync(cmd, { stdio: "inherit", cwd: root });
}
function capture(cmd){ return execSync(cmd, { cwd: root, encoding: "utf8" }); }

// 1. build + tests — falen = stoppen vóór er iets aan git gebeurt
try {
  run("node build.js");
  run("npm test");
} catch (e) {
  console.error("\n✗ Deploy afgebroken: build of tests faalden (niets gecommit, niets gepusht).");
  process.exit(1);
}

// 2. is er wel iets te committen?
let status;
try { status = capture("git status --porcelain").trim(); }
catch (e) { console.error("\n✗ git status mislukt — is dit een git-repo?"); process.exit(1); }
if (!status) {
  console.log("\n· Niets te committen: de werkboom is schoon (build identiek aan de laatste commit). Deploy gestopt.");
  process.exit(0);
}

// 3. commit-bericht: argument, anders "deploy: build <buildId>" (buildId uit de gebouwde index.html)
const idMatch = fs.readFileSync(path.join(root, "index.html"), "utf8").match(/BUILD:\s*"([^"]*)"/);
const buildId = idMatch ? idMatch[1] : "onbekend";
const custom = process.argv.slice(2).join(" ").trim();
const message = custom || ("deploy: build " + buildId);

// 4. add → commit → push  (commit via execFileSync: geen shell-quoting-gedoe met het bericht)
try {
  console.log("\nTe committen:\n" + status);
  // Alleen bekende paden — nooit ongezien een los bestand (sleutel, dump) naar de publieke repo
  run("git add -A -- src assets tests tools supabase .github index.html sw.js supabase.js manifest.webmanifest icon-180.png icon-192.png icon-512.png icon-512-maskable.png badge-96.png build.js deploy.js package.json package-lock.json CLAUDE.md README.md .gitignore .editorconfig .gitattributes");
  console.log("\n$ git commit -m " + JSON.stringify(message));
  execFileSync("git", ["commit", "-m", message], { stdio: "inherit", cwd: root });
  run("git push origin HEAD");   // expliciet naar origin (fl-labs26 is een redirect-host, zie CLAUDE.md)
} catch (e) {
  console.error("\n✗ Deploy afgebroken bij git (zie de output hierboven).");
  process.exit(1);
}

console.log("\n✓ Gedeployd — " + message + " (BUILD " + buildId + "). GitHub Pages verwerkt het in ~30-60 s.");
