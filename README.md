# Mandje 🧺

Premium boodschappenlijst-PWA voor iPhone, Android, iPad en desktop. Eén self-contained `index.html` (plus manifest en iconen), gehost op GitHub Pages, met een Supabase-laag voor gedeelde realtime lijsten.

**Live:** https://floriandelange12.github.io/mandje/

## Snel
```bash
npm install                    # eenmalig (jsdom voor tests)
npm run build                  # src/ + assets/ -> index.html (+ sw.js, manifest.webmanifest, iconen)
npm test                       # test.js + t3.js + t4.js + t5.js + contrast.js — alles moet groen zijn
npm run deploy -- "feat: …"    # build + tests + commit + push (Pages deployt vanzelf)
```

Bewerk **`src/`**, nooit `index.html`, `sw.js`, `manifest.webmanifest` of de icoon-PNG's in de root (dat zijn build-resultaten).
`MANDJE_CONFIG.BUILD` wordt door de build automatisch gezet (inhoudshash) — niet handmatig ophogen.
`npm run deploy` zonder bericht committeert als `deploy: build <buildId>`. Zie `CLAUDE.md` voor de volledige werkwijze en regels.

## Structuur
- `src/shell.html` — HTML + CSS + design-tokens + breakpoints (config: `window.MANDJE_CONFIG`, `BUILD: "__BUILD__"`)
- `src/icons.js` — schap-iconen, hero-mandje en app-icoon (SVG)
- `src/overlays.js` — overlay-model (sheet/dialoog/zijpaneel, focus-trap, Escape, Android-back, sneltoetsen)
- `src/app.js` — kernlogica
- `src/cloud.js` — Supabase / delen
- `src/sw.js` — service worker (offline shell, push-meldingen)
- `assets/` — iconen (base64 uit `node tools/make-icons.js`) + font (ingebakken)
- `build.js` — samenvoegen tot `index.html`; schrijft ook `sw.js`, `manifest.webmanifest` en de iconen; weigert BOM/mojibake
- `deploy.js` — `npm run deploy`: build → tests → commit → push
- `tests/` — jsdom-tests (`test.js`, `t3.js`), bundel-hygiëne (`t4.js`), contrast (`contrast.js`)
- `tools/` — `make-icons.js` (iconen rasteren) en `shots.js` (screenshot-matrix), beide optioneel met playwright
