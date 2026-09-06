# Mandje — projectinstructies (voor Claude Code)

> Taal: **Nederlands**. Lever complete, kant-en-klare wijzigingen. Bewerk de bron, nooit het build-resultaat.

## Wat dit is
Mandje is een premium boodschappenlijst-PWA voor iPhone: één self-contained `index.html`
(HTML + CSS + JS + ingebed icoon/font), met een Supabase-laag voor gedeelde, realtime lijsten.
- **Live:** https://floriandelange12.github.io/mandje/
- **Host:** GitHub Pages op repo `floriandelange12/mandje` (branch `main`, root `/`).
- **Persoonlijke lijst:** localStorage. **Gedeelde lijsten + items:** Supabase (anonieme auth).

## Architectuur
```
src/shell.html      HTML + alle CSS + design-tokens (:root en html[data-theme="dark"]) + placeholders
                    __FONT__, <!-- __SCRIPT__ -->, BUILD: "__BUILD__". Bovenin staat window.MANDJE_CONFIG
                    met de Supabase URL + publishable key. Breakpoints in cascade-volgorde: telefoon →
                    (max-width:359px) → telefoon-landschap → ≥768 rasters → tablet-tokens → dialoog →
                    zijpaneel (≥1024 landschap / ≥1200) → ≥1366 → pointer-laag (hover:hover).
src/icons.js        Schap-iconen (SHELF_ICONS/SHELF_GROUP), hero-mandje, app-icoon-SVG's. Prelude-module.
src/overlays.js     Eén overlay-model: modalOpen/modalClose (LIFO-stack, role=dialog, inert, focus-trap,
                    Escape, history-token voor Android-back), sheetLayout(), injectSheetX, onGlobalKey.
src/app.js          Kernlogica (IIFE): categorisering, store/migratie, cadans-engine, lijst-acties,
                    render, sheet, tabs, thema/tekstgrootte, Meer-tab, start-parameters, init.
src/cloud.js        Supabase-module — wordt door de build BINNEN de IIFE van app.js gevoegd,
                    vlak vóór de init-aanroep (zie MARKER in build.js). icons.js + overlays.js worden
                    als prelude vóór de app-code in dezelfde IIFE gezet (PRELUDE in build.js).
src/sw.js           Service worker: stale-while-revalidate voor de shell (alleen navigaties naar / of
                    /index.html), precache index.html + manifest + icon-192 + badge-96, web push.
assets/icon_b64.txt ICON180/ICON192/ICON512/ICON512MASK/ICON96BADGE als base64 — gerasterd uit
                    src/icons.js met `node tools/make-icons.js` (playwright, alleen voor ontwikkeling).
assets/font_b64.txt Fraunces-font (statisch, één gewicht) — wordt ingebakken.
build.js            Voegt alles samen → index.html (repo-root) en schrijft daarnaast sw.js,
                    manifest.webmanifest en de iconen (icon-180/192/512, icon-512-maskable, badge-96)
                    als losse root-bestanden. Zet BUILD automatisch (inhoudshash) en weigert bronnen
                    met een BOM of mojibake (dubbel gecodeerde UTF-8).
deploy.js           `npm run deploy`: build → tests → scoped git add/commit/push; stopt bij rode tests.
tests/*.js          test.js (kern) en t3.js (UX/prijs/cloud/Fase-blokken) draaien met jsdom over de
                    gebouwde index.html; t4.js = bundel-hygiëne (encoding, BUILD-pariteit, budgetten,
                    manifest + iconen, sw-precache); contrast.js = WCAG-contrast van alle tokens en
                    lidkleuren. Elke suite eindigt met "N geslaagd, M gefaald"; de eis is overal M = 0.
tools/shots.js      Screenshot-matrix (viewports × licht/donker × staten) → qa_shots/ (genegeerd in git).
```

