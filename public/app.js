const API = '/api/books';

const els = {
  form: document.getElementById('add-form'),
  formMsg: document.getElementById('form-msg'),
  search: document.getElementById('search'),
  sort: document.getElementById('sort'),
  order: document.getElementById('order'),
  orderIcon: document.getElementById('order-icon'),
  grid: document.getElementById('grid'),
  count: document.getElementById('count'),
  empty: document.getElementById('empty'),
};

// UI state. Kept immutable-ish: we always replace, never mutate in place.
let state = { search: '', sort: 'date', order: 'desc' };

function setState(patch) {
  state = { ...state, ...patch };
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
    els.grid.innerHTML = '';
    els.count.textContent = `Could not load books: ${err.message}`;
  }
}

function render(books) {
  els.grid.innerHTML = '';
  els.empty.classList.toggle('hidden', books.length > 0);
  els.count.textContent = books.length === 1 ? '1 book' : `${books.length} books`;
  for (const book of books) {
    els.grid.appendChild(card(book));
  }
}

function card(book) {
  const el = document.createElement('article');
  el.className = 'card';

  const stars =
    book.rating == null
      ? '<span class="meta-muted">Unrated</span>'
      : `<span class="stars" title="${book.rating}/5">${'★'.repeat(book.rating)}${'☆'.repeat(5 - book.rating)}</span>`;

  el.innerHTML = `
    <button class="delete" title="Delete" aria-label="Delete book">✕</button>
    <h3></h3>
    <div class="author"></div>
    <div class="meta">
      <span class="date"></span>
      ${stars}
    </div>
    <div class="desc"></div>
  `;

  // Set user content via textContent to avoid any HTML injection.
  el.querySelector('h3').textContent = book.title;
  el.querySelector('.author').textContent = book.author;
  el.querySelector('.date').textContent = book.date || '';
  const desc = el.querySelector('.desc');
  desc.textContent = book.description || '';
  if (!book.description) desc.remove();

  el.querySelector('.delete').addEventListener('click', () => remove(book));
  return el;
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

els.sort.addEventListener('change', () => {
  setState({ sort: els.sort.value });
  load();
});

els.order.addEventListener('click', () => {
  const order = state.order === 'asc' ? 'desc' : 'asc';
  setState({ order });
  els.orderIcon.textContent = order === 'asc' ? '↑' : '↓';
  load();
});

// Initialize control defaults from state, then load.
els.sort.value = state.sort;
els.orderIcon.textContent = state.order === 'asc' ? '↑' : '↓';
load();
