// =====================================================================
// game.js  –  Core game logic for Connections
// =====================================================================

// ===================== CONSTANTS =====================
const COLORS = {
  0: { key: "yellow", bg: "#f9df6d", text: "#000", label: "Yellow" },
  1: { key: "green", bg: "#a0c35a", text: "#000", label: "Green" },
  2: { key: "blue", bg: "#b0c4ef", text: "#000", label: "Blue" },
  3: { key: "purple", bg: "#ba81c5", text: "#000", label: "Purple" },
  4: { key: "red", bg: "#f28b82", text: "#000", label: "Red" },
  5: { key: "orange", bg: "#f6b76b", text: "#000", label: "Orange" },
};

// Color keys available for hint dots (all 6 category colors)
const HINT_COLORS = ["yellow", "green", "blue", "purple", "red", "orange"];

const DEFAULT_PUZZLE = {
  categories: [
    {
      name: "Things that start with FIRE",
      words: ["ANT", "DRILL", "ISLAND", "OPAL"],
    },
    { name: "Types of FISH", words: ["BASS", "FLOUNDER", "SALMON", "TROUT"] },
    { name: "___ STONE", words: ["COBBLE", "CORNER", "GREY", "LIME"] },
    { name: 'Can be "ROLLING"', words: ["HILLS", "PIN", "STOCK", "THUNDER"] },
  ],
  maxMistakes: 4,
};

// ===================== STATE =====================
let puzzle = null;
let tiles = []; // [{word, catIdx, el}]
let selected = []; // indices into tiles[]
let solved = []; // catIdx values that have been solved
let mistakes = 4; // remaining mistakes
let hints = {}; // word -> color string
let hintTargetWord = null;
let hintPickerOpen = false;
let longPressTimer = null;

// ===================== INIT =====================
async function init() {
  hints = loadHints();
  const params = new URLSearchParams(location.search);

  if (params.get("id")) {
    try {
      puzzle = await loadPuzzleById(params.get("id"));
    } catch (e) {
      showToast("Could not load puzzle.");
      puzzle = DEFAULT_PUZZLE;
    }
  } else {
    // Legacy base64 support
    const urlPuzzle = puzzleFromURL();
    puzzle = urlPuzzle || DEFAULT_PUZZLE;
  }

  trackEvent("start");
  showScreen("game");
  buildGame();
  bindGameButtons();
  bindHintPicker();
  bindModals();
  updateHintPickerSwatches();
}

// ===================== SUPABASE PUZZLE FUNCTIONS =====================

// Save puzzle to Supabase, return short URL using the UUID
async function savePuzzle(puzzleData) {
  const { data, error } = await sb
    .from("puzzles")
    .insert({
      created_by: currentUser?.id ?? null,
      title: puzzleData.title ?? null,
      categories: puzzleData.categories,
      max_mistakes: puzzleData.maxMistakes ?? 4,
    })
    .select("id")
    .single();

  if (error) throw error;
  return `${location.origin}${location.pathname}?id=${data.id}`;
}

