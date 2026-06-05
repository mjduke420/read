const API = '/api/books';

const els = {
  form: document.getElementById('add-form'),
  formMsg: document.getElementById('form-msg'),
  search: document.getElementById('search'),
  table: document.getElementById('book-table'),
  tbody: document.getElementById('tbody'),
  count: document.getElementById('count'),
  empty: document.getElementById('empty'),
  headers: document.querySelectorAll('#book-table th[data-key]'),
};

// UI state. Always replaced, never mutated in place.
let state = { search: '', sort: 'date', order: 'desc' };

function setState(patch) {
  state = { ...state, ...patch };
}

const TYPE_LABELS = {
  book: '📖 Book',
  ebook: '📱 eBook',
  audiobook: '🎧 Audiobook',
};

async function load() {
  const params = new URLSearchParams({
    search: state.search,
    sort: state.sort,
    order: state.order,
  });
  try {
    const res = await fetch(`${API}?${params}`);
    const body = await res.json();
    if (!body.success) throw new Error(body.error || 'Failed to load books');
    render(body.data);
  } catch (err) {
    els.tbody.innerHTML = '';
    els.count.textContent = `Could not load books: ${err.message}`;
  }
  updateHeaders();
}

function render(books) {
  els.tbody.innerHTML = '';
  const isEmpty = books.length === 0;
  els.empty.classList.toggle('hidden', !isEmpty);
  els.table.classList.toggle('hidden', isEmpty);
  els.count.textContent = books.length === 1 ? '1 book' : `${books.length} books`;
  for (const book of books) {
    els.tbody.appendChild(row(book));
  }
}

function row(book) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="col-title"></td>
    <td class="col-author"></td>
    <td class="col-type"><span class="type-badge"></span></td>
    <td class="col-date"></td>
    <td class="col-rating"></td>
    <td class="col-desc"><div class="desc-clamp"></div></td>
    <td class="col-actions"><button class="row-delete" title="Delete" aria-label="Delete book">✕</button></td>
  `;

  // User content goes through textContent to avoid any HTML injection.
  tr.querySelector('.col-title').textContent = book.title;
  tr.querySelector('.col-author').textContent = book.author;
  tr.querySelector('.type-badge').textContent = TYPE_LABELS[book.type] ?? TYPE_LABELS.book;
  tr.querySelector('.col-date').textContent = book.date || '';

  const rating = tr.querySelector('.col-rating');
  if (book.rating == null) {
    rating.innerHTML = '<span class="unrated">—</span>';
  } else {
    // Five stars with a gradient fill clipped to the rating fraction, so
    // half-star (e.g. 4.5) values render correctly.
    const stars = document.createElement('span');
    stars.className = 'stars';
    stars.style.setProperty('--pct', `${(book.rating / 5) * 100}%`);
    stars.textContent = '★★★★★';
    stars.title = `${book.rating}/5`;
    rating.appendChild(stars);
  }

  const descCell = tr.querySelector('.col-desc');
  descCell.querySelector('.desc-clamp').textContent = book.description || '';
  if (book.description) descCell.title = book.description; // full text on hover

  tr.querySelector('.row-delete').addEventListener('click', () => remove(book));
  return tr;
}

// Reflect the current sort key/direction in the column headers.
function updateHeaders() {
  for (const th of els.headers) {
    const active = th.dataset.key === state.sort;
    th.classList.toggle('sorted', active);
    const arrow = th.querySelector('.arrow');
    if (arrow) arrow.textContent = state.order === 'asc' ? '↑' : '↓';
    th.setAttribute('aria-sort', active ? (state.order === 'asc' ? 'ascending' : 'descending') : 'none');
  }
}

async function remove(book) {
  if (!confirm(`Delete “${book.title}”?`)) return;
  try {
    const res = await fetch(`${API}/${encodeURIComponent(book.id)}`, { method: 'DELETE' });
    const body = await res.json();
    if (!body.success) throw new Error(body.error || 'Delete failed');
    load();
  } catch (err) {
    alert(`Could not delete: ${err.message}`);
  }
}

// Click a column heading to sort by it; click the active one again to flip.
for (const th of els.headers) {
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    if (state.sort === key) {
      setState({ order: state.order === 'asc' ? 'desc' : 'asc' });
    } else {
      setState({ sort: key, order: 'asc' });
    }
    load();
  });
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.formMsg.textContent = '';
  els.formMsg.className = 'form-msg';

  const data = Object.fromEntries(new FormData(els.form));
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!body.success) throw new Error(body.error || 'Could not add book');
    els.form.reset();
    els.formMsg.textContent = `Added “${body.data.title}”.`;
    els.formMsg.classList.add('success');
    load();
  } catch (err) {
    els.formMsg.textContent = err.message;
    els.formMsg.classList.add('error');
  }
});

// Debounced search so we are not firing a request per keystroke.
let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    setState({ search: els.search.value });
    load();
  }, 200);
});

load();
