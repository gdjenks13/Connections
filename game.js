// =====================================================================
// game.js  –  Core game logic for Connections
// =====================================================================

// ===================== CONSTANTS =====================
const COLORS = {
  0: { key: 'yellow', bg: '#f9df6d', text: '#000', label: 'Yellow' },
  1: { key: 'green',  bg: '#a0c35a', text: '#000', label: 'Green'  },
  2: { key: 'blue',   bg: '#b0c4ef', text: '#000', label: 'Blue'   },
  3: { key: 'purple', bg: '#ba81c5', text: '#000', label: 'Purple' },
  4: { key: 'red',    bg: '#f28b82', text: '#000', label: 'Red'    },
  5: { key: 'orange', bg: '#f6b76b', text: '#000', label: 'Orange' },
};

// Color keys available for hint dots (all 6 category colors)
const HINT_COLORS = ['yellow','green','blue','purple','red','orange'];

const DEFAULT_PUZZLE = {
  categories: [
    { name: 'Things that start with FIRE', words: ['ANT','DRILL','ISLAND','OPAL'] },
    { name: 'Types of FISH',               words: ['BASS','FLOUNDER','SALMON','TROUT'] },
    { name: '___ STONE',                   words: ['COBBLE','CORNER','GREY','LIME'] },
    { name: 'Can be "ROLLING"',            words: ['HILLS','PIN','STOCK','THUNDER'] },
  ],
  maxMistakes: 4,
};

// ===================== STATE =====================
let puzzle       = null;
let tiles        = [];      // [{word, catIdx, el}]
let selected     = [];      // indices into tiles[]
let solved       = [];      // catIdx values that have been solved
let mistakes     = 4;       // remaining mistakes
let hints        = {};      // word -> color string
let hintTargetWord  = null;
let hintPickerOpen  = false;
let longPressTimer  = null;

// ===================== INIT =====================
function init() {
  hints = loadHints();
  const urlPuzzle = puzzleFromURL();
  puzzle = urlPuzzle || DEFAULT_PUZZLE;
  showScreen('game');
  buildGame();
  bindGameButtons();
  bindHintPicker();
  bindModals();
  updateHintPickerSwatches();
}

// ===================== URL ENCODE / DECODE =====================
function puzzleFromURL() {
  const params = new URLSearchParams(location.search);
  const p = params.get('p');
  if (!p) return null;
  try {
    const json = atob(p.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch (e) { return null; }
}

function puzzleToURL(puz) {
  const json = JSON.stringify(puz);
  const b64  = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const url  = new URL(location.href);
  url.search = '?p=' + b64;
  return url.toString();
}

// ===================== SCREEN SWITCHING =====================
function showScreen(name) {
  document.getElementById('game-screen').style.display    = name === 'game'    ? 'flex' : 'none';
  document.getElementById('creator-screen').style.display = name === 'creator' ? 'flex' : 'none';
}

// ===================== BUILD GAME =====================
function buildGame() {
  solved   = [];
  selected = [];
  mistakes = (puzzle.maxMistakes !== undefined) ? puzzle.maxMistakes : 4;
  hints    = loadHints();

  const wordsPerCat = puzzle.categories[0].words.length;

  // Build flat tile list and shuffle
  const allTiles = [];
  puzzle.categories.forEach((cat, ci) => {
    cat.words.forEach(w => allTiles.push({ word: w.toUpperCase(), catIdx: ci }));
  });
  tiles = shuffle(allTiles);

  // Set grid columns to match word count
  const grid = document.getElementById('grid');
  grid.style.gridTemplateColumns = `repeat(${wordsPerCat}, 1fr)`;

  document.getElementById('solved-categories').innerHTML = '';
  document.getElementById('game-category-hint').textContent =
    `Find ${puzzle.categories.length} groups of ${wordsPerCat}!`;

  renderGrid();
  renderMistakeDots();
}

// ===================== RENDER GRID =====================
function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  tiles.forEach((t, idx) => {
    if (solved.includes(t.catIdx)) return;

    const el = document.createElement('div');
    el.className    = 'tile';
    el.dataset.idx  = idx;
    el.dataset.word = t.word;
    el.textContent  = t.word;

    // Hint dot (top-right corner, pointer-events none)
    const dot = document.createElement('div');
    dot.className    = 'tile-hint' + (hints[t.word] ? ' set hint-' + hints[t.word] : '');
    dot.dataset.role = 'hint-dot';
    el.appendChild(dot);

    // Click to select
    el.addEventListener('click', e => {
      if (hintPickerOpen) { closeHintPicker(); return; }
      onTileClick(idx, el);
    });

    // Right-click → hint picker
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      openHintPicker(el, t.word);
    });

    // Long-press (touch) → hint picker
    el.addEventListener('touchstart', e => {
      longPressTimer = setTimeout(() => {
        openHintPicker(el, t.word);
      }, 500);
    }, { passive: true });

    el.addEventListener('touchend',  () => clearTimeout(longPressTimer));
    el.addEventListener('touchmove', () => clearTimeout(longPressTimer));

    // Long-press (mouse) — desktop fallback
    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      longPressTimer = setTimeout(() => openHintPicker(el, t.word), 500);
    });
    el.addEventListener('mouseup',    () => clearTimeout(longPressTimer));
    el.addEventListener('mouseleave', () => clearTimeout(longPressTimer));

    grid.appendChild(el);
    t.el = el;
  });
}

