import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../src/stats.js';

const sample = [
  { title: 'The Silent Garden', author: 'Ava Reyes', date: '2024-01-10', rating: 5, type: 'book', dnf: false, spoilers: true },
  { title: 'Silent Empire', author: 'Ava Reyes', date: '2024-03-22', rating: 4, type: 'ebook', dnf: false, spoilers: false },
  { title: 'Broken Machine', author: 'Liam Novak', date: '2023-11-02', rating: null, type: 'audiobook', dnf: true, spoilers: false },
];

test('computeStats counts totals, status and spoilers', () => {
  const s = computeStats(sample);
  assert.equal(s.total, 3);
  assert.equal(s.readCount, 2);
  assert.equal(s.dnfCount, 1);
  assert.equal(s.spoilerCount, 1);
  assert.equal(s.distinctAuthors, 2);
});

test('computeStats averages only rated books', () => {
  const s = computeStats(sample);
  assert.equal(s.ratedCount, 2);
  assert.equal(s.averageRating, 4.5);
});

test('computeStats groups by type and rating (incl. unrated)', () => {
  const s = computeStats(sample);
  assert.deepEqual(s.byType, { book: 1, ebook: 1, audiobook: 1 });
  assert.equal(s.byRating['5'], 1);
  assert.equal(s.byRating['4'], 1);
  assert.equal(s.byRating.unrated, 1);
});

test('computeStats buckets by year and builds a monthly heatmap', () => {
  const s = computeStats(sample);
  assert.deepEqual(s.byYear, { 2023: 1, 2024: 2 });
  assert.equal(s.mostReadYear, '2024');
  assert.equal(s.heatmap['2024'][0], 1); // January
  assert.equal(s.heatmap['2024'][2], 1); // March
  assert.equal(s.heatmap['2023'][10], 1); // November
});

test('computeStats ranks top authors by count', () => {
  const s = computeStats(sample);
  assert.equal(s.topAuthors[0].author, 'Ava Reyes');
  assert.equal(s.topAuthors[0].count, 2);
});

test('computeStats extracts title words minus stopwords/short words', () => {
  const s = computeStats(sample);
  const words = Object.fromEntries(s.titleWords.map((w) => [w.word, w.count]));
  assert.equal(words.silent, 2); // appears in two titles
  assert.equal(words.the, undefined); // stopword removed
});

test('computeStats handles an empty collection', () => {
  const s = computeStats([]);
  assert.equal(s.total, 0);
  assert.equal(s.averageRating, 0);
  assert.equal(s.mostReadYear, null);
  assert.deepEqual(s.topAuthors, []);
  assert.deepEqual(s.titleWords, []);
});
