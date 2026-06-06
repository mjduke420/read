import { Router } from 'express';
import { z } from 'zod';
import { createBook, searchBooks, sortBooks, paginate } from './books.js';

// Consistent response envelope: { success, data, error[, meta] }.
const ok = (data, meta) => ({ success: true, data, error: null, ...(meta ? { meta } : {}) });
const fail = (error) => ({ success: false, data: null, error });

export function createBooksRouter(store) {
  const router = Router();

  // GET /api/books?search=&sort=&order=asc|desc&page=&limit=
  router.get('/', async (req, res, next) => {
    try {
      const all = await store.readAll();
      const filtered = searchBooks(all, req.query.search);
      const sorted = sortBooks(filtered, req.query.sort, req.query.order);
      const { data, meta } = paginate(sorted, { page: req.query.page, limit: req.query.limit });
      res.json(ok(data, meta));
    } catch (err) {
      next(err);
    }
  });

  // POST /api/books  { title, author, date?, rating?, description? }
  router.post('/', async (req, res, next) => {
    let book;
    try {
      book = createBook(req.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json(fail(err.issues.map((i) => i.message).join('; ')));
      }
      return next(err);
    }
    try {
      await store.update((all) => [...all, book]);
      res.status(201).json(ok(book));
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/books/:id
  router.delete('/:id', async (req, res, next) => {
    try {
      await store.update((all) => {
        if (!all.some((b) => b.id === req.params.id)) {
          const e = new Error('Book not found');
          e.status = 404;
          throw e;
        }
        return all.filter((b) => b.id !== req.params.id);
      });
      res.json(ok({ id: req.params.id }));
    } catch (err) {
      if (err.status === 404) return res.status(404).json(fail(err.message));
      next(err);
    }
  });

  return router;
}