// Load puzzle from Supabase by UUID
async function loadPuzzleById(id) {
  const { data, error } = await sb
    .from("puzzles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  // Increment play count (fire and forget)
  sb.from("puzzles")
    .update({ play_count: data.play_count + 1 })
    .eq("id", id);

  return {
    categories: data.categories,
    maxMistakes: data.max_mistakes,
    _id: data.id,
  };
}

// Legacy base64 support
function puzzleFromURL() {
  const params = new URLSearchParams(location.search);
  const p = params.get("p");
  if (!p) return null;
  try {
    const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

// ===================== ANALYTICS =====================
async function trackEvent(type, metadata = {}) {
  await sb.from("game_events").insert({
    puzzle_id: puzzle?._id ?? null,
    user_id: currentUser?.id ?? null,
    event_type: type,
    metadata,
  });
}

// ===================== SCREEN SWITCHING =====================
function showScreen(name) {
  document.getElementById("game-screen").style.display =
    name === "game" ? "flex" : "none";
  document.getElementById("creator-screen").style.display =
    name === "creator" ? "flex" : "none";
}

// ===================== BUILD GAME =====================
function buildGame() {
  solved = [];
  selected = [];
  mistakes = puzzle.maxMistakes !== undefined ? puzzle.maxMistakes : 4;
  hints = loadHints();

  const wordsPerCat = puzzle.categories[0].words.length;

  // Build flat tile list and shuffle
  const allTiles = [];
  puzzle.categories.forEach((cat, ci) => {
    cat.words.forEach((w) =>
      allTiles.push({ word: w.toUpperCase(), catIdx: ci }),
    );
  });
  tiles = shuffle(allTiles);

  // Set grid columns to match word count
  const grid = document.getElementById("grid");
  grid.style.gridTemplateColumns = `repeat(${wordsPerCat}, 1fr)`;

  document.getElementById("solved-categories").innerHTML = "";
  document.getElementById("game-category-hint").textContent =
    `Find ${puzzle.categories.length} groups of ${wordsPerCat}!`;

  renderGrid();
  renderMistakeDots();
}

// ===================== RENDER GRID =====================
function renderGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  tiles.forEach((t, idx) => {
    if (solved.includes(t.catIdx)) return;

    const el = document.createElement("div");
    el.className = "tile";
    el.dataset.idx = idx;
    el.dataset.word = t.word;
    el.textContent = t.word;

    // Hint dots container (top-right corner, up to 2 colors)
    const dotContainer = document.createElement("div");
    dotContainer.className = "tile-hint-container";
    dotContainer.dataset.role = "hint-dot-container";

    const wordHints = hints[t.word] || [];
    if (wordHints.length > 0) {
      wordHints.forEach((colorKey) => {
        const dot = document.createElement("div");
        dot.className = `tile-hint set hint-${colorKey}`;
        dot.style.background =
          Object.values(COLORS).find((c) => c.key === colorKey)?.bg || "#ccc";
        dotContainer.appendChild(dot);
      });
    }
    el.appendChild(dotContainer);

    // Click to select
    el.addEventListener("click", (e) => {
      if (hintPickerOpen) {
        closeHintPicker();
        return;
      }
      onTileClick(idx, el);
    });

    // Right-click → hint picker
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openHintPicker(el, t.word);
    });

    // Long-press (touch) → hint picker
    el.addEventListener(
      "touchstart",
      (e) => {
        longPressTimer = setTimeout(() => {
          openHintPicker(el, t.word);
        }, 500);
      },
      { passive: true },
    );

    el.addEventListener("touchend", () => clearTimeout(longPressTimer));
    el.addEventListener("touchmove", () => clearTimeout(longPressTimer));

    // Long-press (mouse) — desktop fallback
    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      longPressTimer = setTimeout(() => openHintPicker(el, t.word), 500);
    });
    el.addEventListener("mouseup", () => clearTimeout(longPressTimer));
    el.addEventListener("mouseleave", () => clearTimeout(longPressTimer));

    grid.appendChild(el);
    t.el = el;
  });
}

// ===================== TILE SELECTION =====================
function onTileClick(idx, el) {
  const wordsPerCat = puzzle.categories[0].words.length;
  if (selected.includes(idx)) {
    selected = selected.filter((i) => i !== idx);
    el.classList.remove("selected");
  } else {
    if (selected.length >= wordsPerCat) return;
    selected.push(idx);
    el.classList.add("selected");
  }
}

// ===================== SUBMIT =====================
async function handleSubmit() {
  const wordsPerCat = puzzle.categories[0].words.length;

  if (selected.length !== wordsPerCat) {
    showToast(`Select ${wordsPerCat} words first!`);
    return;
  }

  const selCats = selected.map((i) => tiles[i].catIdx);
  const allSame = selCats.every((c) => c === selCats[0]);

  if (allSame) {
    const catIdx = selCats[0];
    await bounceSelectedTiles();

    solved.push(catIdx);
    selected = [];

    appendSolvedCard(catIdx);
    trackEvent("guess_correct", { category: puzzle.categories[catIdx].name });
    renderGrid();
    renderMistakeDots();

    if (solved.length === puzzle.categories.length) {
      setTimeout(() => showResultModal(true), 600);
    }
  } else {
    // "One away" check
    const counts = {};
    selCats.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
    const maxMatch = Math.max(...Object.values(counts));
    if (maxMatch === wordsPerCat - 1) showToast("One away…");

    shakeSelectedTiles();
    mistakes--;
    trackEvent("guess_wrong", { mistakesRemaining: mistakes });
    renderMistakeDots();

    selected.forEach(
      (i) => tiles[i].el && tiles[i].el.classList.remove("selected"),
    );
    selected = [];

    if (mistakes <= 0) {
      setTimeout(() => showResultModal(false), 500);
    }
  }
}

// ===================== ANIMATIONS =====================
async function bounceSelectedTiles() {
  return new Promise((resolve) => {
    const els = selected.map((i) => tiles[i].el).filter(Boolean);
    els.forEach((el, i) => {
      setTimeout(() => {
        el.style.transition = "transform 0.15s ease";
        el.style.transform = "scale(1.08) translateY(-4px)";
        setTimeout(() => {
          el.style.transform = "";
        }, 150);
      }, i * 60);
    });
    setTimeout(resolve, els.length * 60 + 200);
  });
}

