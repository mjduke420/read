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
  detailStatus: document.querySelector('#detail .detail-status'),
  detailDesc: document.querySelector('#detail .detail-desc'),
  dnfToggle: document.getElementById('dnf-toggle'),
  dnfState: document.getElementById('dnf-state'),
  detailClose: document.querySelector('#detail .detail-close'),
  detailDelete: document.querySelector('#detail .detail-delete'),
  detailView: document.querySelector('#detail .detail-view'),
  detailEdit: document.querySelector('#detail .detail-edit'),
  detailEditForm: document.getElementById('detail-edit-form'),
  detailCancel: document.querySelector('#detail .detail-cancel'),
  detailEditMsg: document.querySelector('#detail .detail-edit-msg'),
  editDnf: document.getElementById('edit-dnf'),
  editDnfState: document.getElementById('edit-dnf-state'),
  btnListView: document.getElementById('btn-list-view'),
  btnGridView: document.getElementById('btn-grid-view'),
  tableWrap: document.querySelector('.table-wrap'),
  detailBackdrop: document.getElementById('detail-backdrop'),
  ratingSelect: document.getElementById('rating-select'),
  clearRatingBtn: document.getElementById('clear-rating'),
  pagination: document.getElementById('pagination'),
  prevBtn: document.getElementById('prev-page'),
  nextBtn: document.getElementById('next-page'),
  pageInfo: document.getElementById('page-info'),
  detailSpoilers: document.querySelector('#detail .detail-spoilers'),
  spoilersToggle: document.getElementById('spoilers-toggle'),
  spoilersState: document.getElementById('spoilers-state'),
  editSpoilers: document.getElementById('edit-spoilers'),
  editSpoilersState: document.getElementById('edit-spoilers-state'),
  formToggle: document.getElementById('form-toggle'),
  formPanel: document.querySelector('.form-panel'),
  filterInputs: document.querySelectorAll('.filter-row [data-filter]'),
  clearFilters: document.getElementById('clear-filters'),
};

// Books per page (server-side pagination keeps the grid from scrolling forever).
const PAGE_SIZE = 25;

// On narrow screens, long cell values are truncated in the grid; the full
// text is still available in the detail card when a row is selected.
const MOBILE = window.matchMedia('(max-width: 640px)');
const MAX_CELL = 20;
function truncate(text) {
  const s = String(text ?? '');
  return s.length > MAX_CELL ? `${s.slice(0, MAX_CELL).trimEnd()}…` : s;
}
let lastBooks = [];

// UI state. Always replaced, never mutated in place.
let state = { search: '', sort: 'date', order: 'desc', page: 1, filters: {} };
let selectedId = null;
let currentBook = null; // the book shown in the detail drawer (for editing)

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

// Read / DNF status pill. Returns a fresh element.
function statusBadge(dnf) {
  const span = document.createElement('span');
  span.className = `status-badge ${dnf ? 'status-dnf' : 'status-read'}`;
  span.textContent = dnf ? 'DNF' : 'Read';
  return span;
}

// Spoilers pill. Returns a fresh element.
function spoilersBadge(spoilers) {
  const span = document.createElement('span');
  span.className = `status-badge ${spoilers ? 'spoilers-yes' : 'spoilers-no'}`;
  span.textContent = spoilers ? 'Spoilers' : 'Spoiler-free';
  return span;
}

async function load() {
  const params = new URLSearchParams({
    search: state.search,
    sort: state.sort,
    order: state.order,
    page: String(state.page),
    limit: String(PAGE_SIZE),
  });
  // Per-column filters -> f_title, f_author, ... (description -> f_desc).
  for (const [field, value] of Object.entries(state.filters)) {
    if (value) params.set(`f_${field === 'description' ? 'desc' : field}`, value);
  }
  try {
    const res = await fetch(`${API}?${params}`);
    const body = await res.json();
    if (!body.success) throw new Error(body.error || 'Failed to load books');
    // The server clamps the page into range; keep local state in sync.
    if (body.meta) state = { ...state, page: body.meta.page };
    render(body.data);
    updateCount(body.meta);
    renderPagination(body.meta);
  } catch (err) {
    els.tbody.innerHTML = '';
    els.count.textContent = `Could not load books: ${err.message}`;
    els.pagination.classList.add('hidden');
  }
  updateHeaders();
}

