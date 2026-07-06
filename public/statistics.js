const STATUS = document.getElementById('stats-status');
const CONTENT = document.getElementById('stats-content');

const TYPE_LABELS = { book: '📖 Book', ebook: '📱 eBook', audiobook: '🎧 Audiobook' };

// Small DOM helper. Children may be strings (escaped via textContent) or nodes.
function el(tag, className, children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of [].concat(children ?? [])) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

async function main() {
  try {
    const res = await fetch('/api/stats');
    const body = await res.json();
    if (!body.success) throw new Error(body.error || 'Failed to load statistics');
    const stats = body.data;
    if (stats.total === 0) {
      STATUS.textContent = 'No books yet — add some from the Library to see statistics.';
      return;
    }
    render(stats);
    STATUS.classList.add('hidden');
    CONTENT.classList.remove('hidden');
  } catch (err) {
    STATUS.textContent = `Could not load statistics: ${err.message}`;
  }
}

function render(stats) {
  renderCards(stats);
  renderHeatmap(stats.dailyHeatmap);
  renderRatedList('best-rated', stats.bestRated);
  renderRatedList('worst-rated', stats.worstRated);
  renderLineChart('chart-rating-time', stats.ratingTimeline);
  renderVerticalBars('chart-year', yearEntries(stats.byYear));
  renderVerticalBars('chart-rating', ratingEntries(stats.byRating));
  renderHbars('chart-type', typeEntries(stats.byType), stats.total);
  renderHbars(
    'chart-challenge',
    stats.topChallenges.map((c) => ({ label: c.challenge, value: c.count })),
  );
  renderHbars(
    'authors',
    stats.topAuthors.map((a) => ({ label: a.author, value: a.count })),
  );
  renderWordCloud(stats.titleWords);
}

function card(value, label, accent) {
  return el('div', `stat-card${accent ? ` accent-${accent}` : ''}`, [
    el('div', 'stat-value', String(value)),
    el('div', 'stat-label', label),
  ]);
}

function renderCards(stats) {
  const pct = (n) => (stats.total ? Math.round((n / stats.total) * 100) : 0);
  const cards = [
    card(stats.total, 'Books logged'),
    card(stats.averageRating || '—', `Avg rating (${stats.ratedCount} rated)`, 'amber'),
    card(stats.distinctAuthors, 'Distinct authors', 'cyan'),
    card(`${pct(stats.readCount)}%`, `Finished (${stats.readCount})`, 'green'),
    card(`${pct(stats.dnfCount)}%`, `Did not finish (${stats.dnfCount})`, 'amber'),
    card(stats.spoilerCount, 'Marked spoilers', 'red'),
    card(stats.mostReadYear ?? '—', 'Most-read year', 'violet'),
    card(stats.longestStreak ?? 0, 'Longest streak (months)', 'cyan'),
    card(stats.currentStreak ?? 0, 'Current streak (months)', 'green'),
  ];
  document.getElementById('stat-cards').replaceChildren(...cards);
}

function yearEntries(byYear) {
  return Object.keys(byYear)
    .sort()
    .map((y) => ({ label: y, value: byYear[y] }));
}

function ratingEntries(byRating) {
  const scale = ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];
  const entries = scale.map((k) => ({ label: k, value: byRating[k] || 0 }));
  entries.push({ label: 'NR', value: byRating.unrated || 0 });
  return entries;
}

function typeEntries(byType) {
  return Object.keys(byType)
    .filter((t) => byType[t] > 0)
    .map((t) => ({ label: TYPE_LABELS[t] || t, value: byType[t] }))
    .sort((a, b) => b.value - a.value);
}

// Vertical bars: a row of columns scaled to the max value.
function renderVerticalBars(containerId, entries) {
  const container = document.getElementById(containerId);
  if (!entries.length) {
    container.replaceChildren(el('p', 'chart-empty', 'No data.'));
    return;
  }
  const max = Math.max(...entries.map((e) => e.value), 1);
  const cols = entries.map((e) => {
    const fill = el('div', 'bar-fill');
    fill.style.height = `${(e.value / max) * 100}%`;
    if (e.value === 0) fill.classList.add('bar-zero');
    return el('div', 'bar-col', [
      el('div', 'bar-value', e.value ? String(e.value) : ''),
      el('div', 'bar-track', fill),
      el('div', 'bar-label', e.label),
    ]);
  });
  container.replaceChildren(...cols);
}

