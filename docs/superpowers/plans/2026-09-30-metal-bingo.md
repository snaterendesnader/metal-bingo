# Metal Bingo — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een offline werkende bingo-website met band-logo's, die elke speler op z'n eigen telefoon opent.

**Architecture:** Statische site zonder build-stap. `app.js` bevat de pure spellogica (ook laadbaar in Node en in de service worker) plus de pagina-code, die alleen draait als `document` bestaat. `sw.js` cachet alles network-first met een timeout van 3 seconden. Hosting via GitHub Pages.

**Tech Stack:** Plain HTML/CSS/JavaScript, Service Worker + Web App Manifest, `localStorage`, Node 25 (`node:assert`) voor de self-check, ImageMagick 6 (`convert`) voor het app-icoon, `python3 -m http.server` om lokaal te serveren.

**Spec:** `docs/superpowers/specs/2026-09-30-metal-bingo-design.md`

## Global Constraints

- Geen frameworks, geen build-stap, geen npm-dependencies. Geen `package.json`.
- Alle paden relatief (geen leidende `/`), zodat de site werkt onder `https://<user>.github.io/<repo>/`.
- Kaart 5×5; middelste vakje (index 12) is gratis en telt als afgevinkt; 24 verschillende bands per kaart.
- Minimaal 24 bands, anders een foutmelding in plaats van een kaart.
- Slug-regel: NFD + accenten weg, kleine letters, elke reeks tekens anders dan `a-z0-9` → één `-`, streepjes aan begin/eind weg. Override: `Naam | slug`.
- Logo-pad: `logos/<slug>.png`. Ontbreekt het logo → alleen de naam in grote letters.
- Bingo = volle rij, kolom of diagonaal; volle kaart krijgt eigen melding.
- Nieuwe kaart alleen na bevestiging: "Nieuwe kaart? Je vinkjes gaan verloren."
- Opslag in `localStorage`; als dat niet kan, speelt het spel gewoon zonder bewaren.
- Offline: network-first met ca. 3 seconden timeout, daarna cache; alle logo's uit de bandlijst worden gecachet.
- UI-teksten in het Nederlands; code-identifiers in het Engels.
- Donker thema, kaart past zonder scrollen op een telefoonscherm.

## Review Focus

1. **Opslag geblokkeerd** (iOS privévenster, uitgeschakelde site-data: `localStorage` gooit bij elke toegang) → het spel werkt, er wordt alleen niets bewaard. Test in Task 2.
2. **Kapotte of verouderde opgeslagen kaart** (oud formaat, handmatig geknoeid) → er komt een nieuwe kaart in plaats van een lege pagina of crash. Test in Task 2.
3. **`bands.txt` bewerkt op Windows of een telefoon** (CRLF, spaties aan het eind, dezelfde band twee keer met andere hoofdletters) → schone namen, geen dubbele band op een kaart. Test in Task 1.
4. **Rare namen** (`AC/DC |` met lege override, een naam van alleen symbolen) → valt terug op de slug-regel resp. de naam, niets crasht. Test in Task 1.
5. **`bands.txt` niet te laden terwijl er een bewaarde kaart is** → de bewaarde kaart blijft zichtbaar; "Nieuwe kaart" geeft een duidelijke melding in plaats van een crash. Handmatige test in Task 3.

---

### Task 1: Spellogica — slugs, bandlijst, kaart, bingo

**Files:**
- Create: `app.js`
- Test: `test.js`

**Interfaces:**
- Consumes: niets.
- Produces (via `module.exports` in Node, als globals in browser en service worker):
  - `SIZE = 5`, `FREE = 12`, `CACHE = 'metal-bingo'`, `STORAGE_KEY = 'metal-bingo-state'`
  - `LINES: number[][]` — 12 lijnen van 5 indexen (rijen, kolommen, 2 diagonalen)
  - `slugify(name: string): string`
  - `parseBands(text: string): {name: string, slug: string}[]` — ontdubbeld op naam (hoofdletterongevoelig)
  - `logoUrl(band: {slug}): string` → `'logos/<slug>.png'`
  - `newCard(bands, random = Math.random): (Band | null)[]` — lengte 25, `null` op `FREE`; gooit `Error` met tekst `Te weinig bands in bands.txt: <n>, minimaal 24.`
  - `freshState(bands, random?): {cells: (Band|null)[], marked: boolean[]}` — `marked[FREE] === true`, rest `false`
  - `completedLines(marked: boolean[]): number[][]` — de volle lijnen uit `LINES`, in `LINES`-volgorde
  - `isFull(marked: boolean[]): boolean`

