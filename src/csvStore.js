import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// Canonical column order persisted to disk. `id` is added on top of the
// user-facing fields so books can be addressed for delete/edit later.
export const COLUMNS = ['id', 'title', 'author', 'date', 'rating', 'type', 'description'];

// Allowed media types. Rows missing/invalid `type` fall back to 'book' so
// CSV files written before this column existed remain valid.
const TYPES = ['book', 'ebook', 'audiobook'];

/**
 * Repository for the books CSV file.
 *
 * Provides immutable reads and an atomic, serialized `update()` so that
 * concurrent writes (e.g. two requests at once) can never lose data or
 * corrupt the file mid-write.
 */
export function createCsvStore(filePath) {
  // Serializes read-modify-write cycles to avoid lost updates.
  let chain = Promise.resolve();

  async function readAll() {
    let raw;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    if (raw.trim() === '') return [];
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // tolerate a UTF-8 BOM from hand-edited files (e.g. Notepad)
    });
    return records.map(normalizeRecord);
  }

  async function writeAll(books) {
    const rows = books.map((b) => COLUMNS.map((c) => formatField(b[c])));
    const csv = stringify(rows, { header: true, columns: COLUMNS });
    await mkdir(dirname(filePath), { recursive: true });
    // Write to a temp file then rename: rename is atomic on the same volume,
    // so a crash can never leave a half-written CSV behind.
    const tmp = `${filePath}.${process.pid}.tmp`;
    await writeFile(tmp, csv, 'utf8');
    await rename(tmp, filePath);
    return books;
  }

  /**
   * Serialized read-modify-write. `mutator` receives the current books and
   * returns (or resolves to) the next state to persist.
   */
  function update(mutator) {
    const run = chain.then(async () => {
      const current = await readAll();
      const next = await mutator(current);
      return writeAll(next);
    });
    // Keep the chain alive even if this update rejects.
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return { readAll, writeAll, update };
}

function normalizeRecord(rec) {
  const rating = rec.rating == null || String(rec.rating).trim() === '' ? null : Number(rec.rating);
  const type = String(rec.type ?? '').trim().toLowerCase();
  return {
    id: rec.id ?? '',
    title: rec.title ?? '',
    author: rec.author ?? '',
    date: rec.date ?? '',
    rating: Number.isFinite(rating) ? rating : null,
    type: TYPES.includes(type) ? type : 'book',
    description: rec.description ?? '',
  };
}

function formatField(value) {
  if (value == null) return '';
  return String(value);
}
