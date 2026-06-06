# 📚 Reading List

A small, self-hostable web app for keeping track of the books you've read.
Data is stored in a plain **CSV file** (`Title, Author, Date, Rating, Description`)
so it stays portable and easy to back up or edit by hand.

## Features

- **Add books** via a validated form (title, author, date, 0–5 rating, description)
- **Search** across title, author and description
- **Sortable grid** — sort by date, title, author or rating, ascending or descending
- **Delete** books you no longer want
- **CSV-backed** storage with atomic, crash-safe writes
- Clean REST API (`/api/books`) decoupled from the frontend

## Screenshot

## Tech stack

- **Backend:** Node.js + Express, `csv-parse` / `csv-stringify`, `zod` validation
- **Frontend:** vanilla HTML/CSS/JS (no build step)
- **Tests:** Node's built-in test runner + `supertest`
- **Deploy:** Dockerfile with a `/data` volume for the CSV

## Getting started (local)

```bash
npm install
npm start
# → http://localhost:3000
```

On first run the app seeds `data/books.csv` from `data/books.seed.csv` so the
grid isn't empty. Your live data file (`data/books.csv`) is git-ignored.

Develop with auto-reload:

```bash
npm run dev
```

Run the test suite:

```bash
npm test
```

## Configuration

Copy `.env.example` to `.env` (or set the variables in your host):

| Variable    | Default            | Description                       |
| ----------- | ------------------ | --------------------------------- |
| `PORT`      | `3000`             | Port the server listens on        |
| `BOOKS_CSV` | `./data/books.csv` | Path to the CSV data file         |

## REST API

All responses use the envelope `{ success, data, error }`.

| Method   | Path              | Body / Query                                            |
| -------- | ----------------- | ------------------------------------------------------- |
| `GET`    | `/api/books`      | `?search=&sort=date\|title\|author\|rating\|type&order=asc\|desc` |
| `POST`   | `/api/books`      | `{ title*, author*, date?, rating?, type?, description? }` |
| `DELETE` | `/api/books/:id`  | —                                                       |

`*` required. `date` is `YYYY-MM-DD` (defaults to today). `rating` is `0`–`5` in half-star steps (e.g. `4.5`) or empty for unrated. `type` is `book`, `ebook` or `audiobook` (defaults to `book`).

## Deploy with Docker

```bash
docker build -t reads .
docker run -d -p 3000:3000 -v reads_data:/data --name reads reads
```

The CSV lives on the `reads_data` named volume (mounted at `/data`), so your
reading list survives container rebuilds and restarts. Point any host
(Railway, Render, Fly.io, a VPS) at this image and attach a persistent volume
at `/data`.

## Data model

Each row in the CSV:

| Column        | Notes                                          |
| ------------- | ---------------------------------------------- |
| `id`          | UUID, generated on insert (enables delete/edit) |
| `title`       | required                                       |
| `author`      | required                                       |
| `date`        | `YYYY-MM-DD`                                    |
| `rating`      | `0`–`5`, blank = unrated                        |
| `type`        | `book`, `ebook` or `audiobook` (defaults to `book`) |
| `description` | free text (commas/quotes/newlines are safe)    |

## Project layout

```
server.js            # entry: seeds data, wires store + app, listens
src/app.js           # Express app factory (testable)
src/csvStore.js      # CSV repository: atomic, serialized read/write
src/books.js         # domain: zod validation, search, sort
src/routes.js        # REST API
public/              # frontend (index.html, styles.css, app.js)
data/books.seed.csv  # seed data copied to books.csv on first run
tests/               # unit + API tests
```
