/* Schap-iconen — monochroom, currentColor, 24×24 (zie plan Fase 1). Wordt door build.js in de IIFE gevoegd.
   Vormtaal: viewBox 0 0 24 24, tekengebied 20×20 (2px veilige rand), stroke 1.75, ronde caps/joins,
   zo min mogelijk lijnen, per icoon één signatuurdetail. Geen width/height: CSS bepaalt de maat.
   Preview: tools/icons-preview.html */
var SHELF_ICONS = {
  /* blad: één blad met middennerf */
  "groente-fruit":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 4.5C10.5 4.5 5 9.8 5 18.5c8.7 0 14-5.5 14.5-14Z"/><path d="M5 18.5c3-5.5 6.5-8.7 10.5-10.5"/></svg>',
  /* kiem: potje met rand, stengel en twee blaadjes */
  "tuin-planten":    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 14h12"/><path d="M7.25 14l.9 5.2A1.5 1.5 0 0 0 9.63 20.5h4.74a1.5 1.5 0 0 0 1.48-1.3l.9-5.2"/><path d="M12 14V8.5"/><path d="M12 11c-3.5.2-5.3-1.5-5.5-5 3.5-.2 5.3 1.5 5.5 5Z"/><path d="M12 9c.2-3.5 2-5.3 5.5-5.5-.2 3.5-2 5.3-5.5 5.5Z"/></svg>',
  /* brood: koepelvormig brood op vlakke bodem, drie schuine inkepingen */
  "brood-banket":    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 17v-2.5a7.5 7 0 0 1 15 0V17a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 17Z"/><path d="M8.5 10.5l1.5 2M11.5 10l1.5 2M14.5 10.5l1.5 2"/></svg>',
  /* pot: jampot — brede schroefdop op smallere hals, ronde schouders, etiket als twee korte lijntjes */
  "ontbijt-beleg":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.25 3.5h7.5A1.25 1.25 0 0 1 17 4.75v1a1.25 1.25 0 0 1-1.25 1.25h-7.5A1.25 1.25 0 0 1 7 5.75v-1A1.25 1.25 0 0 1 8.25 3.5Z"/><path d="M9 7v1.75a2.5 2.5 0 0 0-2.5 2.5V19a1.5 1.5 0 0 0 1.5 1.5h8A1.5 1.5 0 0 0 17.5 19v-7.75A2.5 2.5 0 0 0 15 8.75V7"/><path d="M9.5 13h5M9.5 16h5"/></svg>',
  /* blik: conservenblik met ellipsdeksel en gebogen etiketband */
  "houdbaar":        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5.5" rx="6.5" ry="2"/><path d="M5.5 5.5v13c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2v-13"/><path d="M5.5 11c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2M5.5 15c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2"/></svg>',
  /* snoepje: rond snoepje met twee gewikkelde, licht ingesnoerde wikkelpunten */
  "snoep-snacks":    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.25"/><path d="M7.75 10.25 4 8.25c.7 2.5.7 5 0 7.5l3.75-2"/><path d="M16.25 10.25 20 8.25c-.7 2.5-.7 5 0 7.5l-3.75-2"/></svg>',
  /* melkpak: pak met puntdak en naad */
  "zuivel-eieren":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8.5 9 4h6l2 4.5V19a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19Z"/><path d="M7 8.5h10"/><path d="M12 8.5V4"/><path d="M9.5 13h5"/></svg>',
  /* kaaswig: aflopende wig met twee gaten */
  "kaas-vleeswaren": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17.5h14a1.5 1.5 0 0 0 1.5-1.5v-9.5a1.5 1.5 0 0 0-1.9-1.45L4.6 10.45A1.5 1.5 0 0 0 3.5 11.9V16A1.5 1.5 0 0 0 5 17.5Z"/><circle cx="14.75" cy="11.75" r="2"/><circle cx="9" cy="13.5" r="1.5"/></svg>',
  /* vlok: drie kruisende spaken (r 8.5) met een kort Y-takje (2 lang) aan elk van de zes uiteinden */
  "diepvries":       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5v17M4.64 7.75l14.72 8.5M4.64 16.25l14.72-8.5"/><path d="M10.27 5 12 6l1.73-1M10.27 19 12 18l1.73 1M17.2 7v2l1.73 1M18.93 14l-1.73 1v2M6.8 17v-2l-1.73-1M5.07 10l1.73-1V7"/></svg>',
  /* fles: fles met hals, gebogen schouders en doplijn */
  "dranken":         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5h4v5c0 1.75 3 2.25 3 3.75V19a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19v-6.75c0-1.5 3-2 3-3.75Z"/><path d="M10 6.5h4"/></svg>',
  /* vis: ronde kop links, spitse romp, ingesneden staart en oogpunt */
  "vlees-vis":       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12c0-3 2.5-5.5 5.75-5.5 3.4 0 6 2.5 7.25 5.5-1.25 3-3.85 5.5-7.25 5.5C6 17.5 3.5 15 3.5 12Z"/><path d="M16.5 12 20.5 8.5c-.75 2.35-.75 4.65 0 7Z"/><path d="M7.75 10.5h.01"/></svg>',
  /* poot: kussen met vier tenen in een boog */
  "huisdier":        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20c-2.5 0-4.5-1.6-4.5-3.75 0-2.4 2.2-4.5 4.5-4.5s4.5 2.1 4.5 4.5C16.5 18.4 14.5 20 12 20Z"/><circle cx="5" cy="10.5" r="1.6"/><circle cx="8.9" cy="6" r="1.6"/><circle cx="15.1" cy="6" r="1.6"/><circle cx="19" cy="10.5" r="1.6"/></svg>',
  /* pompje: flacon met kraag en pompkop met tuit */
  "verzorging":      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 12a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v7a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19Z"/><path d="M10.25 10V8h3.5v2"/><path d="M12 8V4.75a1.25 1.25 0 0 1 1.25-1.25h2.5A1.25 1.25 0 0 1 17 4.75V6.5"/></svg>',
  /* speen: schild, speentje erboven en ring eronder */
  "baby-kind":       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="9.5" width="15" height="4" rx="2"/><path d="M9.5 9.5V6.75a2.5 2.5 0 0 1 5 0V9.5"/><path d="M10 13.5a3.75 3.75 0 1 0 4 0"/></svg>',
  /* capsule: 35° gedraaide capsule met scheidslijn */
  "apotheek":        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.51 18.03 18.51 11.71a3.5 3.5 0 0 0-4.02-5.74L5.49 12.29a3.5 3.5 0 0 0 4.02 5.74Z"/><path d="M9.99 9.13l4.02 5.74"/></svg>',
  /* emmer: taps toelopende emmer met rand en hoog hengsel */
  "huishouden":      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14"/><path d="M6.5 8l1.2 11.2a1.5 1.5 0 0 0 1.49 1.3h5.62a1.5 1.5 0 0 0 1.49-1.3L17.5 8"/><path d="M7.5 8a4.5 4.5 0 0 1 9 0"/></svg>',
  /* hamer: 45° gekantelde kop met afgeronde hoeken en omlijnde steel */
  "klussen":         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.61 5.43 18.57 10.39a1.5 1.5 0 0 1 0 2.12l-1.06 1.06a1.5 1.5 0 0 1-2.12 0L10.43 8.61a1.5 1.5 0 0 1 0-2.12l1.06-1.06a1.5 1.5 0 0 1 2.12 0Z"/><path d="M12.03 10.21 4.61 17.63a1.25 1.25 0 0 0 1.77 1.77l7.42-7.42"/></svg>',
  /* clip: staande paperclip in één doorlopende lijn */
  "kantoor-school":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8.5v7a5 5 0 0 1-10 0V6.75a3.5 3.5 0 0 1 7 0v7.5a2 2 0 0 1-4 0V10"/></svg>',
  /* shirt: t-shirt met ronde hals */
  "kleding-textiel": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.75 4 3.5 7l2 3.5L8 9.5V19a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 19V9.5l2.5 1 2-3.5L15.25 4a3.25 2.5 0 0 1-6.5 0Z"/></svg>',
  /* mandje: merkteken — rand, mand, hengsel, drie latten */
  "overig":          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10h17"/><path d="M5 10l1.15 8.1A2 2 0 0 0 8.13 20h7.74a2 2 0 0 0 1.98-1.9L19 10"/><path d="M8 10a4 4 0 0 1 8 0"/><path d="M9.25 13.5v3M12 13.5v3M14.75 13.5v3"/></svg>'
};

