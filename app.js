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

// Browser en service worker: haal alle logo's uit de bandlijst binnen, zodat je
// ook offline een nieuwe kaart kunt trekken. Een ontbrekend logo (404) wordt ook
// onthouden, anders vraagt elke keer openen ze allemaal opnieuw op.
// ponytail: al gecachete logo's (en 404's) worden niet opnieuw opgehaald; een nieuw of
// vervangen logo komt binnen zodra het online op een kaart staat (network-first in sw.js).
async function cacheLogos(bands) {
  const cache = await caches.open(CACHE);
  await Promise.all(bands.map(async band => {
    const url = logoUrl(band);
    if (await cache.match(url)) return;
    await fetch(url)
      .then(res => cache.put(url, res.ok ? res : new Response('', { status: 404 })))
      .catch(() => {});
  }));
}

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
  // Als bestand geopend (dubbelklik op index.html) mag de browser bands.txt niet ophalen.
  const loadHint = location.protocol === 'file:'
    ? 'Open de site via een webserver in plaats van als bestand (zie README: python3 -m http.server).'
    : 'Open de site een keer met internet.';

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
      message.textContent = `Bandlijst niet geladen. ${loadHint}`;
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
      if (typeof caches !== 'undefined') cacheLogos(bands).catch(() => {});
    })
    .catch(() => {
      if (!state) message.textContent = `Kon bands.txt niet laden. ${loadHint}`;
    });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
}

if (typeof module !== 'undefined') {
  module.exports = {
    SIZE, FREE, CACHE, STORAGE_KEY, LINES,
    slugify, parseBands, logoUrl, newCard, freshState, completedLines, isFull,
    loadState, saveState, cacheLogos,
  };
}

if (typeof document !== 'undefined') start();