## Bouwen, testen, deployen
```bash
npm install                     # eenmalig (installeert jsdom voor de tests)
npm run build                   # src/ + assets/  ->  index.html + sw.js + manifest.webmanifest + iconen
npm test                        # test.js + t3.js + t4.js + contrast.js; alles moet groen zijn (0 gefaald)
node tools/shots.js             # optioneel: screenshots op alle viewports (vereist lokale http-server op :8765 + playwright)
npm run deploy -- "feat: …"     # build + tests + git add -A + commit + push (Pages deployt automatisch, ~30-60s)
npm run deploy                  # idem; commit-bericht wordt dan "deploy: build <buildId>"
```
Handmatig deployen kan ook: `npm run build && npm test && git add -A && git commit -m "..." && git push`.
`MANDJE_CONFIG.BUILD` (Meer-tab → Diagnose → Versie) wordt door build.js gezet als sha1-hash van de inhoud (8 tekens);
sw.js krijgt exact dezelfde waarde als cache-naam. **Niet meer handmatig ophogen** — elke wijziging in `src/` of
`assets/` geeft vanzelf een nieuwe BUILD en dus een verse SW-cache.
Na deploy: hard verversen op de telefoon (pagina sluiten/heropenen of "Herlaad zonder cache").

## Harde regels
- **NOOIT `index.html`, `sw.js`, `manifest.webmanifest` of de icoon-PNG's in de repo-root met de hand bewerken.** Wijzig `src/` (of `src/icons.js` + `node tools/make-icons.js`) en draai `npm run build`. Het zijn build-artefacten.
- **Altijd `npm test` draaien vóór een push.** Niet pushen bij rode tests (`npm run deploy` dwingt dit af).
- **Bronbestanden zijn UTF-8 zonder BOM.** build.js stopt hard op een BOM of op mojibake (een verkeerd gecodeerde "é" of "—"). Herstel dan de bron; de guard niet omzeilen.
- **Geen `.env` of geheimen committen.** De Supabase *publishable* key (`sb_publishable_...`) mag wél in de frontend staan: de beveiliging zit in Row Level Security in Supabase.
- **Niet force-pushen zonder back-up.** Bij twijfel eerst een branch/commit als vangnet.
- Remotes: `origin` = `floriandelange12/mandje`. `fl-labs26` → `FL-labs26/mandje` is omgebouwd tot **redirect-host** (oude URL stuurt door naar de nieuwe). Push naar fl-labs26 mag alleen wanneer het puur om de redirect-`index.html` gaat — geen app-content meer naar die remote.
- Houd de **app-code single-file** (`index.html`) en zonder externe build-tooling (alleen Node voor build+tests; playwright is optioneel voor iconen/screenshots). De enige losse root-bestanden zijn PWA-metadata die niet inline kúnnen: `sw.js`, `manifest.webmanifest` (als data-URI zijn start_url/scope onoplosbaar) en de icoon-PNG's (manifest, apple-touch-icon, push-icoon/badge).
- **Design-tokens zijn de enige bron voor kleur, maat, radius, schaduw en motion.** Geen losse hex-kleuren, `font-size:14px` of `border-radius:12px` in nieuwe CSS; `tests/contrast.js` bewaakt de contrastratio's. Nieuwe overlays gaan altijd via `modalOpen/modalClose` (src/overlays.js).

## Werkwijze
1. Begrijp de vraag, bewerk de relevante `src/`-bestanden.
2. `npm run build` → `npm test` (test.js + t3.js + t4.js + contrast.js allemaal groen).
3. Korte, duidelijke commit-message: `npm run deploy -- "type: wat en waarom"`.
4. Meld de live-URL, de nieuwe BUILD-waarde en wat er veranderd is.

## Supabase
- Project-URL en publishable key staan in `src/shell.html` (`window.MANDJE_CONFIG`).
- SQL-setup (tabellen lists/members/items, RLS, RPC's, realtime) is al eenmalig gedraaid.
- Leeg laten van de config = app werkt lokaal-only (delen uit).