- [ ] **Step 1: Schrijf de falende test**

Maak `test.js`:

```js
// Self-check van de spellogica: node test.js
const assert = require('node:assert/strict');
const {
  slugify, parseBands, logoUrl, newCard, freshState, completedLines, isFull, FREE,
} = require('./app.js');

// slugify
assert.equal(slugify('Iron Maiden'), 'iron-maiden');
assert.equal(slugify('Mötley Crüe'), 'motley-crue');
assert.equal(slugify('AC/DC'), 'ac-dc');
assert.equal(slugify('  Bolt  Thrower!! '), 'bolt-thrower');
assert.equal(slugify('†††'), '');

// parseBands: commentaar, lege regels, CRLF, spaties, override, lege override, dubbel
assert.deepEqual(
  parseBands('# commentaar\n\nIron Maiden\r\n  Bolt Thrower  \nAC/DC | acdc\nMotörhead |\n| alleen-slug\niron maiden\n'),
  [
    { name: 'Iron Maiden', slug: 'iron-maiden' },
    { name: 'Bolt Thrower', slug: 'bolt-thrower' },
    { name: 'AC/DC', slug: 'acdc' },
    { name: 'Motörhead', slug: 'motorhead' },
  ],
);
assert.deepEqual(parseBands('†††'), [{ name: '†††', slug: '' }]);
assert.equal(logoUrl({ name: 'AC/DC', slug: 'acdc' }), 'logos/acdc.png');

// newCard
const bands = n => Array.from({ length: n }, (_, i) => ({ name: `Band ${i}`, slug: `band-${i}` }));
assert.throws(() => newCard(bands(23)), /Te weinig bands in bands\.txt: 23, minimaal 24\./);
assert.equal(newCard(bands(24)).filter(Boolean).length, 24);
for (const random of [Math.random, () => 0, () => 0.99999]) {
  const input = bands(50);
  const card = newCard(input, random);
  assert.equal(card.length, 25);
  assert.equal(card[FREE], null);
  const names = card.filter(Boolean).map(b => b.name);
  assert.equal(names.length, 24);
  assert.equal(new Set(names).size, 24);
  assert.deepEqual(input, bands(50)); // invoer niet aangepast
}

// freshState
assert.deepEqual(freshState(bands(30)).marked, Array.from({ length: 25 }, (_, i) => i === FREE));

// completedLines + isFull
const marks = (...idx) => Array.from({ length: 25 }, (_, i) => i === FREE || idx.includes(i));
assert.deepEqual(completedLines(marks()), []);
assert.deepEqual(completedLines(marks(0, 1, 2, 3)), []);
assert.deepEqual(completedLines(marks(0, 1, 2, 3, 4)), [[0, 1, 2, 3, 4]]);
assert.deepEqual(completedLines(marks(10, 11, 13, 14)), [[10, 11, 12, 13, 14]]);
assert.deepEqual(completedLines(marks(2, 7, 17, 22)), [[2, 7, 12, 17, 22]]);
assert.deepEqual(completedLines(marks(0, 6, 18, 24)), [[0, 6, 12, 18, 24]]);
assert.deepEqual(completedLines(marks(4, 8, 16, 20)), [[4, 8, 12, 16, 20]]);
const all = Array(25).fill(true);
assert.equal(completedLines(all).length, 12);
assert.ok(isFull(all));
assert.ok(!isFull(marks(0, 1, 2, 3, 4)));

console.log('alle tests geslaagd');
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `node test.js`
Expected: FAIL met `Cannot find module './app.js'`

- [ ] **Step 3: Schrijf de implementatie**

Maak `app.js`:

```js
// Metal Bingo. Het bovenste deel is pure spellogica en laadt ook in Node (test.js)
// en in de service worker (sw.js); de pagina-code draait alleen in de browser.

const SIZE = 5;
const FREE = 12; // middelste vakje
const CACHE = 'metal-bingo';
const STORAGE_KEY = 'metal-bingo-state';

