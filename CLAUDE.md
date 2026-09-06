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
src/shell.html      HTML + alle CSS + tokens (__ICON180__, __ICON512__, __FONT__, <!-- __SCRIPT__ -->,
                    BUILD: "__BUILD__"). Bovenin staat window.MANDJE_CONFIG met de Supabase URL + publishable key.
src/app.js          Kernlogica (IIFE): categorisering, store/migratie, cadans-engine,
                    lijst-acties, render, bottom-sheet, tabs, thema, init.
src/cloud.js        Supabase-module — wordt door de build BINNEN de IIFE van app.js gevoegd,
                    vlak vóór de init-aanroep (zie MARKER in build.js).
src/sw.js           Service worker: stale-while-revalidate voor de shell, precache van
                    index.html + icon-512.png, web push + notificationclick.
assets/*.txt        Icoon (180/512) en Fraunces-font als base64 — worden ingebakken.
build.js            Voegt alles samen → index.html (repo-root) en schrijft daarnaast sw.js en
                    icon-512.png als losse root-bestanden. Zet BUILD automatisch (datum +
                    inhoudshash) en weigert bronnen met een BOM of mojibake (dubbel gecodeerde UTF-8).
deploy.js           `npm run deploy`: build → tests → git add/commit/push; stopt bij rode tests.
tests/*.js          test.js (kern) en t3.js (UX/prijs/cloud) draaien met jsdom over de gebouwde
                    index.html; t4.js = bundel-hygiëne op de gebouwde bestanden (encoding,
                    BUILD-pariteit index.html↔sw.js, groottebudget, icoon, sw-precache).
                    Elke suite eindigt met "N geslaagd, M gefaald"; de eis is overal M = 0.
```

## Bouwen, testen, deployen
```bash
npm install                     # eenmalig (installeert jsdom voor de tests)
npm run build                   # src/ + assets/  ->  index.html + sw.js + icon-512.png
npm test                        # test.js + t3.js + t4.js; alles moet groen zijn (0 gefaald)
npm run deploy -- "feat: …"     # build + tests + git add -A + commit + push (Pages deployt automatisch, ~30-60s)
npm run deploy                  # idem; commit-bericht wordt dan "deploy: build <buildId>"
```
Handmatig deployen kan ook: `npm run build && npm test && git add -A && git commit -m "..." && git push`.
`MANDJE_CONFIG.BUILD` (onderaan de Meer-tab zichtbaar) wordt door build.js gezet als `<datum>.<sha1-hash van de inhoud>`;
sw.js krijgt exact dezelfde waarde als cache-naam. **Niet meer handmatig ophogen** — elke wijziging in `src/` of
`assets/` geeft vanzelf een nieuwe BUILD en dus een verse SW-cache.
Na deploy: hard verversen op de telefoon (pagina sluiten/heropenen of "Herlaad zonder cache").

## Harde regels
- **NOOIT `index.html`, `sw.js` of `icon-512.png` in de repo-root met de hand bewerken.** Wijzig `src/` en draai `npm run build`. Het zijn build-artefacten.
- **Altijd `npm test` draaien vóór een push.** Niet pushen bij rode tests (`npm run deploy` dwingt dit af).
- **Bronbestanden zijn UTF-8 zonder BOM.** build.js stopt hard op een BOM of op mojibake (een verkeerd gecodeerde "é" of "—"). Herstel dan de bron; de guard niet omzeilen.
- **Geen `.env` of geheimen committen.** De Supabase *publishable* key (`sb_publishable_...`) mag wél in de frontend staan: de beveiliging zit in Row Level Security in Supabase.
- **Niet force-pushen zonder back-up.** Bij twijfel eerst een branch/commit als vangnet.
- Remotes: `origin` = `floriandelange12/mandje`. `fl-labs26` → `FL-labs26/mandje` is omgebouwd tot **redirect-host** (oude URL stuurt door naar de nieuwe). Push naar fl-labs26 mag alleen wanneer het puur om de redirect-`index.html` gaat — geen app-content meer naar die remote.
- Houd de **app-code single-file** (`index.html`) en zonder externe build-tooling (alleen Node voor build+tests). De enige losse root-bestanden zijn `sw.js` en `icon-512.png`: een service worker en een meldingsicoon kúnnen niet inline.

## Werkwijze
1. Begrijp de vraag, bewerk de relevante `src/`-bestanden.
2. `npm run build` → `npm test` (test.js + t3.js + t4.js allemaal groen).
3. Korte, duidelijke commit-message: `npm run deploy -- "type: wat en waarom"`.
4. Meld de live-URL, de nieuwe BUILD-waarde en wat er veranderd is.

## Supabase
- Project-URL en publishable key staan in `src/shell.html` (`window.MANDJE_CONFIG`).
- SQL-setup (tabellen lists/members/items, RLS, RPC's, realtime) is al eenmalig gedraaid.
- Leeg laten van de config = app werkt lokaal-only (delen uit).