function shakeSelectedTiles() {
  selected.forEach((i) => {
    const el = tiles[i].el;
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth; // reflow
    el.classList.add("shake");
    el.addEventListener("animationend", () => el.classList.remove("shake"), {
      once: true,
    });
  });
}

// ===================== SOLVED CARD =====================
function appendSolvedCard(catIdx) {
  const cat = puzzle.categories[catIdx];
  const color = COLORS[catIdx];
  const card = document.createElement("div");
  card.className = "solved-card";
  card.style.background = color.bg;
  card.innerHTML = `
    <div class="solved-card-label">${color.label}</div>
    <div class="solved-card-title">${cat.name}</div>
    <div class="solved-card-words">${cat.words.join(", ")}</div>
  `;
  document.getElementById("solved-categories").appendChild(card);
}

// ===================== MISTAKES DOTS =====================
function renderMistakeDots() {
  const area = document.getElementById("mistake-dots");
  const wrap = area.parentElement;
  const total =
    puzzle && puzzle.maxMistakes !== undefined ? puzzle.maxMistakes : 4;

  wrap.style.display = total === 0 ? "none" : "flex";
  area.innerHTML = "";

  for (let i = 0; i < total; i++) {
    const dot = document.createElement("div");
    dot.className = "mistake-dot" + (i >= mistakes ? " used" : "");
    area.appendChild(dot);
  }
}

// ===================== RESULT MODAL =====================
function showResultModal(won) {
  const total = puzzle.maxMistakes !== undefined ? puzzle.maxMistakes : 4;
  const used = total - mistakes;

  document.getElementById("result-title").textContent = won
    ? "🎉 Solved!"
    : "😔 Better luck next time!";
  document.getElementById("result-msg").textContent = won
    ? `You solved the puzzle with ${used} mistake${used === 1 ? "" : "s"}!`
    : "The correct answers were:";

  const rc = document.getElementById("result-cats");
  rc.innerHTML = "";
  puzzle.categories.forEach((cat, ci) => {
    const color = COLORS[ci];
    const div = document.createElement("div");
    div.className = "result-cat";
    div.style.background = color.bg;
    div.innerHTML = `<strong>${cat.name}</strong><br>
      <span style="font-size:12px;font-weight:500">${cat.words.join(", ")}</span>`;
    rc.appendChild(div);
  });

  const emojiEl = document.getElementById("result-emoji");
  if (emojiEl) {
    emojiEl.textContent = generateEmojiResult();
    const copyBtn = document.getElementById("copy-result-btn");
    if (copyBtn) {
      copyBtn.style.display = "inline-flex";
    }
  }

  trackEvent(won ? "win" : "lose", { mistakesUsed: total - mistakes });
  document.getElementById("result-modal").classList.remove("hidden");
}

// ===================== HINT PICKER =====================
function updateHintPickerSwatches() {
  // Rebuild swatches to include all 6 colors
  const picker = document.getElementById("hint-picker");
  picker.innerHTML = "";

  // Clear swatch
  const clearSwatch = document.createElement("div");
  clearSwatch.className = "hint-swatch none";
  clearSwatch.dataset.color = "none";
  clearSwatch.title = "Clear";
  picker.appendChild(clearSwatch);

  HINT_COLORS.forEach((colorKey) => {
    const color = Object.values(COLORS).find((c) => c.key === colorKey);
    if (!color) return;
    const swatch = document.createElement("div");
    swatch.className = "hint-swatch";
    swatch.dataset.color = colorKey;
    swatch.title = color.label;
    swatch.style.background = color.bg;
    swatch.style.borderColor = color.bg; // subtle
    picker.appendChild(swatch);
  });

  // Re-bind click events on new swatches
  picker.querySelectorAll(".hint-swatch").forEach((swatch) => {
    swatch.addEventListener("click", (e) => {
      e.stopPropagation();
      applyHint(swatch.dataset.color);
    });
  });
}

function openHintPicker(tileEl, word) {
  hintPickerOpen = true;
  hintTargetWord = word;

  const picker = document.getElementById("hint-picker");
  picker.classList.add("visible");

  // Position near tile
  requestAnimationFrame(() => {
    const rect = tileEl.getBoundingClientRect();
    const pw = picker.offsetWidth;
    const ph = picker.offsetHeight;
    let left = rect.right - pw;
    let top = rect.top - ph - 8;
    if (top < 8) top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    picker.style.left = left + "px";
    picker.style.top = top + "px";
  });
}

