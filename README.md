# Mandje 🧺

Premium boodschappenlijst-PWA voor iPhone. Eén self-contained `index.html`, gehost op GitHub Pages, met een Supabase-laag voor gedeelde realtime lijsten.

**Live:** https://floriandelange12.github.io/mandje/

## Snel
```bash
npm install                    # eenmalig (jsdom voor tests)
npm run build                  # src/ + assets/ -> index.html (+ sw.js en icon-512.png)
npm test                       # test.js + t3.js + t4.js — alles moet groen zijn
npm run deploy -- "feat: …"    # build + tests + commit + push (Pages deployt vanzelf)
```

Bewerk **`src/`**, nooit `index.html`, `sw.js` of `icon-512.png` in de root (dat zijn build-resultaten).
`MANDJE_CONFIG.BUILD` wordt door de build automatisch gezet (datum + inhoudshash) — niet handmatig ophogen.
`npm run deploy` zonder bericht committeert als `deploy: build <buildId>`. Zie `CLAUDE.md` voor de volledige werkwijze en regels.

## Structuur
- `src/shell.html` — HTML + CSS + tokens (config: `window.MANDJE_CONFIG`, `BUILD: "__BUILD__"`)
- `src/app.js` — kernlogica
- `src/cloud.js` — Supabase / delen
- `src/sw.js` — service worker (offline shell, push-meldingen)
- `assets/` — icoon + font (base64, ingebakken)
- `build.js` — samenvoegen tot `index.html`; schrijft ook `sw.js` en `icon-512.png`; weigert BOM/mojibake
- `deploy.js` — `npm run deploy`: build → tests → commit → push
- `tests/` — jsdom-tests (`test.js`, `t3.js`) + bundel-hygiëne (`t4.js`)