const LINES = [];
for (let i = 0; i < SIZE; i++) {
  LINES.push([0, 1, 2, 3, 4].map(j => i * SIZE + j)); // rij i
  LINES.push([0, 1, 2, 3, 4].map(j => j * SIZE + i)); // kolom i
}
LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Eén band per regel, "Naam | slug" voor een eigen bestandsnaam, # voor commentaar.
function parseBands(text) {
  const seen = new Set();
  const bands = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [name, slug] = line.split('|').map(s => s.trim());
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    bands.push({ name, slug: slug || slugify(name) });
  }
  return bands;
}

function logoUrl(band) {
  return `logos/${band.slug}.png`;
}

function newCard(bands, random = Math.random) {
  const needed = SIZE * SIZE - 1;
  if (bands.length < needed) {
    throw new Error(`Te weinig bands in bands.txt: ${bands.length}, minimaal ${needed}.`);
  }
  const pool = bands.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const cells = pool.slice(0, needed);
  cells.splice(FREE, 0, null);
  return cells;
}

function freshState(bands, random) {
  return {
    cells: newCard(bands, random),
    marked: Array.from({ length: SIZE * SIZE }, (_, i) => i === FREE),
  };
}

function completedLines(marked) {
  return LINES.filter(line => line.every(i => marked[i]));
}

function isFull(marked) {
  return marked.every(Boolean);
}

if (typeof module !== 'undefined') {
  module.exports = {
    SIZE, FREE, CACHE, STORAGE_KEY, LINES,
    slugify, parseBands, logoUrl, newCard, freshState, completedLines, isFull,
  };
}
```

- [ ] **Step 4: Draai de test en zie hem slagen**

Run: `node test.js`
Expected: `alle tests geslaagd`

- [ ] **Step 5: Commit**

```bash
git add app.js test.js
git commit -m "Add bingo game logic with self-check"
```

---

### Task 2: Kaart bewaren en terugzetten

**Files:**
- Modify: `app.js` (functies toevoegen vóór het `module.exports`-blok, exports uitbreiden)
- Test: `test.js` (tests toevoegen vóór de laatste regel `console.log(...)`)

**Interfaces:**
- Consumes: `freshState`, `FREE`, `STORAGE_KEY` uit Task 1.
- Produces:
  - `loadState(storage: Storage | null): State | null` — `null` bij lege, kapotte, verkeerd gevormde of geblokkeerde opslag; gooit nooit
  - `saveState(storage: Storage | null, state: State): void` — gooit nooit
  - `State = {cells: (Band|null)[25], marked: boolean[25]}`

- [ ] **Step 1: Schrijf de falende test**

Pas in `test.js` de import bovenaan aan naar:

```js
const {
  slugify, parseBands, logoUrl, newCard, freshState, completedLines, isFull, FREE,
  loadState, saveState, STORAGE_KEY,
} = require('./app.js');
```

En voeg dit toe vlak vóór `console.log('alle tests geslaagd');`:

```js
// loadState / saveState
const memory = () => {
  const data = {};
  return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};
const store = memory();
assert.equal(loadState(store), null); // nog niets bewaard
const saved = freshState(bands(30));
saved.marked[3] = true;
saveState(store, saved);
assert.deepEqual(loadState(store), saved);

// kapotte of verouderde opslag → null
const card = newCard(bands(30));
for (const bad of [
  'geen json',
  'null',
  '{}',
  '{"cells":[],"marked":[]}',
  JSON.stringify({ cells: Array(25).fill(1), marked: Array(25).fill(false) }),
  JSON.stringify({ cells: card, marked: Array(25).fill('ja') }),
  JSON.stringify({ cells: card.map(c => c || { name: 'x', slug: 'x' }), marked: Array(25).fill(false) }),
]) {
  const s = memory();
  s.setItem(STORAGE_KEY, bad);
  assert.equal(loadState(s), null, bad);
}

// geblokkeerde of ontbrekende opslag gooit nooit
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
assert.equal(loadState(blocked), null);
saveState(blocked, saved);
assert.equal(loadState(null), null);
saveState(null, saved);
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `node test.js`
Expected: FAIL met `TypeError: loadState is not a function`

- [ ] **Step 3: Schrijf de implementatie**

Voeg in `app.js` toe vlak vóór `if (typeof module !== 'undefined') {`:

```js
// storage is localStorage, of null als de browser dat blokkeert.
function loadState(storage) {
  try {
    const s = JSON.parse(storage.getItem(STORAGE_KEY));
    const valid = s
      && Array.isArray(s.cells) && s.cells.length === SIZE * SIZE
      && Array.isArray(s.marked) && s.marked.length === SIZE * SIZE
      && s.marked.every(m => typeof m === 'boolean')
      && s.cells.every((c, i) => (i === FREE
        ? c === null
        : c !== null && typeof c.name === 'string' && typeof c.slug === 'string'));
    return valid ? s : null;
  } catch {
    return null;
  }
}

function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // opslag geblokkeerd of vol: spelen kan nog, alleen zonder bewaren
  }
}
```

En breid de exports uit:

```js
if (typeof module !== 'undefined') {
  module.exports = {
    SIZE, FREE, CACHE, STORAGE_KEY, LINES,
    slugify, parseBands, logoUrl, newCard, freshState, completedLines, isFull,
    loadState, saveState,
  };
}
```

- [ ] **Step 4: Draai de test en zie hem slagen**

Run: `node test.js`
Expected: `alle tests geslaagd`

- [ ] **Step 5: Commit**

```bash
git add app.js test.js
git commit -m "Save and restore the card in localStorage"
```

---

### Task 3: De pagina — kaart tonen, afvinken, bingo, nieuwe kaart

**Files:**
- Create: `index.html`
- Create: `bands.txt`
- Modify: `app.js` (functie `start()` toevoegen vóór het `module.exports`-blok, en een regel onderaan)

**Interfaces:**
- Consumes: alles uit Task 1 en 2.
- Produces: `start(): void` — koppelt aan de elementen `#board`, `#banner`, `#message`, `#new` in `index.html`. Task 4 breidt `start()` uit.

- [ ] **Step 1: Maak de startlijst `bands.txt`**

```text
# Metal Bingo — één band per regel. Logo: logos/<naam>.png (zie README.md).
# Eigen bestandsnaam: "Naam | bestandsnaam". Regels met # worden overgeslagen.

# Klassiekers
Metallica
Iron Maiden
Black Sabbath
Judas Priest
Motörhead
AC/DC | acdc
Dio
Megadeth
Slayer
Anthrax
Pantera
Testament
Exodus
Kreator
Sodom
Sepultura
Machine Head
Lamb of God

# Death & grind
Death
Cannibal Corpse
Morbid Angel
Obituary
Bolt Thrower
Napalm Death
Carcass
At the Gates
Asphyx
Pestilence
Hail of Bullets

# Black
Venom
Bathory
Celtic Frost
Mayhem
Darkthrone
Emperor
Immortal
Behemoth
Dimmu Borgir
Cradle of Filth
Watain

# Melodisch, prog & modern
Amon Amarth
In Flames
Arch Enemy
Children of Bodom
Opeth
Mastodon
Gojira
Meshuggah
Tool
Slipknot
System of a Down
Rammstein
Ghost
Sabaton
Nightwish
Within Temptation
Epica
Trivium
Parkway Drive

# Doom & stoner
Type O Negative
Electric Wizard
Sleep
```

- [ ] **Step 2: Maak `index.html`**

```html
<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#111111">
<title>Metal Bingo</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #111; --fg: #eee; --tile: #f2f2f2; --ink: #111;
    --mark: #c00; --line: #ffcc00; --error: #f66;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    height: 100dvh; padding: 8px 8px max(8px, env(safe-area-inset-bottom));
    background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif;
  }
  h1 { margin: 0; font-size: 1.4rem; letter-spacing: .1em; text-transform: uppercase; }
  #banner { min-height: 1.2em; margin: 0; font-size: 1.8rem; font-weight: 900; color: var(--line); }
  #message { margin: 0; color: var(--error); text-align: center; }
  #message:empty { display: none; }
  #board {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px;
    width: min(100%, calc(100dvh - 10rem));
  }
  .cell {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    aspect-ratio: 1; min-width: 0; overflow: hidden; padding: 3px;
    border: 0; border-radius: 6px; background: var(--tile); color: var(--ink); font: inherit;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  }
  .cell img { flex: 1; min-height: 0; width: 100%; object-fit: contain; }
  .cell span {
    max-height: 2.2em; overflow: hidden;
    font-size: .55rem; line-height: 1.1; text-align: center; overflow-wrap: anywhere;
  }
  .cell.nologo span { max-height: none; font-size: .75rem; font-weight: 700; }
  .cell.free { font-size: 2rem; }
  .cell.marked { background: var(--mark); color: #fff; }
  .cell.marked img { filter: invert(1); }
  .cell.line { background: var(--line); color: var(--ink); }
  .cell.line img { filter: none; }
  #new {
    margin-top: auto; padding: 12px 24px;
    border: 2px solid var(--fg); border-radius: 8px;
    background: transparent; color: var(--fg); font: inherit; font-weight: 700;
  }
</style>
</head>
<body>
<h1>Metal Bingo</h1>
<p id="banner" role="status" aria-live="polite"></p>
<p id="message" role="alert"></p>
<div id="board"></div>
<button id="new" type="button">Nieuwe kaart</button>
<script src="app.js" defer></script>
</body>
</html>
```

