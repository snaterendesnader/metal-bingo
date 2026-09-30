// Self-check van de spellogica: node test.js
const assert = require('node:assert/strict');
const {
  slugify, parseBands, logoUrl, newCard, freshState, completedLines, isFull, newLines, FREE,
  loadState, saveState, STORAGE_KEY, cacheLogos,
} = require('./app.js');

// slugify
assert.equal(slugify('Iron Maiden'), 'iron-maiden');
assert.equal(slugify('Mötley Crüe'), 'motley-crue');
assert.equal(slugify('AC/DC'), 'ac-dc');
assert.equal(slugify('  Bolt  Thrower!! '), 'bolt-thrower');
assert.equal(slugify('†††'), '');
assert.equal(slugify('Mgła'), 'mgla');
assert.equal(slugify('ŁÓDŹ'), 'lodz');

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

// newLines: alleen de lijnen die door deze tik vol zijn geworden
assert.deepEqual(newLines(marks(0, 1, 2, 3), marks(0, 1, 2, 3, 4)), [[0, 1, 2, 3, 4]]);
assert.deepEqual(newLines(marks(0, 1, 2, 3, 4), marks(0, 1, 2, 3, 4, 9)), []); // lijn was al vol
assert.deepEqual(newLines(marks(0, 1, 2, 3, 4), marks(0, 1, 2, 3)), []); // uitvinken
assert.deepEqual( // één tik maakt rij 0 én kolom 0 vol
  newLines(marks(1, 2, 3, 4, 5, 10, 15, 20), marks(0, 1, 2, 3, 4, 5, 10, 15, 20)),
  [[0, 1, 2, 3, 4], [0, 5, 10, 15, 20]],
);

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

// cacheLogos: gevonden én ontbrekende logo's worden onthouden, dus niet elke keer opnieuw opgevraagd;
// een ontbrekend logo wordt na een uur opnieuw geprobeerd, zodat later toegevoegde logo's binnenkomen
(async () => {
  const stored = new Map();
  const requested = [];
  const present = new Set(['logos/band-0.png']);
  globalThis.fetch = async url => {
    requested.push(url);
    return new Response('png', { status: present.has(url) ? 200 : 404 });
  };
  globalThis.caches = {
    open: async () => ({
      match: async url => stored.get(url),
      put: async (url, res) => { stored.set(url, res); },
      add: async url => { // zoals de echte Cache.add: faalt bij een 404
        const res = await fetch(url);
        if (!res.ok) throw new TypeError('bad status');
        stored.set(url, res);
      },
    }),
  };
  const t0 = Date.UTC(2026, 9, 1, 12);
  await cacheLogos(bands(3), t0);
  await cacheLogos(bands(3), t0 + 60 * 1000); // een minuut later
  assert.deepEqual(requested, ['logos/band-0.png', 'logos/band-1.png', 'logos/band-2.png']);
  assert.equal(stored.get('logos/band-0.png').status, 200);
  assert.equal(stored.get('logos/band-1.png').status, 404);

  present.add('logos/band-1.png'); // logo later toegevoegd
  requested.length = 0;
  await cacheLogos(bands(3), t0 + 61 * 60 * 1000); // ruim een uur later
  assert.deepEqual(requested, ['logos/band-1.png', 'logos/band-2.png']);
  assert.equal(stored.get('logos/band-1.png').status, 200);

  // een "ontbreekt" uit een eerdere versie (zonder tijdstip) wordt meteen opnieuw geprobeerd
  stored.set('logos/band-2.png', new Response('', { status: 404 }));
  requested.length = 0;
  await cacheLogos(bands(3), t0 + 62 * 60 * 1000);
  assert.deepEqual(requested, ['logos/band-2.png']);

  console.log('alle tests geslaagd');
})();
