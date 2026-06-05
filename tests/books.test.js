import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBook, searchBooks, sortBooks, BookInputSchema } from '../src/books.js';

test('createBook builds a record with an id and trimmed fields', () => {
  const book = createBook({ title: '  Dune  ', author: ' Herbert ', date: '2024-02-01', rating: '4' });
  assert.match(book.id, /^[0-9a-f-]{36}$/);
  assert.equal(book.title, 'Dune');
  assert.equal(book.author, 'Herbert');
  assert.equal(book.date, '2024-02-01');
  assert.equal(book.rating, 4);
  assert.equal(book.description, '');
});

test('createBook defaults missing date to today (YYYY-MM-DD)', () => {
  const book = createBook({ title: 'X', author: 'Y' });
  assert.match(book.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('createBook treats empty rating as unrated (null)', () => {
  const book = createBook({ title: 'X', author: 'Y', rating: '' });
  assert.equal(book.rating, null);
});

test('createBook rejects missing title', () => {
  assert.throws(() => createBook({ author: 'Y' }), /Title is required/);
});

test('createBook rejects out-of-range rating', () => {
  assert.throws(() => createBook({ title: 'X', author: 'Y', rating: '9' }));
});

test('createBook rejects a malformed date', () => {
  assert.throws(() => createBook({ title: 'X', author: 'Y', date: '02/01/2024' }), /YYYY-MM-DD/);
});

test('BookInputSchema is reusable for validation', () => {
  const result = BookInputSchema.safeParse({ title: 'A', author: 'B' });
  assert.equal(result.success, true);
});

const sample = [
  { id: '1', title: 'Beta', author: 'Zoe', date: '2024-01-01', rating: 3, description: 'space opera' },
  { id: '2', title: 'alpha', author: 'Amy', date: '2024-03-01', rating: 5, description: 'a cooking memoir' },
  { id: '3', title: 'Gamma', author: 'Mike', date: '2024-02-01', rating: null, description: 'history of Rome' },
];

test('searchBooks matches title, author and description case-insensitively', () => {
  assert.equal(searchBooks(sample, 'alpha').length, 1);
  assert.equal(searchBooks(sample, 'amy')[0].id, '2');
  assert.equal(searchBooks(sample, 'rome')[0].id, '3');
});

test('searchBooks with empty query returns all books', () => {
  assert.equal(searchBooks(sample, '').length, 3);
  assert.equal(searchBooks(sample, '   ').length, 3);
});

test('sortBooks by title is case-insensitive ascending', () => {
  const titles = sortBooks(sample, 'title', 'asc').map((b) => b.title);
  assert.deepEqual(titles, ['alpha', 'Beta', 'Gamma']);
});

test('sortBooks by rating descending puts unrated last', () => {
  const ids = sortBooks(sample, 'rating', 'desc').map((b) => b.id);
  assert.deepEqual(ids, ['2', '1', '3']);
});

test('sortBooks by date ascending', () => {
  const ids = sortBooks(sample, 'date', 'asc').map((b) => b.id);
  assert.deepEqual(ids, ['1', '3', '2']);
});

test('sortBooks does not mutate the input array', () => {
  const before = sample.map((b) => b.id);
  sortBooks(sample, 'title', 'desc');
  assert.deepEqual(sample.map((b) => b.id), before);
});

test('sortBooks ignores unknown sort keys', () => {
  assert.deepEqual(sortBooks(sample, 'nope').map((b) => b.id), ['1', '2', '3']);
});