// ===================== TILE SELECTION =====================
function onTileClick(idx, el) {
  const wordsPerCat = puzzle.categories[0].words.length;
  if (selected.includes(idx)) {
    selected = selected.filter(i => i !== idx);
    el.classList.remove('selected');
  } else {
    if (selected.length >= wordsPerCat) return;
    selected.push(idx);
    el.classList.add('selected');
  }
}

// ===================== SUBMIT =====================
async function handleSubmit() {
  const wordsPerCat = puzzle.categories[0].words.length;

  if (selected.length !== wordsPerCat) {
    showToast(`Select ${wordsPerCat} words first!`);
    return;
  }

  const selCats  = selected.map(i => tiles[i].catIdx);
  const allSame  = selCats.every(c => c === selCats[0]);

  if (allSame) {
    const catIdx = selCats[0];
    await bounceSelectedTiles();

    solved.push(catIdx);
    selected = [];

    appendSolvedCard(catIdx);
    renderGrid();
    renderMistakeDots();

    if (solved.length === puzzle.categories.length) {
      setTimeout(() => showResultModal(true), 600);
    }
  } else {
    // "One away" check
    const counts   = {};
    selCats.forEach(c => counts[c] = (counts[c] || 0) + 1);
    const maxMatch = Math.max(...Object.values(counts));
    if (maxMatch === wordsPerCat - 1) showToast('One away…');

    shakeSelectedTiles();
    mistakes--;
    renderMistakeDots();

    selected.forEach(i => tiles[i].el && tiles[i].el.classList.remove('selected'));
    selected = [];

    if (mistakes <= 0) {
      setTimeout(() => showResultModal(false), 500);
    }
  }
}

// ===================== ANIMATIONS =====================
async function bounceSelectedTiles() {
  return new Promise(resolve => {
    const els = selected.map(i => tiles[i].el).filter(Boolean);
    els.forEach((el, i) => {
      setTimeout(() => {
        el.style.transition = 'transform 0.15s ease';
        el.style.transform  = 'scale(1.08) translateY(-4px)';
        setTimeout(() => { el.style.transform = ''; }, 150);
      }, i * 60);
    });
    setTimeout(resolve, els.length * 60 + 200);
  });
}

function shakeSelectedTiles() {
  selected.forEach(i => {
    const el = tiles[i].el;
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth; // reflow
    el.classList.add('shake');
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
  });
}

// ===================== SOLVED CARD =====================
function appendSolvedCard(catIdx) {
  const cat   = puzzle.categories[catIdx];
  const color = COLORS[catIdx];
  const card  = document.createElement('div');
  card.className    = 'solved-card';
  card.style.background = color.bg;
  card.innerHTML = `
    <div class="solved-card-label">${color.label}</div>
    <div class="solved-card-title">${cat.name}</div>
    <div class="solved-card-words">${cat.words.join(', ')}</div>
  `;
  document.getElementById('solved-categories').appendChild(card);
}

// ===================== MISTAKES DOTS =====================
function renderMistakeDots() {
  const area  = document.getElementById('mistake-dots');
  const wrap  = area.parentElement;
  const total = (puzzle && puzzle.maxMistakes !== undefined) ? puzzle.maxMistakes : 4;

  wrap.style.display = total === 0 ? 'none' : 'flex';
  area.innerHTML     = '';

  for (let i = 0; i < total; i++) {
    const dot       = document.createElement('div');
    dot.className   = 'mistake-dot' + (i >= mistakes ? ' used' : '');
    area.appendChild(dot);
  }
}

// ===================== RESULT MODAL =====================
function showResultModal(won) {
  const total = (puzzle.maxMistakes !== undefined) ? puzzle.maxMistakes : 4;
  const used  = total - mistakes;

  document.getElementById('result-title').textContent = won ? '🎉 Solved!' : '😔 Better luck next time!';
  document.getElementById('result-msg').textContent   = won
    ? `You solved the puzzle with ${used} mistake${used === 1 ? '' : 's'}!`
    : 'The correct answers were:';

  const rc = document.getElementById('result-cats');
  rc.innerHTML = '';
  puzzle.categories.forEach((cat, ci) => {
    const color = COLORS[ci];
    const div   = document.createElement('div');
    div.className         = 'result-cat';
    div.style.background  = color.bg;
    div.innerHTML = `<strong>${cat.name}</strong><br>
      <span style="font-size:12px;font-weight:500">${cat.words.join(', ')}</span>`;
    rc.appendChild(div);
  });

  document.getElementById('result-modal').classList.remove('hidden');
}

