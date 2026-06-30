// Aggregate statistics over the book collection. Pure and side-effect free so
// it can be unit-tested directly and reused by the /api/stats route.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'to', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were', 'be', 'as', 'it',
  'its', 'that', 'this', 'or', 'but', 'not', 'no', 'your', 'you', 'my', 'our', 'his',
  'her', 'their', 'vol', 'part', 'book', 'how', 'what', 'why', 'who',
]);

/** Splits a title into meaningful lowercase words (drops stopwords/short/numeric). */
function tokenize(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * @param {Array<object>} books
 * @returns {object} aggregate stats for the statistics page
 */
export function computeStats(books) {
  const total = books.length;
  let ratingSum = 0;
  let ratedCount = 0;
  let readCount = 0;
  let dnfCount = 0;
  let spoilerCount = 0;

  const byType = { book: 0, ebook: 0, audiobook: 0 };
  const byRating = {}; // '0.5'..'5' plus 'unrated'
  const byYear = {}; // 'YYYY' -> count
  const heatmap = {}; // 'YYYY' -> number[12] (one per month)
  const authorCounts = new Map();
  const wordCounts = new Map();
  const ratingByYear = {}; // year -> { sum, count } of rated books
  const monthSet = new Set(); // distinct (year*12 + monthIndex) with activity

  for (const b of books) {
    if (b.rating == null) {
      byRating.unrated = (byRating.unrated || 0) + 1;
    } else {
      ratingSum += b.rating;
      ratedCount += 1;
      const key = String(b.rating);
      byRating[key] = (byRating[key] || 0) + 1;
    }

    if (b.dnf) dnfCount += 1;
    else readCount += 1;
    if (b.spoilers) spoilerCount += 1;
    if (byType[b.type] != null) byType[b.type] += 1;

    const date = String(b.date || '');
    const year = date.slice(0, 4);
    const month = Number(date.slice(5, 7));
    if (/^\d{4}$/.test(year)) {
      byYear[year] = (byYear[year] || 0) + 1;
      if (!heatmap[year]) heatmap[year] = new Array(12).fill(0);
      if (month >= 1 && month <= 12) {
        heatmap[year][month - 1] += 1;
        monthSet.add(Number(year) * 12 + (month - 1));
      }
      if (b.rating != null) {
        if (!ratingByYear[year]) ratingByYear[year] = { sum: 0, count: 0 };
        ratingByYear[year].sum += b.rating;
        ratingByYear[year].count += 1;
      }
    }

    const author = String(b.author || '').trim();
    if (author) authorCounts.set(author, (authorCounts.get(author) || 0) + 1);

    for (const w of tokenize(b.title)) {
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    }
  }

  const averageRating = ratedCount ? Math.round((ratingSum / ratedCount) * 10) / 10 : 0;
  const years = Object.keys(byYear).sort();
  const mostReadYear = years.reduce(
    (best, y) => (byYear[y] > (byYear[best] ?? -1) ? y : best),
    years[0] ?? null,
  );

  const topAuthors = [...authorCounts.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author))
    .slice(0, 10);

  const titleWords = [...wordCounts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 40);

  const ratingTimeline = Object.keys(ratingByYear)
    .sort()
    .map((y) => ({
      period: y,
      average: Math.round((ratingByYear[y].sum / ratingByYear[y].count) * 10) / 10,
      count: ratingByYear[y].count,
    }));

  const { longest: longestStreak, current: currentStreak } = monthStreaks(monthSet);

  return {
    total,
    averageRating,
    ratedCount,
    readCount,
    dnfCount,
    spoilerCount,
    distinctAuthors: authorCounts.size,
    mostReadYear,
    byType,
    byRating,
    byYear,
    heatmap,
    topAuthors,
    titleWords,
    ratingTimeline,
    longestStreak,
    currentStreak,
  };
}

/**
 * Longest and current run of consecutive calendar months with activity.
 * `monthSet` holds integer indices (year*12 + monthIndex).
 */
function monthStreaks(monthSet) {
  const months = [...monthSet].sort((a, b) => a - b);
  if (months.length === 0) return { longest: 0, current: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < months.length; i += 1) {
    run = months[i] === months[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  let current = 1;
  for (let i = months.length - 1; i > 0; i -= 1) {
    if (months[i] === months[i - 1] + 1) current += 1;
    else break;
  }
  return { longest, current };
}
