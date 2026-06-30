const STATUS = document.getElementById('stats-status');
const CONTENT = document.getElementById('stats-content');

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
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
  renderHeatmap(stats.heatmap);
  renderLineChart('chart-rating-time', stats.ratingTimeline);
  renderVerticalBars('chart-year', yearEntries(stats.byYear));
  renderVerticalBars('chart-rating', ratingEntries(stats.byRating));
  renderHbars('chart-type', typeEntries(stats.byType), stats.total);
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

// Calendar-style heatmap: one row per year, one cell per month.
function renderHeatmap(heatmap) {
  const container = document.getElementById('heatmap');
  const years = Object.keys(heatmap).sort();
  if (!years.length) {
    container.replaceChildren(el('p', 'chart-empty', 'No dated books yet.'));
    return;
  }
  let max = 1;
  for (const y of years) max = Math.max(max, ...heatmap[y]);

  const grid = el('div', 'heatmap-grid');
  grid.append(el('div', 'heat-corner', ''));
  for (const m of MONTHS) grid.append(el('div', 'heat-month', m));
  for (const y of years) {
    grid.append(el('div', 'heat-year', y));
    heatmap[y].forEach((count, i) => {
      const cell = el('div', 'heat-cell', '');
      const intensity = count / max;
      cell.style.background =
        count === 0 ? 'rgba(255,255,255,0.04)' : `rgba(139, 92, 246, ${0.18 + intensity * 0.82})`;
      cell.title = `${y}-${String(i + 1).padStart(2, '0')}: ${count} book${count === 1 ? '' : 's'}`;
      grid.append(cell);
    });
  }
  container.replaceChildren(grid);
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