/* Schapgroepen (voor kleur/tint per groep in de UI). */
var SHELF_GROUP = { "groente-fruit":"vers", "tuin-planten":"vers", "brood-banket":"graan", "ontbijt-beleg":"graan", "houdbaar":"graan", "snoep-snacks":"graan", "zuivel-eieren":"koel", "kaas-vleeswaren":"koel", "diepvries":"koel", "dranken":"koel", "vlees-vis":"eiwit", "huisdier":"eiwit", "verzorging":"zorg", "baby-kind":"zorg", "apotheek":"zorg", "huishouden":"huis", "klussen":"huis", "kantoor-school":"huis", "kleding-textiel":"huis", "overig":"huis" };

/* Lege-staat-illustratie: het mandje (×5 van het 24px-merkteken) met rechts één rond item dat boven de rand
   uitsteekt. Het item zit in <g class="hero-accent"> zodat CSS het een accentkleur kan geven. */
var HERO_BASKET_SVG = '<svg viewBox="0 0 120 110" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 42h85"/><path d="M25 42l5.75 40.5A10 10 0 0 0 40.65 92h38.7a10 10 0 0 0 9.9-9.5L95 42"/><path d="M40 42a20 20 0 0 1 40 0"/><path d="M46.25 59.5v15M60 59.5v15M73.75 59.5v15"/><g class="hero-accent"><path d="M83 42a10 10 0 1 1 16 0"/><path d="M91 26v-4"/></g></svg>';

