# Metal Bingo — ontwerp

Datum: 2026-09-30

## Doel

Een bingo voor een groepje van 3–4 vrienden op een festival. Iedereen opent
dezelfde website op z'n eigen telefoon en krijgt een willekeurige kaart met
band-logo's. Zie je een logo op een shirt, battlevest, tattoo enz., dan vink je
het vakje af. Herkennen doen de spelers zelf, niet de app.

Succes = het werkt betrouwbaar op een telefoon op een festivalterrein, ook
zonder bereik, en je bent je kaart nooit per ongeluk kwijt.

## Buiten scope

- Synchronisatie tussen spelers, accounts, server. Wie bingo heeft roept het
  en laat z'n scherm zien.
- Automatische logo-herkenning.
- Frameworks, build-stap, native app.

## Aanpak

Statische website zonder build-stap, installeerbaar als PWA ("zet op
beginscherm"), gehost op GitHub Pages.

## Bestanden

```
index.html      pagina: kaart, knoppen, opmaak (inline CSS)
app.js          spellogica: kaart trekken, afvinken, bingo checken, bewaren
sw.js           service worker: offline cache
manifest.json   naam + icoon voor installatie
icon.png        app-icoon
bands.txt       één band per regel
logos/          <slug>.png per band
test.js         self-check voor de spellogica (`node test.js`)
```

## Bandlijst (`bands.txt`)

- Eén band per regel. Lege regels en regels die met `#` beginnen worden
  genegeerd.
- Optioneel een expliciete bestandsnaam: `AC/DC | acdc`. Zonder `|` wordt de
  slug afgeleid van de naam.
- Slug-regel: Unicode-normalisatie (NFD) en accenten verwijderen, kleine
  letters, elke reeks tekens anders dan `a-z0-9` wordt één `-`, streepjes aan
  begin/eind weg. `Mötley Crüe` → `motley-crue`, `Bolt Thrower` →
  `bolt-thrower`.
- Logo-pad: `logos/<slug>.png`. Aanbevolen: transparant of zwart-op-wit,
  ongeveer vierkant, enkele honderden pixels breed (klein houden, alles komt
  offline op de telefoon).
- Startlijst: ca. 40–50 bekende bands die je veel op shirts ziet. Minimum 24.

## Spel

- **Kaart:** 5×5. Middelste vakje is gratis (🤘) en telt als afgevinkt.
  De overige 24 vakjes: 24 verschillende bands, willekeurig gekozen uit de
  lijst en geschud (Fisher-Yates met `crypto.getRandomValues` of
  `Math.random`).
- **Te weinig bands** (< 24): duidelijke foutmelding in plaats van een kaart.
- **Vakje:** logo met de bandnaam klein eronder. Ontbreekt het logo (laden
  mislukt), dan alleen de naam in grote letters.
- **Afvinken:** tik = aan, nog eens tikken = uit. Afgevinkt is duidelijk
  zichtbaar in fel zonlicht (hoog contrast, kruis/kleurrand).
- **Bingo:** zodra een volle rij, kolom of diagonaal compleet is, lichten die
  vakjes op en verschijnt een grote "BINGO!". Doorspelen kan; extra lijnen
  lichten ook op. Volle kaart krijgt een eigen melding. Uitvinken van een vakje
  haalt de markering van de betreffende lijn weer weg.
- **Nieuwe kaart:** knop onderaan, met bevestiging ("Je vinkjes gaan
  verloren").
- **Opmaak:** donker thema. Kaart past zonder scrollen op een telefoonscherm,
  vakjes groot genoeg voor een duim. Leesbaarheid van de naam op kleine
  schermen is het eerste om in de praktijk te testen.

## Bewaren

- In `localStorage`: de 25 vakjes (bandnaam + slug, in kaartvolgorde) en welke
  afgevinkt zijn. Bij elke wijziging opgeslagen, bij laden teruggezet.
- Een lopende kaart bewaart z'n eigen bands, dus wijzigingen in `bands.txt`
  raken alleen nieuwe kaarten.
- Kan `localStorage` niet (bv. privévenster): spel werkt gewoon, alleen zonder
  bewaren.

## Offline

- Service worker cachet bij installatie: `index.html`, `app.js`,
  `manifest.json`, `icon.png`, `bands.txt`, en alle logo's uit de bandlijst.
  Ontbrekende logo's (404) breken de installatie niet.
- Bij elke keer openen met bereik ververst de app de cache, inclusief logo's
  van nieuw toegevoegde bands, zodat ook offline een nieuwe kaart met alle
  bands kan.
- Strategie: network-first met een timeout van ca. 3 seconden, daarna de
  gecachte versie. Een half werkend festivalnetwerk laat de app dus niet
  hangen.
- Tip voor spelers: site vóór het festival één keer openen of op het
  beginscherm zetten.

## Online zetten

- Git-repo → GitHub → GitHub Pages vanaf de root van `main`.
- Let op: GitHub Pages op een gratis account vereist (voor zover bekend) een
  publieke repo, en dan staan de logo's openbaar. Keuze van de gebruiker;
  verandert het ontwerp niet.
- Alle paden relatief, zodat de site werkt onder `https://<user>.github.io/<repo>/`.

## Testen

- `node test.js`: assert-based self-check van de pure logica in `app.js`:
  slug-regel (inclusief accenten en `|`-override), parsen van `bands.txt`
  (commentaar, lege regels), kaart heeft 24 unieke bands + gratis midden,
  bingo-detectie voor rijen, kolommen, beide diagonalen en volle kaart,
  foutmelding bij < 24 bands.
- Daarvoor moet de pure logica in `app.js` zonder browser laadbaar zijn
  (DOM-code pas aanroepen als `document` bestaat).
- Handmatig op een echte telefoon: laden, vliegtuigmodus aan, herladen,
  afvinken, nieuwe kaart trekken, bingo halen, en of 5×5 prettig tikt.
