# Metal Bingo

Bingo met band-logo's voor op festivals. Iedereen opent de site op z'n eigen
telefoon en krijgt een eigen kaart. Zie je een logo op een shirt, battlevest of
tattoo? Tik het vakje aan. Volle rij, kolom of diagonaal = BINGO!

Open de site vóór het festival één keer met internet (of zet hem op je
beginscherm), dan werkt hij daarna ook zonder bereik.

## Bands en logo's toevoegen

- Zet de naam in `bands.txt`, één band per regel. Regels met `#` zijn commentaar.
- Zet het logo in `logos/` als `<naam>.png`: kleine letters, spaties en andere
  tekens worden `-`, accenten vallen weg. `Mötley Crüe` → `logos/motley-crue.png`.
- Andere bestandsnaam nodig? Schrijf `AC/DC | acdc` → `logos/acdc.png`.
- Liefst een zwart logo op een transparante achtergrond, ongeveer vierkant en een
  paar honderd pixels breed.
- Geen logo? Dan toont het vakje de naam.

## Lokaal draaien

```bash
python3 -m http.server 8000   # open http://localhost:8000
node test.js                  # self-check van de spellogica
```

## Online zetten (GitHub Pages)

1. Maak een repo op GitHub en push: `git remote add origin <url>` en `git push -u origin main`.
2. Op GitHub: Settings → Pages → Source "Deploy from a branch", branch `main`, map `/ (root)`.
3. Na een minuut of zo staat de site op `https://<gebruiker>.github.io/<repo>/`.
