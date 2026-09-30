# Metal Bingo

Bingo met band-logo's voor op festivals. Iedereen opent de site op z'n eigen
telefoon en krijgt een eigen kaart. Zie je een logo op een shirt, battlevest of
tattoo? Tik het vakje aan. Volle rij, kolom of diagonaal = BINGO!

## Klaarmaken voor het festival

Zonder bereik werkt de site alleen als hij al eens op je telefoon is geladen.
Doe dit de dag vóór het festival, met internet:

1. Open de site in Safari of Chrome zelf (niet in de browser van een chat-app).
2. iPhone: zet hem via Deel → "Zet op beginscherm" op je beginscherm en open hem
   één keer vanaf dat icoon. Speel daarna alleen via dat icoon: het icoon en
   Safari hebben elk hun eigen kaart en offline-opslag.
3. Wacht tot de kaart er staat, zet dan vliegtuigmodus aan en herlaad (of sluit en
   open het icoon). Staat de kaart er nog, dan ben je klaar.

Niet te vroeg doen: Safari kan de opslag van een site wissen die je een week niet
hebt gebruikt.

## Bands en logo's toevoegen

- Zet de naam in `bands.txt`, één band per regel. Regels met `#` zijn commentaar.
- Zet het logo in `logos/` als `<naam>.png`: kleine letters, spaties en andere
  tekens worden `-`, accenten vallen weg. `Mötley Crüe` → `logos/motley-crue.png`.
- Andere bestandsnaam nodig? Schrijf `AC/DC | acdc` → `logos/acdc.png`.
- Liefst een zwart logo op een transparante achtergrond, ongeveer vierkant, een
  paar honderd pixels breed en klein (zo'n 50 KB): alle logo's komen offline op
  elke telefoon te staan.
- Geen logo? Dan toont het vakje de naam.

## Lokaal draaien

Dubbelklikken op `index.html` werkt niet: de browser mag `bands.txt` dan niet
ophalen. Start een kleine webserver in de projectmap:

```bash
python3 -m http.server 8000   # open http://localhost:8000
node test.js                  # self-check van de spellogica
```

## Online zetten (GitHub Pages)

1. Maak een repo op GitHub en push: `git remote add origin <url>` en `git push -u origin main`.
2. Op GitHub: Settings → Pages → Source "Deploy from a branch", branch `main`, map `/ (root)`.
3. Na een minuut of zo staat de site op `https://<gebruiker>.github.io/<repo>/`.
