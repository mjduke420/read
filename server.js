import { access, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApp } from './src/app.js';
import { createCsvStore } from './src/csvStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dataFile = process.env.BOOKS_CSV ?? join(__dirname, 'data', 'books.csv');
const seedFile = join(__dirname, 'data', 'books.seed.csv');
const port = Number(process.env.PORT ?? 3000);

// On first run, populate the data file from the bundled seed so the grid is
// not empty. Never overwrites existing data.
async function seedIfMissing() {
  try {
    await access(dataFile, constants.F_OK);
  } catch {
    try {
      await copyFile(seedFile, dataFile, constants.COPYFILE_EXCL);
      console.log(`[reads] seeded ${dataFile} from ${seedFile}`);
    } catch {
      // No seed available or already created concurrently — fine, start empty.
    }
  }
}

await seedIfMissing();

const store = createCsvStore(dataFile);
const app = createApp(store);

app.listen(port, () => {
  console.log(`[reads] Reading List running on http://localhost:${port}`);
  console.log(`[reads] data file: ${dataFile}`);
});
