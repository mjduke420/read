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
  detail: document.getElementById('detail'),
  detailType: document.querySelector('#detail .detail-type'),
  detailTitle: document.querySelector('#detail .detail-title'),
  detailAuthor: document.querySelector('#detail .detail-author'),
  detailDate: document.querySelector('#detail .detail-date'),
  detailRating: document.querySelector('#detail .detail-rating'),
  detailDesc: document.querySelector('#detail .detail-desc'),
  detailClose: document.querySelector('#detail .detail-close'),
  detailDelete: document.querySelector('#detail .detail-delete'),
  mSort: document.getElementById('m-sort'),
  mOrder: document.getElementById('m-order'),
  mOrderIcon: document.getElementById('m-order-icon'),
};

// UI state. Always replaced, never mutated in place.
let state = { search: '', sort: 'date', order: 'desc' };
let selectedId = null;

function setState(patch) {
  state = { ...state, ...patch };
}

const TYPE_LABELS = {
  book: '📖 Book',
  ebook: '📱 eBook',
  audiobook: '🎧 Audiobook',
};

// Five stars with a gradient fill clipped to the rating fraction, so
// half-star (e.g. 4.5) values render correctly. Returns a fresh element.
function starsSpan(rating) {
  const span = document.createElement('span');
  span.className = 'stars';
  span.style.setProperty('--pct', `${(rating / 5) * 100}%`);
  span.textContent = '★★★★★';
  span.title = `${rating}/5`;
  return span;
}

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

  // Keep the detail card in sync with the current data set.
  if (selectedId) {
    const found = books.find((b) => b.id === selectedId);
    if (found) renderDetail(found);
    else closeDetail();
  }
}

function row(book) {
  const tr = document.createElement('tr');
  tr.dataset.id = book.id;
  if (book.id === selectedId) tr.classList.add('selected');
  // data-label values surface as field labels in the mobile card layout.
  tr.innerHTML = `
    <td class="col-title"></td>
    <td class="col-author" data-label="Author"></td>
    <td class="col-type" data-label="Type"><span class="type-badge"></span></td>
    <td class="col-date" data-label="Date"></td>
    <td class="col-rating" data-label="Rating"></td>
    <td class="col-desc" data-label="Description"><div class="desc-clamp"></div></td>
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
    rating.appendChild(starsSpan(book.rating));
  }

  const descCell = tr.querySelector('.col-desc');
  descCell.querySelector('.desc-clamp').textContent = book.description || '';
  if (book.description) descCell.title = book.description;

  // Click the row to open details; the delete button must not also open them.
  tr.addEventListener('click', () => selectBook(book));
  tr.querySelector('.row-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    remove(book);
  });
  return tr;
}

function selectBook(book) {
  selectedId = book.id;
  renderDetail(book);
  highlight();
}

function renderDetail(book) {
  els.detailType.textContent = TYPE_LABELS[book.type] ?? TYPE_LABELS.book;
  els.detailTitle.textContent = book.title;
  els.detailAuthor.textContent = book.author ? `by ${book.author}` : '';
  els.detailDate.textContent = book.date ? `Added ${book.date}` : '';

  els.detailRating.innerHTML = '';
  if (book.rating == null) {
    els.detailRating.innerHTML = '<span class="unrated">Unrated</span>';
  } else {
    els.detailRating.appendChild(starsSpan(book.rating));
  }

  els.detailDesc.textContent = book.description || 'No description.';
  els.detailDelete.onclick = () => remove(book);
  els.detail.classList.remove('hidden');
}

function closeDetail() {
  selectedId = null;
  els.detail.classList.add('hidden');
  highlight();
}

// Toggle the selected highlight without re-fetching/re-rendering all rows.
function highlight() {
  for (const tr of els.tbody.children) {
    tr.classList.toggle('selected', tr.dataset.id === selectedId);
  }
}

// Reflect the current sort key/direction in the column headers and the
// mobile sort control (kept in sync so either entry point works).
function updateHeaders() {
  for (const th of els.headers) {
    const active = th.dataset.key === state.sort;
    th.classList.toggle('sorted', active);
    const arrow = th.querySelector('.arrow');
    if (arrow) arrow.textContent = state.order === 'asc' ? '↑' : '↓';
    th.setAttribute('aria-sort', active ? (state.order === 'asc' ? 'ascending' : 'descending') : 'none');
  }
  els.mSort.value = state.sort;
  els.mOrderIcon.textContent = state.order === 'asc' ? '↑' : '↓';
}

async function remove(book) {
  if (!confirm(`Delete “${book.title}”?`)) return;
  try {
    const res = await fetch(`${API}/${encodeURIComponent(book.id)}`, { method: 'DELETE' });
    const body = await res.json();
    if (!body.success) throw new Error(body.error || 'Delete failed');
    load(); // render() will close the detail card if the deleted book was selected
  } catch (err) {
    alert(`Could not delete: ${err.message}`);
  }
}

els.detailClose.addEventListener('click', closeDetail);

// Mobile sort control (mirrors the desktop header-click sorting).
els.mSort.addEventListener('change', () => {
  setState({ sort: els.mSort.value });
  load();
});
els.mOrder.addEventListener('click', () => {
  setState({ order: state.order === 'asc' ? 'desc' : 'asc' });
  load();
});

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
