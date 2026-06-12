import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBook, updateBook, searchBooks, sortBooks, paginate, BookInputSchema } from '../src/books.js';

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

test('createBook defaults type to book when omitted', () => {
  const book = createBook({ title: 'X', author: 'Y' });
  assert.equal(book.type, 'book');
});

test('createBook accepts and normalizes a valid type', () => {
  assert.equal(createBook({ title: 'X', author: 'Y', type: 'audiobook' }).type, 'audiobook');
  assert.equal(createBook({ title: 'X', author: 'Y', type: ' Ebook ' }).type, 'ebook');
});

test('updateBook keeps the given id and applies validated fields', () => {
  const updated = updateBook('keep-id', {
    title: '  New Title ',
    author: 'A',
    rating: '3.5',
    type: 'ebook',
    dnf: 'on',
  });
  assert.equal(updated.id, 'keep-id');
  assert.equal(updated.title, 'New Title');
  assert.equal(updated.rating, 3.5);
  assert.equal(updated.type, 'ebook');
  assert.equal(updated.dnf, true);
});

test('updateBook rejects invalid input (missing title)', () => {
  assert.throws(() => updateBook('x', { author: 'A' }), /Title is required/);
});

test('createBook defaults dnf to false (Read)', () => {
  assert.equal(createBook({ title: 'X', author: 'Y' }).dnf, false);
});

test('createBook coerces checkbox/string truthy values for dnf', () => {
  assert.equal(createBook({ title: 'X', author: 'Y', dnf: 'on' }).dnf, true);
  assert.equal(createBook({ title: 'X', author: 'Y', dnf: true }).dnf, true);
  assert.equal(createBook({ title: 'X', author: 'Y', dnf: 'false' }).dnf, false);
});

test('createBook rejects an invalid type', () => {
  assert.throws(
    () => createBook({ title: 'X', author: 'Y', type: 'scroll' }),
    /Type must be book, ebook or audiobook/,
  );
});

test('createBook rejects missing title', () => {
  assert.throws(() => createBook({ author: 'Y' }), /Title is required/);
});

test('createBook rejects out-of-range rating', () => {
  assert.throws(() => createBook({ title: 'X', author: 'Y', rating: '9' }));
});

test('createBook accepts a half-star rating', () => {
  assert.equal(createBook({ title: 'X', author: 'Y', rating: '4.5' }).rating, 4.5);
});

test('createBook rejects a rating that is not a half step', () => {
  assert.throws(
    () => createBook({ title: 'X', author: 'Y', rating: '4.3' }),
    /steps of 0\.5/,
  );
});

test('createBook rejects a malformed date', () => {
  assert.throws(() => createBook({ title: 'X', author: 'Y', date: '02/01/2024' }), /YYYY-MM-DD/);
});

test('BookInputSchema is reusable for validation', () => {
  const result = BookInputSchema.safeParse({ title: 'A', author: 'B' });
  assert.equal(result.success, true);
});

const sample = [
  { id: '1', title: 'Beta', author: 'Zoe', date: '2024-01-01', rating: 3, type: 'ebook', description: 'space opera' },
  { id: '2', title: 'alpha', author: 'Amy', date: '2024-03-01', rating: 5, type: 'audiobook', description: 'a cooking memoir' },
  { id: '3', title: 'Gamma', author: 'Mike', date: '2024-02-01', rating: null, type: 'book', description: 'history of Rome' },
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

test('sortBooks by type ascending (audiobook, book, ebook)', () => {
  const ids = sortBooks(sample, 'type', 'asc').map((b) => b.id);
  assert.deepEqual(ids, ['2', '3', '1']);
});

test('sortBooks by dnf puts Read before DNF ascending', () => {
  const items = [
    { id: 'a', dnf: true },
    { id: 'b', dnf: false },
    { id: 'c', dnf: true },
  ];
  assert.deepEqual(sortBooks(items, 'dnf', 'asc').map((b) => b.id), ['b', 'a', 'c']);
});

test('searchBooks matches on type', () => {
  const res = searchBooks(sample, 'audiobook');
  assert.equal(res.length, 1);
  assert.equal(res[0].id, '2');
});

test('searchBooks matches the year the book was read', () => {
  // All sample books have 2024-* read dates.
  assert.equal(searchBooks(sample, '2024').length, 3);
  // A partial date narrows to the single March record.
  assert.deepEqual(searchBooks(sample, '2024-03').map((b) => b.id), ['2']);
  // A year with no matches returns nothing.
  assert.equal(searchBooks(sample, '2030').length, 0);
});

test('sortBooks does not mutate the input array', () => {
  const before = sample.map((b) => b.id);
  sortBooks(sample, 'title', 'desc');
  assert.deepEqual(sample.map((b) => b.id), before);
});

test('sortBooks ignores unknown sort keys', () => {
  assert.deepEqual(sortBooks(sample, 'nope').map((b) => b.id), ['1', '2', '3']);
});

const many = Array.from({ length: 95 }, (_, i) => ({ id: String(i) }));

test('paginate returns the requested page and metadata', () => {
  const { data, meta } = paginate(many, { page: 2, limit: 25 });
  assert.equal(data.length, 25);
  assert.equal(data[0].id, '25');
  assert.deepEqual(meta, { total: 95, page: 2, limit: 25, totalPages: 4 });
});

test('paginate returns a short final page', () => {
  const { data, meta } = paginate(many, { page: 4, limit: 25 });
  assert.equal(data.length, 20); // 95 - 75
  assert.equal(meta.page, 4);
});

test('paginate clamps an out-of-range page to the last page', () => {
  const { data, meta } = paginate(many, { page: 999, limit: 25 });
  assert.equal(meta.page, 4);
  assert.equal(data[0].id, '75');
});

test('paginate clamps page below 1 and bad input to page 1', () => {
  assert.equal(paginate(many, { page: 0, limit: 25 }).meta.page, 1);
  assert.equal(paginate(many, { page: 'abc', limit: 25 }).meta.page, 1);
});

test('paginate falls back to the default size when limit is invalid', () => {
  const { data, meta } = paginate(many, { page: 1, limit: 'nope' });
  assert.equal(meta.limit, 25);
  assert.equal(data.length, 25);
});

test('paginate reports totalPages = 1 for an empty list', () => {
  const { data, meta } = paginate([], { page: 1, limit: 25 });
  assert.deepEqual(data, []);
  assert.deepEqual(meta, { total: 0, page: 1, limit: 25, totalPages: 1 });
});