function updateCount(meta) {
  const total = meta?.total ?? 0;
  els.count.textContent = total === 1 ? '1 book' : `${total} books`;
}

function renderPagination(meta) {
  if (!meta) {
    els.pagination.classList.add('hidden');
    return;
  }
  const { page, totalPages, total } = meta;
  els.pageInfo.textContent = `Page ${page} of ${totalPages}`;
  els.prevBtn.disabled = page <= 1;
  els.nextBtn.disabled = page >= totalPages;
  // Only show controls when there is more than one page.
  els.pagination.classList.toggle('hidden', total === 0 || totalPages <= 1);
}

function render(books) {
  lastBooks = books;
  els.tbody.innerHTML = '';
  const isEmpty = books.length === 0;
  els.empty.classList.toggle('hidden', !isEmpty);
  els.table.classList.toggle('hidden', isEmpty);
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
  tr.innerHTML = `
    <td class="col-title"></td>
    <td class="col-author"></td>
    <td class="col-type"><span class="type-badge"></span></td>
    <td class="col-date"></td>
    <td class="col-rating"></td>
    <td class="col-status"></td>
    <td class="col-spoilers"></td>
    <td class="col-desc"><div class="desc-clamp"></div></td>
    <td class="col-actions"><button class="row-delete" title="Delete" aria-label="Delete book">✕</button></td>
  `;

  // On mobile, cap text fields at MAX_CELL chars; full text stays in the
  // detail card. User content goes through textContent to avoid HTML injection.
  const fit = (text) => (MOBILE.matches ? truncate(text) : String(text ?? ''));

  const titleEl = tr.querySelector('.col-title');
  titleEl.textContent = fit(book.title);
  titleEl.title = book.title;

  const authorEl = tr.querySelector('.col-author');
  authorEl.textContent = fit(book.author);
  authorEl.title = book.author;

  const badge = tr.querySelector('.type-badge');
  badge.textContent = TYPE_LABELS[book.type] ?? TYPE_LABELS.book;
  badge.className = `type-badge type-badge-${book.type || 'book'}`;

  tr.querySelector('.col-date').textContent = book.date || '';

  const rating = tr.querySelector('.col-rating');
  if (book.rating == null) {
    rating.innerHTML = '<span class="unrated">—</span>';
  } else {
    rating.appendChild(starsSpan(book.rating));
  }

  tr.querySelector('.col-status').appendChild(statusBadge(book.dnf));
  tr.querySelector('.col-spoilers').appendChild(spoilersBadge(book.spoilers));

  const descCell = tr.querySelector('.col-desc');
  descCell.querySelector('.desc-clamp').textContent = fit(book.description || '');
  if (book.description) descCell.title = book.description;

  // Setup dynamic covers visual parameters for grid view
  const initial = (book.title ? book.title.charAt(0) : '?').toUpperCase();
  const colors = [
    ['#8b5cf6', '#06b6d4'], // Indigo -> Cyan
    ['#ec4899', '#f43f5e'], // Violet -> Rose
    ['#10b981', '#3b82f6'], // Emerald -> Blue
    ['#f59e0b', '#ef4444'], // Amber -> Red
    ['#3b82f6', '#8b5cf6'], // Blue -> Violet
    ['#14b8a6', '#10b981']  // Teal -> Emerald
  ];
  const hash = [...(book.title || '')].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const pair = colors[hash % colors.length];
  tr.style.setProperty('--title-initial', `"${initial}"`);
  tr.style.setProperty('--cover-1', pair[0]);
  tr.style.setProperty('--cover-2', pair[1]);

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
  els.detailBackdrop.classList.remove('hidden');
}

