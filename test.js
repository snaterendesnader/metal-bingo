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
