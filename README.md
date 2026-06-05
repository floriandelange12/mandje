# Mandje 🧺

Premium boodschappenlijst-PWA voor iPhone. Eén self-contained `index.html`, gehost op GitHub Pages, met een Supabase-laag voor gedeelde realtime lijsten.

**Live:** https://fl-labs26.github.io/mandje/

## Snel
```bash
npm install      # eenmalig (jsdom voor tests)
npm run build    # src/ + assets/ -> index.html
npm test         # 16/16 + 12/12 moeten groen zijn
npm run deploy   # build + commit + push (Pages deployt vanzelf)
```

Bewerk **`src/`**, nooit `index.html` (dat is het build-resultaat). Zie `CLAUDE.md` voor de volledige werkwijze en regels.

## Structuur
- `src/shell.html` — HTML + CSS + tokens (config: `window.MANDJE_CONFIG`)
- `src/app.js` — kernlogica
- `src/cloud.js` — Supabase / delen
- `assets/` — icoon + font (base64, ingebakken)
- `build.js` — samenvoegen tot `index.html`
- `tests/` — jsdom-tests