- [ ] **Step 3: Voeg de pagina-code toe aan `app.js`**

Voeg toe vlak vóór `if (typeof module !== 'undefined') {`:

```js
function start() {
  const board = document.getElementById('board');
  const banner = document.getElementById('banner');
  const message = document.getElementById('message');
  let storage = null;
  try {
    storage = window.localStorage; // gooit als de browser site-data blokkeert
  } catch {}
  let bands = null;
  let state = loadState(storage);

  function showCard() {
    board.replaceChildren(...state.cells.map((band, i) => {
      if (band === null) {
        const free = document.createElement('div');
        free.className = 'cell free';
        free.textContent = '🤘';
        free.setAttribute('aria-label', 'Gratis vakje');
        return free;
      }
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      const img = document.createElement('img');
      img.src = logoUrl(band);
      img.alt = '';
      img.onerror = () => {
        img.remove();
        cell.classList.add('nologo');
      };
      const name = document.createElement('span');
      name.textContent = band.name;
      cell.append(img, name);
      cell.onclick = () => {
        state.marked[i] = !state.marked[i];
        saveState(storage, state);
        update();
      };
      return cell;
    }));
    update();
  }

  function update() {
    const inLine = new Set(completedLines(state.marked).flat());
    [...board.children].forEach((cell, i) => {
      cell.classList.toggle('marked', state.marked[i]);
      cell.classList.toggle('line', inLine.has(i));
      if (i !== FREE) cell.setAttribute('aria-pressed', String(state.marked[i]));
    });
    banner.textContent = isFull(state.marked) ? 'VOLLE KAART!' : inLine.size ? 'BINGO!' : '';
  }

  function newGame() {
    if (!bands) {
      message.textContent = 'Bandlijst niet geladen. Open de site een keer met internet.';
      return;
    }
    try {
      state = freshState(bands);
    } catch (err) {
      message.textContent = err.message;
      return;
    }
    message.textContent = '';
    saveState(storage, state);
    showCard();
  }

  document.getElementById('new').onclick = () => {
    if (confirm('Nieuwe kaart? Je vinkjes gaan verloren.')) newGame();
  };

  if (state) showCard();
  fetch('bands.txt')
    .then(res => {
      if (!res.ok) throw new Error(res.statusText);
      return res.text();
    })
    .then(text => {
      bands = parseBands(text);
      if (!state) newGame();
    })
    .catch(() => {
      if (!state) message.textContent = 'Kon bands.txt niet laden. Open de site een keer met internet.';
    });
}
```

En voeg helemaal onderaan `app.js` toe (na het `module.exports`-blok):

```js
if (typeof document !== 'undefined') start();
```

- [ ] **Step 4: Check dat de self-check nog slaagt**

Run: `node test.js`
Expected: `alle tests geslaagd` (in Node bestaat `document` niet, dus `start()` draait niet)

- [ ] **Step 5: Handmatige test in de browser**

Run: `python3 -m http.server 8000` in de projectmap, open `http://localhost:8000` in Chrome, DevTools → device toolbar → iPhone SE (375×667).

Maak een tijdelijk testlogo: `convert -size 300x300 xc:none -fill black -font DejaVu-Sans-Bold -pointsize 70 -gravity center -annotate +0+0 'TEST' logos/metallica.png` (maak eerst `mkdir -p logos`).

