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

if (typeof module !== 'undefined') {
  module.exports = {
    SIZE, FREE, CACHE, STORAGE_KEY, LINES,
    slugify, parseBands, logoUrl, newCard, freshState, completedLines, isFull,
    loadState, saveState,
  };
}
