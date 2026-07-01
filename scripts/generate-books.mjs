// Generate stress-test books and append them to the CSV data file.
//
//   node scripts/generate-books.mjs [count]
//   BOOKS_CSV=/path/to/books.csv node scripts/generate-books.mjs 400
//
// Default count is 400. Writes through the same store/validation the app uses.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createCsvStore } from '../src/csvStore.js';
import { createBook } from '../src/books.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.BOOKS_CSV ?? join(__dirname, '..', 'data', 'books.csv');
const count = Number.parseInt(process.argv[2] ?? '400', 10);

const adjectives = ['Silent', 'Crimson', 'Hidden', 'Broken', 'Golden', 'Last', 'First', 'Wandering', 'Frozen', 'Burning', 'Quiet', 'Distant', 'Hollow', 'Endless', 'Forgotten'];
const nouns = ['Garden', 'Empire', 'Machine', 'Voyage', 'Shadow', 'Cipher', 'Harbor', 'Comet', 'Lantern', 'Echo', 'Foundation', 'Horizon', 'Compass', 'Archive', 'Tempest'];
const firstNames = ['Ava', 'Liam', 'Noah', 'Mia', 'Kai', 'Zoe', 'Eli', 'Nora', 'Owen', 'Iris', 'Leo', 'Maya'];
const lastNames = ['Reyes', 'Okafor', 'Tanaka', 'Novak', 'Haidar', 'Sorensen', 'Mbeki', 'Costa', 'Singh', 'Lindqvist'];
const types = ['book', 'ebook', 'audiobook'];
const ratings = ['', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];
// Mostly empty so filtering by challenge is meaningful.
const challenges = ['', '', '', '', 'Book Riot 2026', 'PopSugar 2025', 'Sci-Fi Summer', '52 Books in 52 Weeks'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function randomDate() {
  const start = new Date(2018, 0, 1).getTime();
  const end = Date.now();
  return new Date(start + Math.random() * (end - start)).toISOString().slice(0, 10);
}

const store = createCsvStore(dataFile);
const existing = await store.readAll();

const generated = Array.from({ length: count }, (_, i) =>
  createBook({
    title: `${pick(adjectives)} ${pick(nouns)} #${i + 1}`,
    author: `${pick(firstNames)} ${pick(lastNames)}`,
    date: randomDate(),
    rating: pick(ratings),
    type: pick(types),
    challenge: pick(challenges),
    dnf: Math.random() < 0.25, // ~1 in 4 marked did-not-finish
    spoilers: Math.random() < 0.3, // ~3 in 10 contain spoilers
    description: `Stress-test entry ${i + 1}. ${pick(adjectives)} ${pick(nouns).toLowerCase()} meets ${pick(adjectives).toLowerCase()} ${pick(nouns).toLowerCase()} in a tale of ${pick(nouns).toLowerCase()}s.`,
  }),
);

await store.writeAll([...existing, ...generated]);
console.log(`Added ${count} books (total now ${existing.length + count}) -> ${dataFile}`);