Controleer, met verwachte uitkomst:
- 25 vakjes, midden 🤘, kaart past zonder scrollen, knop "Nieuwe kaart" zichtbaar onderaan.
- Vakjes zonder logo tonen de naam in grote letters; staat Metallica op de kaart (trek zo nodig een paar nieuwe kaarten), dan toont dat vakje het TEST-logo met de naam eronder.
- Tik op een vakje → rood met witte tekst/logo; nog eens tikken → weer licht.
- Maak een volle rij → die 5 vakjes geel, "BINGO!" bovenaan. Vink er één uit → geel en "BINGO!" weg.
- Maak een kolom en een diagonaal vol → alle drie geel.
- Herlaad → zelfde kaart, zelfde vinkjes.
- "Nieuwe kaart" → bevestigingsvraag; Annuleren → niets verandert; OK → nieuwe kaart zonder vinkjes.
- Review Focus 5: `mv bands.txt bands.txt.bak`, herlaad → bewaarde kaart blijft staan; "Nieuwe kaart" → OK → melding "Bandlijst niet geladen. Open de site een keer met internet." DevTools → Application → Local storage → wis → herlaad → melding "Kon bands.txt niet laden. …". Daarna `mv bands.txt.bak bands.txt`.
- Te weinig bands: `cp bands.txt bands.txt.bak && head -n 9 bands.txt.bak > bands.txt`, wis Local storage, herlaad → melding "Te weinig bands in bands.txt: 5, minimaal 24." Daarna `mv bands.txt.bak bands.txt`.

