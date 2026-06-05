import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createCsvStore } from '../src/csvStore.js';

let dir;
let app;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'reads-api-'));
  app = createApp(createCsvStore(join(dir, 'books.csv')));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test('GET /api/books returns an empty list initially', async () => {
  const res = await request(app).get('/api/books');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data, []);
});

test('POST /api/books creates a book and GET returns it', async () => {
  const res = await request(app)
    .post('/api/books')
    .send({ title: 'Dune', author: 'Herbert', date: '2024-02-01', rating: 5, description: 'Sci-fi epic' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.title, 'Dune');
  assert.ok(res.body.data.id);

  const list = await request(app).get('/api/books');
  assert.equal(list.body.data.length, 1);
});

test('POST /api/books rejects missing title with 400', async () => {
  const res = await request(app).post('/api/books').send({ author: 'Nobody' });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /Title is required/);
});

test('GET supports search filtering', async () => {
  await request(app).post('/api/books').send({ title: 'Dune', author: 'Herbert' });
  await request(app).post('/api/books').send({ title: 'Hyperion', author: 'Simmons' });

  const res = await request(app).get('/api/books').query({ search: 'hyper' });
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].title, 'Hyperion');
});

test('GET supports sorting by title descending', async () => {
  await request(app).post('/api/books').send({ title: 'Alpha', author: 'A' });
  await request(app).post('/api/books').send({ title: 'Zeta', author: 'Z' });

  const res = await request(app).get('/api/books').query({ sort: 'title', order: 'desc' });
  assert.deepEqual(res.body.data.map((b) => b.title), ['Zeta', 'Alpha']);
});

test('DELETE removes a book', async () => {
  const created = await request(app).post('/api/books').send({ title: 'Temp', author: 'A' });
  const id = created.body.data.id;

  const del = await request(app).delete(`/api/books/${id}`);
  assert.equal(del.status, 200);

  const list = await request(app).get('/api/books');
  assert.equal(list.body.data.length, 0);
});

test('DELETE of an unknown id returns 404', async () => {
  const res = await request(app).delete('/api/books/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});