/* App-icoon (maskable): volvlak groen met subtiele radiale opheldering linksboven, mandje in crème (stroke 34),
   één amber item dat boven de rand uitsteekt (via clipPath afgesneden op de randlijn). Alle betekenisdragende
   pixels liggen binnen een cirkel met straal 204 om het midden (verste punt: randuiteinden op ≈188). */
var APP_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="mandje-bg" cx="0.25" cy="0.2" r="0.85"><stop offset="0" stop-color="#2E6A4C"/><stop offset="1" stop-color="#24593F"/></radialGradient><clipPath id="mandje-rim"><rect x="0" y="0" width="512" height="199"/></clipPath></defs><rect width="512" height="512" fill="url(#mandje-bg)"/><circle cx="376" cy="154" r="40" fill="#E9B65C" clip-path="url(#mandje-rim)"/><g fill="none" stroke="#F3EDE3" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"><path d="M94.5 199h323"/><path d="M123 199l21.85 153.9A38 38 0 0 0 182.47 389h147.06a38 38 0 0 0 37.62-36.1L389 199"/><path d="M189.5 199a66.5 66.5 0 0 1 133 0"/><path d="M203.75 265.5v57M256 265.5v57M308.25 265.5v57"/></g></svg>';

/* Zelfde tekening op een squircle (radius 22% = 113px) met transparante hoeken — voor purpose "any". */
var APP_ICON_ANY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="mandje-bg-any" cx="0.25" cy="0.2" r="0.85"><stop offset="0" stop-color="#2E6A4C"/><stop offset="1" stop-color="#24593F"/></radialGradient><clipPath id="mandje-rim-any"><rect x="0" y="0" width="512" height="199"/></clipPath></defs><rect width="512" height="512" rx="113" fill="url(#mandje-bg-any)"/><circle cx="376" cy="154" r="40" fill="#E9B65C" clip-path="url(#mandje-rim-any)"/><g fill="none" stroke="#F3EDE3" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"><path d="M94.5 199h323"/><path d="M123 199l21.85 153.9A38 38 0 0 0 182.47 389h147.06a38 38 0 0 0 37.62-36.1L389 199"/><path d="M189.5 199a66.5 66.5 0 0 1 133 0"/><path d="M203.75 265.5v57M256 265.5v57M308.25 265.5v57"/></g></svg>';
/* Monochroom meldings-badge (Android statusbalk): alleen de alpha telt — wit mandje op transparant, 96×96. */
var APP_BADGE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"><path d="M70 214h372"/><path d="M104 214l25.5 179.6A44 44 0 0 0 173.4 432h165.2a44 44 0 0 0 43.9-38.4L442 214"/><path d="M178 214a78 78 0 0 1 156 0"/><path d="M195 292v66M256 292v66M317 292v66"/></g></svg>';