function closeHintPicker() {
  hintPickerOpen = false;
  hintTargetWord = null;
  document.getElementById("hint-picker").classList.remove("visible");
}

function applyHint(color) {
  if (!hintTargetWord) return;

  // Initialize or get existing hints for this word
  if (!hints[hintTargetWord]) {
    hints[hintTargetWord] = [];
  }

  // "none" clears all hints
  if (color === "none") {
    delete hints[hintTargetWord];
  } else {
    // Toggle the color (add if not present, remove if present)
    const idx = hints[hintTargetWord].indexOf(color);
    if (idx > -1) {
      hints[hintTargetWord].splice(idx, 1);
    } else if (hints[hintTargetWord].length < 2) {
      // Allow max 2 colors
      hints[hintTargetWord].push(color);
    } else {
      // If already 2 colors, replace the one we clicked
      hints[hintTargetWord][1] = color;
    }

    // Clean up empty arrays
    if (hints[hintTargetWord].length === 0) {
      delete hints[hintTargetWord];
    }
  }
  saveHints();

  // Update dots on matching tile element
  tiles.forEach((t) => {
    if (t.word === hintTargetWord && t.el) {
      const container = t.el.querySelector('[data-role="hint-dot-container"]');
      if (container) {
        container.innerHTML = "";
        const wordHints = hints[hintTargetWord] || [];
        wordHints.forEach((colorKey) => {
          const dot = document.createElement("div");
          dot.className = `tile-hint set hint-${colorKey}`;
          dot.style.background =
            Object.values(COLORS).find((c) => c.key === colorKey)?.bg || "#ccc";
          container.appendChild(dot);
        });
      }
    }
  });

  closeHintPicker();
}

// ===================== HINT STORAGE =====================
function loadHints() {
  try {
    return JSON.parse(sessionStorage.getItem("conn_hints") || "{}");
  } catch {
    return {};
  }
}

function saveHints() {
  try {
    sessionStorage.setItem("conn_hints", JSON.stringify(hints));
  } catch {}
}

// ===================== BIND BUTTONS =====================
function bindGameButtons() {
  document.getElementById("submit-btn").addEventListener("click", handleSubmit);

  document.getElementById("shuffle-btn").addEventListener("click", () => {
    const unsolved = tiles.filter((t) => !solved.includes(t.catIdx));
    const shuffled = shuffle(unsolved);
    let si = 0;
    tiles = tiles.map((t) => (solved.includes(t.catIdx) ? t : shuffled[si++]));
    selected = [];
    renderGrid();
  });

  document.getElementById("deselect-btn").addEventListener("click", () => {
    selected.forEach(
      (i) => tiles[i].el && tiles[i].el.classList.remove("selected"),
    );
    selected = [];
  });

  document.getElementById("how-to-btn").addEventListener("click", () => {
    document.getElementById("how-to-modal").classList.remove("hidden");
  });

  document.getElementById("puzzles-btn").addEventListener("click", () => {
    loadAndShowPuzzles();
  });

  document.getElementById("create-btn").addEventListener("click", () => {
    openCreator();
  });

  document.getElementById("result-create-btn").addEventListener("click", () => {
    closeModal("result-modal");
    openCreator();
  });

  document
    .getElementById("result-play-again-btn")
    .addEventListener("click", () => {
      closeModal("result-modal");
      buildGame();
    });
}

function bindHintPicker() {
  // Close on click outside
  document.addEventListener("click", (e) => {
    if (hintPickerOpen && !e.target.closest("#hint-picker")) closeHintPicker();
  });

  document.addEventListener(
    "touchstart",
    (e) => {
      if (hintPickerOpen && !e.target.closest("#hint-picker"))
        closeHintPicker();
    },
    { passive: true },
  );
}

function bindModals() {
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.add("hidden");
    });
  });
}

// ===================== MODAL HELPERS =====================
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// ===================== TOAST =====================
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

