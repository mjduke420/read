import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCsvStore } from '../src/csvStore.js';

let dir;
let store;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'reads-test-'));
  store = createCsvStore(join(dir, 'books.csv'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test('readAll returns [] when the file does not exist', async () => {
  assert.deepEqual(await store.readAll(), []);
});

test('writeAll then readAll round-trips records', async () => {
  const books = [
    { id: '1', title: 'A', author: 'B', date: '2024-01-01', rating: 4, description: 'hi' },
  ];
  await store.writeAll(books);
  const read = await store.readAll();
  assert.equal(read.length, 1);
  assert.deepEqual(read[0], books[0]);
});

test('preserves commas, quotes and newlines in the description', async () => {
  const tricky = 'Line one, with comma\nLine "two" with quotes';
  await store.writeAll([
    { id: '1', title: 'T', author: 'A', date: '2024-01-01', rating: null, description: tricky },
  ]);
  const read = await store.readAll();
  assert.equal(read[0].description, tricky);
  assert.equal(read[0].rating, null);
});

test('update appends without losing existing data', async () => {
  await store.update((all) => [
    ...all,
    { id: '1', title: 'First', author: 'A', date: '2024-01-01', rating: 3, description: '' },
  ]);
  await store.update((all) => [
    ...all,
    { id: '2', title: 'Second', author: 'B', date: '2024-02-01', rating: 4, description: '' },
  ]);
  const read = await store.readAll();
  assert.deepEqual(read.map((b) => b.id), ['1', '2']);
});

test('concurrent updates are serialized (no lost writes)', async () => {
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      store.update((all) => [
        ...all,
        { id: String(i), title: `T${i}`, author: 'A', date: '2024-01-01', rating: null, description: '' },
      ]),
    ),
  );
  const read = await store.readAll();
  assert.equal(read.length, 10);
});