Ruim op: `rm logos/metallica.png`. Stop de server (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add index.html bands.txt app.js
git commit -m "Add bingo page with starter band list"
```

---

### Task 4: Offline werken en installeerbaar maken

**Files:**
- Create: `sw.js`
- Create: `manifest.json`
- Create: `icon.png`
- Modify: `index.html` (twee `<link>`-regels in `<head>`)
- Modify: `app.js` (functie `cacheLogos` + twee aanvullingen in `start()`)

**Interfaces:**
- Consumes: `CACHE`, `parseBands`, `logoUrl` uit Task 1; `start()` uit Task 3.
- Produces: `cacheLogos(bands): Promise<void>` — zet elk nog niet gecachet logo in cache `CACHE`; ontbrekende logo's (404) worden genegeerd. Gebruikt door `sw.js` en `start()`.

- [ ] **Step 1: Voeg `cacheLogos` toe aan `app.js`**

Voeg toe vlak vóór `function start() {`:

```js
// Browser en service worker: haal alle logo's uit de bandlijst binnen, zodat je
// ook offline een nieuwe kaart kunt trekken. Ontbrekende logo's (404) worden overgeslagen.
// ponytail: al gecachete logo's worden niet opnieuw opgehaald; een vervangen logo komt
// binnen zodra het op een kaart staat (network-first in sw.js).
async function cacheLogos(bands) {
  const cache = await caches.open(CACHE);
  await Promise.all(bands.map(async band => {
    const url = logoUrl(band);
    if (!(await cache.match(url))) await cache.add(url).catch(() => {});
  }));
}
```

- [ ] **Step 2: Breid `start()` uit**

Vervang in `start()` het blok

```js
    .then(text => {
      bands = parseBands(text);
      if (!state) newGame();
    })
```

door

```js
    .then(text => {
      bands = parseBands(text);
      if (!state) newGame();
      if (typeof caches !== 'undefined') cacheLogos(bands).catch(() => {});
    })
```

En voeg als laatste regel binnen `start()` toe (na het `fetch`-blok):

```js
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
```

- [ ] **Step 3: Maak `sw.js`**

```js
// Service worker: alles network-first met 3 seconden geduld, daarna de cache.
importScripts('app.js'); // CACHE, parseBands, cacheLogos

const CORE = ['./', 'index.html', 'app.js', 'manifest.json', 'icon.png', 'bands.txt'];
const TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    const bands = await (await cache.match('bands.txt')).text();
    await cacheLogos(parseBands(bands));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  network.catch(() => {}); // voorkomt een losse rejection als de cache al antwoordde
  const timeout = new Promise(resolve => setTimeout(resolve, TIMEOUT_MS));
  const quick = await Promise.race([network, timeout]).catch(() => undefined);
  // Traag of offline: cache als die er is, anders toch op het netwerk wachten.
  return quick || (await cache.match(request)) || network;
}
```

- [ ] **Step 4: Maak `manifest.json`**

```json
{
  "name": "Metal Bingo",
  "short_name": "Metal Bingo",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#111111",
  "theme_color": "#111111",
  "icons": [
    { "src": "icon.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

- [ ] **Step 5: Maak `icon.png`**

Run:

```bash
convert -size 512x512 xc:'#111111' -fill '#cc0000' -font DejaVu-Sans-Bold -pointsize 230 -gravity center -annotate +0+0 'MB' icon.png
file icon.png
```

Expected: `icon.png: PNG image data, 512 x 512, ...`

- [ ] **Step 6: Koppel manifest en icoon in `index.html`**

Voeg in `<head>` toe, direct na de `<title>`-regel:

```html
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icon.png">
```

- [ ] **Step 7: Check dat de self-check nog slaagt**

Run: `node test.js`
Expected: `alle tests geslaagd`

- [ ] **Step 8: Handmatige offline-test in de browser**

Run: `mkdir -p logos && convert -size 300x300 xc:none -fill black -font DejaVu-Sans-Bold -pointsize 70 -gravity center -annotate +0+0 'TEST' logos/metallica.png`, dan `python3 -m http.server 8000`, open `http://localhost:8000` in Chrome.

Controleer:
- DevTools → Application → Service workers: `sw.js` is *activated and running*.
- Application → Cache storage → `metal-bingo`: bevat `./`, `index.html`, `app.js`, `manifest.json`, `icon.png`, `bands.txt` en `logos/metallica.png`. Geen fouten in de Console over ontbrekende logo's die de installatie breken.
- Application → Manifest: naam "Metal Bingo", icoon zichtbaar, geen installatiefouten.
- Network → Offline aanvinken, herlaad → pagina en kaart laden. Vinkjes zetten werkt. "Nieuwe kaart" → OK → nieuwe kaart (bandlijst komt uit de cache).
- Stop de server (Ctrl+C) terwijl Offline uit staat en herlaad → pagina laadt nog steeds uit de cache.
- Optioneel, de timeout: Network → throttling → Add custom profile met latency 5000 ms, herstart de server, herlaad → pagina verschijnt na ca. 3 seconden uit de cache in plaats van na 5+.

Ruim op: `rm logos/metallica.png`, zet Offline/throttling uit, en in Application → Storage → "Clear site data" (anders blijft het testlogo in de cache). Stop de server.

- [ ] **Step 9: Commit**

```bash
git add sw.js manifest.json icon.png index.html app.js
git commit -m "Work offline via service worker and make installable"
```

---

### Task 5: README en klaarmaken voor GitHub Pages

**Files:**
- Create: `README.md`
- Create: `.nojekyll` (leeg: GitHub Pages serveert de bestanden dan zoals ze zijn, zonder Jekyll-build)
- Create: `logos/.gitkeep` (leeg: zodat de map `logos/` in git bestaat)

**Interfaces:**
- Consumes: de werkende site uit Task 1–4.
- Produces: een repo die klaar is om naar GitHub te pushen.

- [ ] **Step 1: Maak `README.md`**

````markdown
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
````

- [ ] **Step 2: Maak de lege bestanden**

Run: `touch .nojekyll && mkdir -p logos && touch logos/.gitkeep`

- [ ] **Step 3: Eindcontrole**

Run: `node test.js && git status --short && ls logos`
Expected: `alle tests geslaagd`; `git status --short` toont alleen `?? .nojekyll`, `?? README.md` en `?? logos/`; `ls logos` geeft geen uitvoer (geen testlogo's achtergebleven).

- [ ] **Step 4: Commit**

```bash
git add README.md .nojekyll logos/.gitkeep
git commit -m "Add README and GitHub Pages setup"
```

- [ ] **Step 5: Overdracht aan de gebruiker (niet zelf uitvoeren)**

Pushen naar GitHub is een publieke stap en een keuze van de gebruiker (publieke of privé-repo, zie spec). Meld:
- de exacte commando's uit README stap 1–2;
- dat de test op een echte telefoon na het online zetten nog moet: laden, vliegtuigmodus aan, herladen, afvinken, nieuwe kaart, bingo halen, en of 5×5 prettig tikt.