// Horizontal bars: label, track+fill, value. Scaled to max (or a provided total).
function renderHbars(containerId, entries, scaleTo) {
  const container = document.getElementById(containerId);
  if (!entries.length) {
    container.replaceChildren(el('p', 'chart-empty', 'No data.'));
    return;
  }
  const max = Math.max(scaleTo || 0, ...entries.map((e) => e.value), 1);
  const rows = entries.map((e) => {
    const fill = el('div', 'hbar-fill');
    fill.style.width = `${(e.value / max) * 100}%`;
    return el('div', 'hbar-row', [
      el('div', 'hbar-label', e.label),
      el('div', 'hbar-track', fill),
      el('div', 'hbar-value', String(e.value)),
    ]);
  });
  container.replaceChildren(...rows);
}

// Ranked list of best/worst rated books.
function renderRatedList(containerId, items) {
  const container = document.getElementById(containerId);
  if (!items || !items.length) {
    container.replaceChildren(el('p', 'chart-empty', 'No rated books yet.'));
    return;
  }
  const rows = items.map((b, i) =>
    el('div', 'rated-item', [
      el('span', 'rated-rank', String(i + 1)),
      el('div', 'rated-info', [
        el('div', 'rated-title', b.title),
        el('div', 'rated-author', b.author),
      ]),
      el('span', 'rated-score', `${b.rating}★`),
    ]),
  );
  container.replaceChildren(...rows);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function heatColor(count, max) {
  return count === 0
    ? 'rgba(255,255,255,0.04)'
    : `rgba(139, 92, 246, ${(0.18 + (count / max) * 0.82).toFixed(3)})`;
}

// Daily heatmap: one calendar per year (12 month rows x 31 day columns), paged
// one year at a time so multiple years of data don't dominate the page.
let heatmapDaily = {};
let heatmapMax = 1;
let heatmapYears = []; // newest first
let heatmapYearIndex = 0;

function renderHeatmap(daily) {
  heatmapDaily = daily || {};
  const dates = Object.keys(heatmapDaily);
  const nav = document.getElementById('heat-year-nav');
  const container = document.getElementById('heatmap');
  if (!dates.length) {
    nav.classList.add('hidden');
    container.replaceChildren(el('p', 'chart-empty', 'No dated books yet.'));
    return;
  }
  heatmapMax = 1;
  for (const d of dates) heatmapMax = Math.max(heatmapMax, heatmapDaily[d]);
  heatmapYears = [...new Set(dates.map((d) => d.slice(0, 4)))].sort().reverse();
  heatmapYearIndex = 0; // default to the most recent year
  nav.classList.remove('hidden');
  renderHeatmapYear();
}

function renderHeatmapYear() {
  const container = document.getElementById('heatmap');
  const year = heatmapYears[heatmapYearIndex];
  const wrap = el('div', 'cal-wrap');
  wrap.append(buildYearGrid(Number(year), heatmapDaily, heatmapMax));
  wrap.append(buildLegend(heatmapMax));
  container.replaceChildren(wrap);

  document.getElementById('heat-year-label').textContent = year;
  // heatmapYears is newest -> oldest, so "prev" (older) increases the index
  // and "next" (newer) decreases it.
  document.getElementById('heat-prev-year').disabled = heatmapYearIndex >= heatmapYears.length - 1;
  document.getElementById('heat-next-year').disabled = heatmapYearIndex <= 0;
}

document.getElementById('heat-prev-year').addEventListener('click', () => {
  if (heatmapYearIndex < heatmapYears.length - 1) {
    heatmapYearIndex += 1;
    renderHeatmapYear();
  }
});
document.getElementById('heat-next-year').addEventListener('click', () => {
  if (heatmapYearIndex > 0) {
    heatmapYearIndex -= 1;
    renderHeatmapYear();
  }
});

function buildYearGrid(year, daily, max) {
  const prefix = `${year}-`;
  const yearTotal = Object.keys(daily)
    .filter((d) => d.startsWith(prefix))
    .reduce((sum, d) => sum + daily[d], 0);

  const section = el('section', 'cal-year', [
    el('div', 'cal-title', [
      String(year),
      el('span', 'cal-count', ` · ${yearTotal} book${yearTotal === 1 ? '' : 's'}`),
    ]),
  ]);

  const grid = el('div', 'day-grid');
  // Header row: corner + day-of-month numbers (labelled at 1 and every 5th).
  grid.append(el('div', 'day-corner', ''));
  for (let d = 1; d <= 31; d += 1) {
    grid.append(el('div', 'day-num', d === 1 || d % 5 === 0 ? String(d) : ''));
  }
  // One row per month.
  for (let m = 0; m < 12; m += 1) {
    grid.append(el('div', 'day-mon', MONTH_NAMES[m]));
    const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    for (let d = 1; d <= 31; d += 1) {
      if (d > daysInMonth) {
        grid.append(el('div', 'day-cell day-na', ''));
        continue;
      }
      const key = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const count = daily[key] || 0;
      const cell = el('div', 'day-cell', '');
      cell.style.background = heatColor(count, max);
      cell.title = `${key}: ${count} book${count === 1 ? '' : 's'}`;
      grid.append(cell);
    }
  }
  section.append(grid);
  return section;
}

function buildLegend(max) {
  const legend = el('div', 'cal-legend', [el('span', 'cal-legend-label', 'Less')]);
  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    const sw = el('span', 'cal-legend-cell', '');
    sw.style.background = heatColor(frac === 0 ? 0 : Math.max(1, Math.round(frac * max)), max);
    legend.append(sw);
  }
  legend.append(el('span', 'cal-legend-label', 'More'));
  return legend;
}

