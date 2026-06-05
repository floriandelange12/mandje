# Mandje — projectinstructies (voor Claude Code)

> Taal: **Nederlands**. Lever complete, kant-en-klare wijzigingen. Bewerk de bron, nooit het build-resultaat.

## Wat dit is
Mandje is een premium boodschappenlijst-PWA voor iPhone: één self-contained `index.html`
(HTML + CSS + JS + ingebed icoon/font), met een Supabase-laag voor gedeelde, realtime lijsten.
- **Live:** https://fl-labs26.github.io/mandje/
- **Host:** GitHub Pages op repo `FL-labs26/mandje` (branch `main`, root `/`).
- **Persoonlijke lijst:** localStorage. **Gedeelde lijsten + items:** Supabase (anonieme auth).

## Architectuur
```
src/shell.html      HTML + alle CSS + tokens (__ICON180__, __ICON512__, __FONT__, <!-- __SCRIPT__ -->)
                    Bovenin staat window.MANDJE_CONFIG met de Supabase URL + publishable key.
src/app.js          Kernlogica (IIFE): categorisering, store/migratie, cadans-engine,
                    lijst-acties, render, bottom-sheet, tabs, thema, init.
src/cloud.js        Supabase-module — wordt door de build BINNEN de IIFE van app.js gevoegd,
                    vlak vóór de init-aanroep (zie MARKER in build.js).
assets/*.txt        Icoon (180/512) en Fraunces-font als base64 — worden ingebakken.
build.js            Voegt alles samen → index.html (repo-root).
tests/*.js          jsdom-tests (test.js = 16 kerncontroles, t3.js = 12 UX/prijs-controles).
```

## Bouwen, testen, deployen
```bash
npm install          # eenmalig (installeert jsdom voor de tests)
npm run build        # src/ + assets/  ->  index.html
npm test             # draait beide testsuites; moet 16/16 én 12/12 groen zijn
npm run deploy       # build + git add -A + commit + push   (Pages deployt automatisch, ~30-60s)
```
Handmatig deployen kan ook: `git add -A && git commit -m "..." && git push`.
Na deploy: hard verversen op de telefoon (pagina sluiten/heropenen of "Herlaad zonder cache").

## Harde regels
- **NOOIT `index.html` met de hand bewerken.** Wijzig `src/` en draai `npm run build`. `index.html` is een build-artefact.
- **Altijd `npm test` draaien vóór een push.** Niet pushen bij rode tests.
- **Geen `.env` of geheimen committen.** De Supabase *publishable* key (`sb_publishable_...`) mag wél in de frontend staan: de beveiliging zit in Row Level Security in Supabase.
- **Niet force-pushen zonder back-up.** Bij twijfel eerst een branch/commit als vangnet.
- Remotes: `origin` = `FL-labs26/Skedify`-stijl → hier `FL-labs26/mandje`. Back-up-remote indien aanwezig respecteren.
- Houd de app **single-file** en zonder externe build-tooling (alleen Node voor build+tests).

## Werkwijze
1. Begrijp de vraag, bewerk de relevante `src/`-bestanden.
2. `npm run build` → `npm test` (16/16 + 12/12).
3. Korte, duidelijke commit-message; `git push`.
4. Meld de live-URL en wat er veranderd is.

## Supabase
- Project-URL en publishable key staan in `src/shell.html` (`window.MANDJE_CONFIG`).
- SQL-setup (tabellen lists/members/items, RLS, RPC's, realtime) is al eenmalig gedraaid.
- Leeg laten van de config = app werkt lokaal-only (delen uit).