function renderDetail(book) {
  currentBook = book;
  // Always (re)open in read-only view mode.
  els.detailView.classList.remove('hidden');
  els.detailEditForm.classList.add('hidden');
  els.detailType.textContent = TYPE_LABELS[book.type] ?? TYPE_LABELS.book;
  els.detailType.className = `type-badge type-badge-${book.type || 'book'}`;
  els.detailTitle.textContent = book.title;
  els.detailAuthor.textContent = book.author ? `by ${book.author}` : '';
  els.detailDate.textContent = book.date ? `Added ${book.date}` : '';

  els.detailRating.innerHTML = '';
  if (book.rating == null) {
    els.detailRating.innerHTML = '<span class="unrated">Unrated</span>';
  } else {
    els.detailRating.appendChild(starsSpan(book.rating));
  }

  els.detailStatus.innerHTML = '';
  els.detailStatus.appendChild(statusBadge(book.dnf));

  els.detailSpoilers.innerHTML = '';
  els.detailSpoilers.appendChild(spoilersBadge(book.spoilers));

  els.detailDesc.textContent = book.description || 'No description.';
  els.detailDelete.onclick = () => remove(book);
  els.detail.classList.remove('hidden');
}

function closeDetail() {
  selectedId = null;
  els.detail.classList.add('hidden');
  els.detailBackdrop.classList.add('hidden');
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

// --- Edit a record from the detail drawer ---------------------------------
function openEdit() {
  if (!currentBook) return;
  const f = els.detailEditForm;
  f.elements.title.value = currentBook.title || '';
  f.elements.author.value = currentBook.author || '';
  f.elements.date.value = currentBook.date || '';
  f.elements.type.value = currentBook.type || 'book';
  f.elements.rating.value = currentBook.rating == null ? '' : String(currentBook.rating);
  els.editDnf.checked = !!currentBook.dnf;
  els.editDnfState.textContent = currentBook.dnf ? 'DNF' : 'Read';
  els.editSpoilers.checked = !!currentBook.spoilers;
  els.editSpoilersState.textContent = currentBook.spoilers ? 'Spoilers' : 'Spoiler-free';
  f.elements.description.value = currentBook.description || '';
  els.detailEditMsg.textContent = '';
  els.detailEditMsg.className = 'detail-edit-msg form-msg';
  els.detailView.classList.add('hidden');
  els.detailEditForm.classList.remove('hidden');
  f.elements.title.focus();
}

function cancelEdit() {
  els.detailEditForm.classList.add('hidden');
  els.detailView.classList.remove('hidden');
}

els.detailEdit.addEventListener('click', openEdit);
els.detailCancel.addEventListener('click', cancelEdit);
els.editDnf.addEventListener('change', () => {
  els.editDnfState.textContent = els.editDnf.checked ? 'DNF' : 'Read';
});
els.editSpoilers.addEventListener('change', () => {
  els.editSpoilersState.textContent = els.editSpoilers.checked ? 'Spoilers' : 'Spoiler-free';
});

els.detailEditForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentBook) return;
  els.detailEditMsg.textContent = '';
  els.detailEditMsg.className = 'detail-edit-msg form-msg';

  const data = Object.fromEntries(new FormData(els.detailEditForm));
  try {
    const res = await fetch(`${API}/${encodeURIComponent(currentBook.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!body.success) throw new Error(body.error || 'Could not save changes');
    cancelEdit(); // back to view; load() refreshes it with the saved data
    load();
  } catch (err) {
    els.detailEditMsg.textContent = err.message;
    els.detailEditMsg.classList.add('error');
  }
});

els.detailClose.addEventListener('click', closeDetail);
els.detailBackdrop.addEventListener('click', closeDetail);

// Pagination controls.
els.prevBtn.addEventListener('click', () => {
  if (state.page > 1) {
    setState({ page: state.page - 1 });
    load();
  }
});
els.nextBtn.addEventListener('click', () => {
  setState({ page: state.page + 1 }); // server clamps to the last page
  load();
});

// Re-render when crossing the mobile breakpoint so truncation updates.
MOBILE.addEventListener('change', () => render(lastBooks));

// Click a column heading to sort by it; click the active one again to flip.
for (const th of els.headers) {
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    if (state.sort === key) {
      setState({ order: state.order === 'asc' ? 'desc' : 'asc', page: 1 });
    } else {
      setState({ sort: key, order: 'asc', page: 1 });
    }
    load();
  });
}

// Toggle View Modes
let viewMode = localStorage.getItem('viewMode') || 'list';
function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem('viewMode', mode);
  if (mode === 'grid') {
    els.tableWrap.classList.add('view-grid');
    els.btnGridView.classList.add('active');
    els.btnListView.classList.remove('active');
  } else {
    els.tableWrap.classList.remove('view-grid');
    els.btnListView.classList.add('active');
    els.btnGridView.classList.remove('active');
  }
}
els.btnListView.addEventListener('click', () => setViewMode('list'));
els.btnGridView.addEventListener('click', () => setViewMode('grid'));
setViewMode(viewMode);

// Custom Star Rating Widget Logic
const starWrappers = document.querySelectorAll('#star-rating-input .star-input-wrapper');
function updateStarWidget(ratingVal) {
  const rating = parseFloat(ratingVal || 0);
  starWrappers.forEach((wrapper) => {
    const idx = parseInt(wrapper.dataset.index, 10);
    wrapper.classList.remove('active-full', 'active-half');
    if (idx <= rating) {
      wrapper.classList.add('active-full');
    } else if (idx - 0.5 === rating) {
      wrapper.classList.add('active-half');
    }
  });
}

const halves = document.querySelectorAll('#star-rating-input .star-input-half');
halves.forEach((half) => {
  half.addEventListener('mouseenter', () => {
    updateStarWidget(parseFloat(half.dataset.value));
  });
  half.addEventListener('click', () => {
    // Normalize "1.0" -> "1" etc. so the value matches a <select> <option>
    // (otherwise whole-star selections silently reset to unrated).
    const val = String(parseFloat(half.dataset.value));
    els.ratingSelect.value = val;
    updateStarWidget(val);
  });
});

document.getElementById('star-rating-input').addEventListener('mouseleave', () => {
  updateStarWidget(els.ratingSelect.value);
});

els.clearRatingBtn.addEventListener('click', () => {
  els.ratingSelect.value = '';
  updateStarWidget('');
});

// Add-form toggles: reflect on/off state in their labels.
function updateDnfLabel() {
  els.dnfState.textContent = els.dnfToggle.checked ? 'DNF' : 'Read';
}
function updateSpoilersLabel() {
  els.spoilersState.textContent = els.spoilersToggle.checked ? 'Spoilers' : 'Spoiler-free';
}
els.dnfToggle.addEventListener('change', updateDnfLabel);
els.spoilersToggle.addEventListener('change', updateSpoilersLabel);

els.form.addEventListener('reset', () => {
  setTimeout(() => {
    updateStarWidget('');
    updateDnfLabel();
    updateSpoilersLabel();
  }, 0);
});

// Submit Form
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
    setState({ page: 1 }); // jump to the first page to see the new book
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
    setState({ search: els.search.value, page: 1 });
    load();
  }, 200);
});

// --- Per-column filters ---------------------------------------------------
// Read every filter control each time so concurrent changes can't race.
function readFilters() {
  const filters = {};
  els.filterInputs.forEach((el) => {
    if (el.value) filters[el.dataset.filter] = el.value;
  });
  return filters;
}
let filterTimer;
function applyFilters(debounce) {
  const run = () => {
    setState({ filters: readFilters(), page: 1 });
    load();
  };
  if (debounce) {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(run, 200);
  } else {
    run();
  }
}
els.filterInputs.forEach((el) => {
  const isText = el.tagName !== 'SELECT';
  el.addEventListener(isText ? 'input' : 'change', () => applyFilters(isText));
});
els.clearFilters.addEventListener('click', () => {
  els.filterInputs.forEach((el) => {
    el.value = '';
  });
  setState({ filters: {}, page: 1 });
  load();
});

// --- Collapsible add form (to show more of the grid) ----------------------
function setFormCollapsed(collapsed) {
  els.formPanel.classList.toggle('collapsed', collapsed);
  els.formToggle.setAttribute('aria-expanded', String(!collapsed));
  els.formToggle.setAttribute('aria-label', collapsed ? 'Expand add form' : 'Collapse add form');
  localStorage.setItem('addFormCollapsed', collapsed ? '1' : '0');
}
els.formToggle.addEventListener('click', () => {
  setFormCollapsed(!els.formPanel.classList.contains('collapsed'));
});
setFormCollapsed(localStorage.getItem('addFormCollapsed') === '1');

load();