function renderWordCloud(words) {
  const container = document.getElementById('wordcloud');
  if (!words.length) {
    container.replaceChildren(el('p', 'chart-empty', 'Not enough title words yet.'));
    return;
  }
  const counts = words.map((w) => w.count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const span = max - min || 1;
  const items = words.map((w) => {
    const size = 0.85 + ((w.count - min) / span) * 1.75; // rem
    const node = el('span', 'word', w.word);
    node.style.fontSize = `${size.toFixed(2)}rem`;
    node.style.opacity = `${(0.55 + ((w.count - min) / span) * 0.45).toFixed(2)}`;
    node.title = `${w.word}: ${w.count}`;
    return node;
  });
  container.replaceChildren(...items);
}

// SVG line chart of average rating (0-5) over time. All values are numbers or
// digit-only year strings, so building the SVG markup directly is injection-safe.
function renderLineChart(containerId, points) {
  const container = document.getElementById(containerId);
  if (!points || points.length === 0) {
    container.replaceChildren(el('p', 'chart-empty', 'No rated books yet.'));
    return;
  }
  const W = 640;
  const H = 240;
  const padL = 30;
  const padR = 18;
  const padT = 22;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = points.length;
  const xAt = (i) => (n === 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW);
  const yAt = (v) => padT + innerH - (v / 5) * innerH;

  let grid = '';
  for (let g = 1; g <= 5; g += 1) {
    const gy = yAt(g).toFixed(1);
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" class="lc-grid"/>`;
    grid += `<text x="${padL - 6}" y="${(yAt(g) + 3).toFixed(1)}" class="lc-axis" text-anchor="end">${g}</text>`;
  }

  const coords = points.map((p, i) => [xAt(i), yAt(p.average)]);
  const line =
    n > 1
      ? `<polyline points="${coords.map((c) => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ')}" class="lc-line"/>`
      : '';
  const dots = coords
    .map((c, i) => {
      const cx = c[0].toFixed(1);
      const cy = c[1].toFixed(1);
      return (
        `<circle cx="${cx}" cy="${cy}" r="4" class="lc-dot"/>` +
        `<text x="${cx}" y="${(c[1] - 10).toFixed(1)}" class="lc-val" text-anchor="middle">${points[i].average}</text>` +
        `<text x="${cx}" y="${H - 10}" class="lc-axis" text-anchor="middle">${points[i].label || points[i].period}</text>`
      );
    })
    .join('');

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="line-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Average rating over time">${grid}${line}${dots}</svg>`;
}

main();
