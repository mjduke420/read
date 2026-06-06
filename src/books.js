import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validation at the system boundary. Anything that reaches createBook() has
// already been shape-checked and trimmed here.
export const BookInputSchema = z.object({
  title: z
    .string({ required_error: 'Title is required', invalid_type_error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(500),
  author: z
    .string({ required_error: 'Author is required', invalid_type_error: 'Author is required' })
    .trim()
    .min(1, 'Author is required')
    .max(300),
  date: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((v) => v === '' || DATE_RE.test(v), 'Date must be in YYYY-MM-DD format'),
  // Empty string / null / undefined all mean "unrated" -> null.
  // Allowed in half-star steps: 0, 0.5, 1, ... 5.
  rating: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce
      .number()
      .min(0)
      .max(5)
      .multipleOf(0.5, 'Rating must be in steps of 0.5')
      .optional(),
  ),
  // Media type. Missing/blank defaults to 'book'.
  type: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return v;
      const t = v.trim().toLowerCase();
      return t === '' ? undefined : t;
    },
    z
      .enum(['book', 'ebook', 'audiobook'], {
        errorMap: () => ({ message: 'Type must be book, ebook or audiobook' }),
      })
      .optional()
      .default('book'),
  ),
  // "Did not finish" flag. Accepts checkbox/string/boolean truthy forms;
  // anything else (including missing) means false (Read).
  dnf: z.preprocess(
    (v) => v === true || v === 'true' || v === 'on' || v === '1' || v === 'yes',
    z.boolean(),
  ),
  description: z.string().trim().max(5000).optional().default(''),
});

/**
 * Validates raw input and returns the normalized book fields (no id).
 * Never mutates the input. Throws ZodError on invalid input.
 */
export function buildBookFields(input) {
  const parsed = BookInputSchema.parse(input ?? {});
  return {
    title: parsed.title,
    author: parsed.author,
    date: parsed.date && parsed.date !== '' ? parsed.date : today(),
    rating: parsed.rating ?? null,
    type: parsed.type ?? 'book',
    dnf: parsed.dnf ?? false,
    description: parsed.description ?? '',
  };
}

/** Builds a brand-new book record with a fresh id. */
export function createBook(input) {
  return { id: randomUUID(), ...buildBookFields(input) };
}

/** Builds an updated book record, preserving the existing id. */
export function updateBook(id, input) {
  return { id, ...buildBookFields(input) };
}

const SEARCH_FIELDS = ['title', 'author', 'description', 'type'];

/** Case-insensitive substring search across title, author and description. */
export function searchBooks(books, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return books;
  return books.filter((book) =>
    SEARCH_FIELDS.some((field) => String(book[field] ?? '').toLowerCase().includes(q)),
  );
}

export const SORT_KEYS = new Set(['title', 'author', 'date', 'rating', 'type', 'dnf']);

/** Returns a new sorted array; never mutates the input. */
export function sortBooks(books, sortKey, order = 'asc') {
  if (!SORT_KEYS.has(sortKey)) return books;
  const dir = order === 'desc' ? -1 : 1;
  return [...books].sort((a, b) => compare(a, b, sortKey) * dir);
}

function compare(a, b, key) {
  if (key === 'rating') {
    // Unrated books sort below any rated book.
    return (a.rating ?? -1) - (b.rating ?? -1);
  }
  if (key === 'dnf') {
    // Read (false) before DNF (true) when ascending.
    return (a.dnf ? 1 : 0) - (b.dnf ? 1 : 0);
  }
  if (key === 'date') {
    // ISO YYYY-MM-DD sorts correctly as plain strings.
    return String(a.date).localeCompare(String(b.date));
  }
  return String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, {
    sensitivity: 'base',
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

/**
 * Slices an array into a page. Tolerant of bad input: clamps the page into
 * range and the limit to [1, MAX_PAGE_SIZE]. Returns the page plus metadata.
 */
export function paginate(items, { page, limit } = {}) {
  const rawLimit = Number(limit);
  const safeLimit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  const rawPage = Number(page);
  const safePage = Number.isFinite(rawPage)
    ? Math.min(Math.max(1, Math.floor(rawPage)), totalPages)
    : 1;

  const start = (safePage - 1) * safeLimit;
  return {
    data: items.slice(start, start + safeLimit),
    meta: { total, page: safePage, limit: safeLimit, totalPages },
  };
}
