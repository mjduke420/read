import { Router } from 'express';
import { computeStats } from './stats.js';

// GET /api/stats -> aggregate statistics over the whole collection.
export function createStatsRouter(store) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const all = await store.readAll();
      res.json({ success: true, data: computeStats(all), error: null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
