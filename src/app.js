import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createBooksRouter } from './routes.js';
import { createStatsRouter } from './statsRoutes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Builds the Express app around a store. Kept free of any I/O wiring so it can
 * be exercised directly in tests with an in-memory or temp-file store.
 */
export function createApp(store) {
  const app = express();
  app.use(express.json());

  app.use('/api/books', createBooksRouter(store));
  app.use('/api/stats', createStatsRouter(store));
  // Serve the frontend. `no-cache` forces browsers to revalidate against the
  // ETag every load, so a redeploy can never leave stale JS/CSS running.
  app.use(
    express.static(join(__dirname, '..', 'public'), {
      etag: true,
      lastModified: true,
      setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
    }),
  );

  // Centralized error handler — never leak internals to the client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    console.error('[reads] unhandled error:', err);
    res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  });

  return app;
}