// ===================== PUZZLE BROWSER =====================
async function loadAndShowPuzzles() {
  const list = document.getElementById("puzzles-list");
  list.innerHTML =
    '<div style="text-align: center; color: var(--text-muted);">Loading puzzles...</div>';

  try {
    const { data, error } = await sb
      .from("puzzles")
      .select("id, title, created_at, play_count, created_by")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!data || data.length === 0) {
      list.innerHTML =
        '<div style="text-align: center; color: var(--text-muted);">No puzzles yet. Create one!</div>';
      document.getElementById("puzzles-modal").classList.remove("hidden");
      return;
    }

    list.innerHTML = "";
    data.forEach((puz) => {
      const item = document.createElement("div");
      item.className = "puzzle-item";
      const title = puz.title || "Untitled Puzzle";
      const date = new Date(puz.created_at).toLocaleDateString();
      const creator = puz.created_by ? "(Custom)" : "(Default)";

      item.innerHTML = `
        <div class="puzzle-item-title">${escapeHtml(title)}</div>
        <div class="puzzle-item-meta">${creator} • ${puz.play_count} plays • ${date}</div>
      `;

      item.addEventListener("click", () => {
        closeModal("puzzles-modal");
        window.location.href = `${location.pathname}?id=${puz.id}`;
      });

      list.appendChild(item);
    });

    document.getElementById("puzzles-modal").classList.remove("hidden");
  } catch (err) {
    list.innerHTML =
      '<div style="text-align: center; color: var(--text-muted);">Error loading puzzles</div>';
    document.getElementById("puzzles-modal").classList.remove("hidden");
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===================== AUTH UI =====================
function updateAuthUI() {
  const btn = document.getElementById("auth-btn");
  if (!btn) return;
  btn.textContent = currentUser ? "My Puzzles" : "Sign In";
}

async function handleAuth() {
  if (currentUser) {
    // Show a simple "my puzzles" list — query puzzles by created_by
    const { data } = await sb
      .from("puzzles")
      .select("id, title, created_at, play_count")
      .eq("created_by", currentUser.id)
      .order("created_at", { ascending: false });

    // Display them however you like — a modal works well
    console.log("Your puzzles:", data);
  } else {
    // Trigger magic link / email login
    const email = prompt("Enter your email for a magic sign-in link:");
    if (email) {
      await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.href },
      });
      showToast("Check your email for a sign-in link!");
    }
  }
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
// ===================== EMOJI COPY FUNCTIONALITY =====================
const EMOJI_MAP = {
  yellow: "🟨",
  green: "🟩",
  blue: "🟦",
  purple: "🟪",
  red: "🟥",
  orange: "🟧",
};

function generateEmojiResult() {
  const total = puzzle.maxMistakes !== undefined ? puzzle.maxMistakes : 4;
  const used = total - mistakes;
  const emojiLines = [];

  puzzle.categories.forEach((cat, ci) => {
    const color = COLORS[ci];
    const emoji = EMOJI_MAP[color.key] || "⬜";
    emojiLines.push(emoji.repeat(puzzle.categories[0].words.length));
  });

  const emojiStr = emojiLines.join("\n");
  return emojiStr;
}

function handleCopyResult() {
  const emojiText = generateEmojiResult();
  const resultText = `Connections PLUS!\n\n${emojiText}`;

  navigator.clipboard
    .writeText(resultText)
    .then(() => showToast("Result copied!"))
    .catch(() => {
      const ta = document.createElement("textarea");
      ta.value = resultText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("Result copied!");
    });
}

// ===================== PUZZLE BROWSER =====================
async function openPuzzlesBrowser() {
  const modal = document.getElementById("puzzles-modal");
  if (!modal) return;

  modal.classList.remove("hidden");
  const listEl = document.getElementById("puzzles-list");
  listEl.innerHTML =
    '<p style="text-align: center; color: var(--text-muted);">Loading puzzles...</p>';

  try {
    const { data, error } = await sb
      .from("puzzles")
      .select("id, title, created_at, play_count, categories")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    listEl.innerHTML = "";
    if (data.length === 0) {
      listEl.innerHTML =
        '<p style="text-align: center; color: var(--text-muted);">No puzzles found.</p>';
      return;
    }

    data.forEach((p) => {
      const item = document.createElement("div");
      item.className = "puzzle-item";
      const catCount = p.categories?.length || 0;
      const title = p.title || "Untitled Puzzle";
      item.innerHTML = `
        <div class="puzzle-item-title">${escapeHtml(title)}</div>
        <div class="puzzle-item-meta">${catCount} categories • ${p.play_count} plays</div>
      `;
      item.addEventListener("click", () => {
        loadAndPlayPuzzle(p.id);
        closeModal("puzzles-modal");
      });
      listEl.appendChild(item);
    });
  } catch (e) {
    listEl.innerHTML =
      '<p style="text-align: center; color: red;">Error loading puzzles.</p>';
    console.error(e);
  }
}

async function loadAndPlayPuzzle(id) {
  try {
    puzzle = await loadPuzzleById(id);
    history.pushState({}, "", `${location.pathname}?id=${id}`);
    trackEvent("start");
    showScreen("game");
    buildGame();
  } catch (e) {
    showToast("Could not load puzzle.");
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}


