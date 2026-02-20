// =====================================================================
// creator.js  –  Puzzle creator screen logic for Connections
// =====================================================================

// ===================== CONFIG =====================
const CAT_CONFIGS = [
  { cls: 'y', label: 'Category 1', badge: 'Easiest',   placeholder: 'e.g. Types of Fish'      },
  { cls: 'g', label: 'Category 2', badge: 'Easy',      placeholder: 'e.g. ___ Ball'            },
  { cls: 'b', label: 'Category 3', badge: 'Medium',    placeholder: 'e.g. Things that can fly' },
  { cls: 'p', label: 'Category 4', badge: 'Hard',      placeholder: 'e.g. ___ Stone'           },
  { cls: 'r', label: 'Category 5', badge: 'Harder',    placeholder: 'e.g. Famous Painters'     },
  { cls: 'o', label: 'Category 6', badge: 'Hardest',   placeholder: 'e.g. ___ Fire'            },
];

let numCategories = 4;
let wordsPerCat   = 4;

// ===================== OPEN CREATOR =====================
function openCreator() {
  showScreen('creator');
  document.getElementById('share-result').classList.remove('visible');
  renderCreatorCards();
  bindCreatorButtons();
}

// ===================== RENDER CATEGORY CARDS =====================
function renderCreatorCards() {
  const container = document.getElementById('creator-cards');
  container.innerHTML = '';

  // Update stepper display values
  document.getElementById('num-cats-val').textContent   = numCategories;
  document.getElementById('words-per-cat-val').textContent = wordsPerCat;

  for (let ci = 0; ci < numCategories; ci++) {
    const cfg  = CAT_CONFIGS[ci];
    const card = document.createElement('div');
    card.className = `category-card ${cfg.cls}`;

    // Header row
    const header = document.createElement('div');
    header.className = 'diff-label';
    header.innerHTML = `<span>${cfg.label}</span><span class="diff-badge">${cfg.badge}</span>`;
    card.appendChild(header);

    // Category name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Category Name';
    card.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type        = 'text';
    nameInput.className   = 'cat-name';
    nameInput.dataset.idx = ci;
    nameInput.placeholder = cfg.placeholder;
    card.appendChild(nameInput);

    // Word inputs
    const wordsLabel = document.createElement('label');
    wordsLabel.textContent = `Words (${wordsPerCat})`;
    card.appendChild(wordsLabel);

    const wordGrid = document.createElement('div');
    wordGrid.className = 'word-inputs';
    // Use 2 columns for 2 words, otherwise match word count (max 6 → 3 cols per row looks better for 5-6)
    const cols = wordsPerCat <= 4 ? wordsPerCat : (wordsPerCat === 5 ? 3 : 3);
    wordGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    for (let wi = 0; wi < wordsPerCat; wi++) {
      const input = document.createElement('input');
      input.type        = 'text';
      input.className   = 'word-input';
      input.dataset.cat = ci;
      input.dataset.i   = wi;
      input.placeholder = `Word ${wi + 1}`;
      input.maxLength   = 24;
      wordGrid.appendChild(input);
    }

    card.appendChild(wordGrid);
    container.appendChild(card);
  }
}

// ===================== BIND CREATOR BUTTONS =====================
function bindCreatorButtons() {
  // Avoid double-binding by replacing nodes
  replaceListener('cancel-create-btn', () => showScreen('game'));
  replaceListener('generate-btn', handleGenerate);
  replaceListener('copy-link-btn', handleCopyLink);
  replaceListener('play-own-btn', handlePlayOwn);

  // Category stepper
  replaceListener('num-cats-dec', () => { if (numCategories > 2) { numCategories--; renderCreatorCards(); } });
  replaceListener('num-cats-inc', () => { if (numCategories < 6) { numCategories++; renderCreatorCards(); } });

  // Words per cat stepper
  replaceListener('words-per-cat-dec', () => { if (wordsPerCat > 2) { wordsPerCat--; renderCreatorCards(); } });
  replaceListener('words-per-cat-inc', () => { if (wordsPerCat < 6) { wordsPerCat++; renderCreatorCards(); } });

  // Mistake slider
  const slider    = document.getElementById('mistake-slider');
  const sliderVal = document.getElementById('mistake-slider-val');
  slider.addEventListener('input', () => { sliderVal.textContent = slider.value; });
}

function replaceListener(id, fn) {
  const el  = document.getElementById(id);
  const clone = el.cloneNode(true);
  el.parentNode.replaceChild(clone, el);
  clone.addEventListener('click', fn);
}

// ===================== GENERATE LINK =====================
function handleGenerate() {
  const catNameEls  = document.querySelectorAll('.cat-name');
  const wordInputEls = document.querySelectorAll('.word-input');

  const categories = [];
  let valid = true;

  for (let ci = 0; ci < numCategories; ci++) {
    const nameEl = catNameEls[ci];
    const name   = nameEl ? nameEl.value.trim() : '';
    const words  = Array.from(wordInputEls)
      .filter(el => parseInt(el.dataset.cat) === ci)
      .map(el => el.value.trim().toUpperCase())
      .filter(Boolean);

    if (!name) {
      showToast(`Category ${ci + 1} needs a name.`);
      valid = false; break;
    }
    if (words.length !== wordsPerCat) {
      showToast(`Category ${ci + 1} needs ${wordsPerCat} words (${words.length} filled).`);
      valid = false; break;
    }
    categories.push({ name, words });
  }

  if (!valid) return;

  // Uniqueness check across all words
  const allWords = categories.flatMap(c => c.words);
  const unique   = new Set(allWords);
  if (unique.size !== allWords.length) {
    showToast('All words must be unique across categories.');
    return;
  }

  const maxMistakes = parseInt(document.getElementById('mistake-slider').value);
  const newPuzzle   = { categories, maxMistakes };
  const url         = puzzleToURL(newPuzzle);

  document.getElementById('share-url').value = url;
  document.getElementById('share-result').classList.add('visible');
  document.getElementById('share-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ===================== COPY LINK =====================
function handleCopyLink() {
  const url = document.getElementById('share-url').value;
  navigator.clipboard.writeText(url)
    .then(() => showToast('Link copied!'))
    .catch(() => {
      const ta = document.getElementById('share-url');
      ta.select();
      document.execCommand('copy');
      showToast('Link copied!');
    });
}

// ===================== PLAY OWN PUZZLE =====================
function handlePlayOwn() {
  const url    = document.getElementById('share-url').value;
  const params = new URLSearchParams(new URL(url).search);
  const p      = params.get('p');
  try {
    const json = atob(p.replace(/-/g, '+').replace(/_/g, '/'));
    puzzle = JSON.parse(json);
    history.pushState({}, '', url);
    showScreen('game');
    buildGame();
  } catch (e) {
    showToast('Something went wrong.');
  }
}