// ===================== HINT PICKER =====================
function updateHintPickerSwatches() {
  // Rebuild swatches to include all 6 colors
  const picker = document.getElementById('hint-picker');
  picker.innerHTML = '';

  // Clear swatch
  const clearSwatch = document.createElement('div');
  clearSwatch.className    = 'hint-swatch none';
  clearSwatch.dataset.color = 'none';
  clearSwatch.title        = 'Clear';
  picker.appendChild(clearSwatch);

  HINT_COLORS.forEach(colorKey => {
    const color = Object.values(COLORS).find(c => c.key === colorKey);
    if (!color) return;
    const swatch = document.createElement('div');
    swatch.className    = 'hint-swatch';
    swatch.dataset.color = colorKey;
    swatch.title        = color.label;
    swatch.style.background  = color.bg;
    swatch.style.borderColor = color.bg; // subtle
    picker.appendChild(swatch);
  });

  // Re-bind click events on new swatches
  picker.querySelectorAll('.hint-swatch').forEach(swatch => {
    swatch.addEventListener('click', e => {
      e.stopPropagation();
      applyHint(swatch.dataset.color);
    });
  });
}

function openHintPicker(tileEl, word) {
  hintPickerOpen  = true;
  hintTargetWord  = word;

  const picker = document.getElementById('hint-picker');
  picker.classList.add('visible');

  // Position near tile
  requestAnimationFrame(() => {
    const rect = tileEl.getBoundingClientRect();
    const pw   = picker.offsetWidth;
    const ph   = picker.offsetHeight;
    let left   = rect.right - pw;
    let top    = rect.top - ph - 8;
    if (top < 8)                     top  = rect.bottom + 8;
    if (left < 8)                    left = 8;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    picker.style.left = left + 'px';
    picker.style.top  = top  + 'px';
  });
}

function closeHintPicker() {
  hintPickerOpen = false;
  hintTargetWord = null;
  document.getElementById('hint-picker').classList.remove('visible');
}

function applyHint(color) {
  if (!hintTargetWord) return;
  if (color === 'none') {
    delete hints[hintTargetWord];
  } else {
    hints[hintTargetWord] = color;
  }
  saveHints();

  // Update dot on matching tile element
  tiles.forEach(t => {
    if (t.word === hintTargetWord && t.el) {
      const dot = t.el.querySelector('[data-role="hint-dot"]');
      if (dot) {
        dot.className = 'tile-hint' + (hints[hintTargetWord] ? ' set hint-' + hints[hintTargetWord] : '');
      }
    }
  });

  closeHintPicker();
}

// ===================== HINT STORAGE =====================
function loadHints() {
  try { return JSON.parse(sessionStorage.getItem('conn_hints') || '{}'); } catch { return {}; }
}

function saveHints() {
  try { sessionStorage.setItem('conn_hints', JSON.stringify(hints)); } catch {}
}

// ===================== BIND BUTTONS =====================
function bindGameButtons() {
  document.getElementById('submit-btn').addEventListener('click', handleSubmit);

  document.getElementById('shuffle-btn').addEventListener('click', () => {
    const unsolved = tiles.filter(t => !solved.includes(t.catIdx));
    const shuffled = shuffle(unsolved);
    let si = 0;
    tiles = tiles.map(t => solved.includes(t.catIdx) ? t : shuffled[si++]);
    selected = [];
    renderGrid();
  });

  document.getElementById('deselect-btn').addEventListener('click', () => {
    selected.forEach(i => tiles[i].el && tiles[i].el.classList.remove('selected'));
    selected = [];
  });

  document.getElementById('how-to-btn').addEventListener('click', () => {
    document.getElementById('how-to-modal').classList.remove('hidden');
  });

  document.getElementById('create-btn').addEventListener('click', () => {
    openCreator();
  });

  document.getElementById('result-create-btn').addEventListener('click', () => {
    closeModal('result-modal');
    openCreator();
  });

  document.getElementById('result-play-again-btn').addEventListener('click', () => {
    closeModal('result-modal');
    buildGame();
  });
}

function bindHintPicker() {
  // Close on click outside
  document.addEventListener('click', e => {
    if (hintPickerOpen && !e.target.closest('#hint-picker')) closeHintPicker();
  });

  document.addEventListener('touchstart', e => {
    if (hintPickerOpen && !e.target.closest('#hint-picker')) closeHintPicker();
  }, { passive: true });
}

function bindModals() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

// ===================== MODAL HELPERS =====================
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ===================== TOAST =====================
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ===================== UTILS =====================
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
