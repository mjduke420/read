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
  rating: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().int('Rating must be a whole number').min(0).max(5).optional(),
  ),
  description: z.string().trim().max(5000).optional().default(''),
});

/**
 * Validates raw input and returns a brand-new, fully-formed book record.
 * Never mutates the input. Throws ZodError on invalid input.
 */
export function createBook(input) {
  const parsed = BookInputSchema.parse(input ?? {});
  return {
    id: randomUUID(),
    title: parsed.title,
    author: parsed.author,
    date: parsed.date && parsed.date !== '' ? parsed.date : today(),
    rating: parsed.rating ?? null,
    description: parsed.description ?? '',
  };
}

const SEARCH_FIELDS = ['title', 'author', 'description'];

/** Case-insensitive substring search across title, author and description. */
export function searchBooks(books, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return books;
  return books.filter((book) =>
    SEARCH_FIELDS.some((field) => String(book[field] ?? '').toLowerCase().includes(q)),
  );
}

export const SORT_KEYS = new Set(['title', 'author', 'date', 'rating']);

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
