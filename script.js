// Pre-made puzzles library - Add more puzzles here!
const puzzleLibrary = [
  {
    id: "motorsports",
    name: "Motorsports Legends",
    description: "Racing drivers across different series",
    puzzle: {
      categories: [
        {
          name: "NASCAR Drivers",
          color: "yellow",
          items: ["EARNHARDT", "JOHNSON", "PETTY", "WALTRIP"],
        },
        {
          name: "IndyCar Drivers",
          color: "green",
          items: ["DIXON", "ANDRETTI", "PALOU", "FOYT"],
        },
        {
          name: "Formula 1 Drivers",
          color: "blue",
          items: ["HAMILTON", "SCHUMACHER", "VERSTAPPEN", "ALONSO"],
        },
        {
          name: "MotoGP Riders",
          color: "purple",
          items: ["ROSSI", "MARQUEZ", "AGOSTINI", "DOOHAN"],
        },
      ],
      mistakes: 4,
    },
  },
  {
    id: "ohio",
    name: "All About Ohio",
    description: "The Buckeye State",
    puzzle: {
      categories: [
        {
          name: "Ohio State University",
          color: "yellow",
          items: ["BUCKEYES", "SCARLET", "SCRIPT OHIO", "HAYES"],
        },
        {
          name: "Ohio State Symbols",
          color: "green",
          items: ["CARDINAL", "CARNATION", "FLINT", "LADYBUG"],
        },
        {
          name: "Rivers in Ohio",
          color: "blue",
          items: ["CUYAHOGA", "MAUMEE", "SCIOTO", "MIAMI"],
        },
        {
          name: "Famous Ohioans",
          color: "purple",
          items: ["ARMSTRONG", "JAMES", "GLENN", "SPIELBERG"],
        },
      ],
      mistakes: 4,
    },
  },
  // Add more puzzles here following the same format!
  // {
  //   id: "unique-id",
  //   name: "Puzzle Name",
  //   description: "Short description",
  //   puzzle: {
  //     categories: [
  //       { name: "Category 1", color: "yellow", items: ["ITEM1", "ITEM2", "ITEM3", "ITEM4"] },
  //       { name: "Category 2", color: "green", items: ["ITEM1", "ITEM2", "ITEM3", "ITEM4"] },
  //       { name: "Category 3", color: "blue", items: ["ITEM1", "ITEM2", "ITEM3", "ITEM4"] },
  //       { name: "Category 4", color: "purple", items: ["ITEM1", "ITEM2", "ITEM3", "ITEM4"] },
  //     ],
  //     mistakes: 4,
  //   },
  // },
];

// Default puzzle (first in library)
const defaultPuzzle = puzzleLibrary[0].puzzle;

// Color emoji mapping
const colorEmojis = {
  yellow: "🟨",
  green: "🟩",
  blue: "🟦",
  purple: "🟪",
};

// Game State
let puzzle = null;
let puzzleName = null;
let selectedTiles = [];
let solvedCategories = [];
let mistakesRemaining = 4;
let maxMistakes = 4;
let isUnlimited = false;
let gameOver = false;
let guessHistory = [];
let currentPuzzleId = null;

// DOM Elements
const gameGrid = document.getElementById("game-grid");
const solvedContainer = document.getElementById("solved-container");
const mistakesDots = document.getElementById("mistakes-dots");
const shuffleBtn = document.getElementById("shuffle-btn");
const deselectBtn = document.getElementById("deselect-btn");
const submitBtn = document.getElementById("submit-btn");
const messageEl = document.getElementById("message");
const newGameBtn = document.getElementById("new-game-btn");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalResults = document.getElementById("modal-results");
const modalClose = document.getElementById("modal-close");
const themeToggle = document.getElementById("theme-toggle");
const puzzleSelect = document.getElementById("puzzle-select");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initPuzzleLibrary();
  loadPuzzle();
});

// Theme handling
function initTheme() {
  const savedTheme = localStorage.getItem("connections-theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("connections-theme", newTheme);
  });
}

// Initialize puzzle library dropdown
function initPuzzleLibrary() {
  if (!puzzleSelect) return;

  puzzleSelect.innerHTML = '<option value="">Select a puzzle...</option>';
  puzzleLibrary.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.name;
    puzzleSelect.appendChild(option);
  });

  puzzleSelect.addEventListener("change", (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      const selectedPuzzle = puzzleLibrary.find((p) => p.id === selectedId);
      if (selectedPuzzle) {
        currentPuzzleId = selectedId;
        puzzleName = selectedPuzzle.name;
        puzzle = JSON.parse(JSON.stringify(selectedPuzzle.puzzle));
        maxMistakes = puzzle.mistakes;
        isUnlimited = puzzle.mistakes === "unlimited" || puzzle.mistakes === -1;
        mistakesRemaining = isUnlimited ? -1 : maxMistakes;
        // Clear URL params when selecting from library
        window.history.replaceState({}, "", window.location.pathname);
        updatePuzzleNameDisplay(null);
        initGame();
      }
    }
  });
}

// Load puzzle from URL or use default
function loadPuzzle() {
  const urlParams = new URLSearchParams(window.location.search);
  const puzzleData = urlParams.get("p");

  if (puzzleData) {
    try {
      const decoded = decodePuzzle(puzzleData);
      // Handle both new format (with name) and old format (without name)
      if (decoded.categories) {
        puzzle = decoded;
        puzzleName = decoded.name || "Custom Puzzle";
      } else {
        puzzle = decoded;
        puzzleName = "Custom Puzzle";
      }
      currentPuzzleId = null;
      if (puzzleSelect) puzzleSelect.value = "";
      updatePuzzleNameDisplay(puzzleName);
    } catch (e) {
      console.error("Failed to load puzzle from URL:", e);
      puzzle = JSON.parse(JSON.stringify(defaultPuzzle));
      puzzleName = puzzleLibrary[0].name;
      currentPuzzleId = puzzleLibrary[0].id;
      if (puzzleSelect) puzzleSelect.value = currentPuzzleId;
      updatePuzzleNameDisplay(null);
    }
  } else {
    puzzle = JSON.parse(JSON.stringify(defaultPuzzle));
    puzzleName = puzzleLibrary[0].name;
    currentPuzzleId = puzzleLibrary[0].id;
    if (puzzleSelect) puzzleSelect.value = currentPuzzleId;
    updatePuzzleNameDisplay(null);
  }

  maxMistakes = puzzle.mistakes;
  isUnlimited = puzzle.mistakes === "unlimited" || puzzle.mistakes === -1;
  mistakesRemaining = isUnlimited ? -1 : maxMistakes;

  initGame();
}

// Update the puzzle name display for custom puzzles
function updatePuzzleNameDisplay(name) {
  const puzzleNameDisplay = document.getElementById("puzzle-name-display");
  const puzzleSelectorContainer = document.querySelector(".puzzle-selector");

  if (name && puzzleNameDisplay) {
    puzzleNameDisplay.textContent = name;
    puzzleNameDisplay.style.display = "block";
    if (puzzleSelectorContainer) puzzleSelectorContainer.style.display = "none";
  } else if (puzzleNameDisplay) {
    puzzleNameDisplay.style.display = "none";
    if (puzzleSelectorContainer) puzzleSelectorContainer.style.display = "flex";
  }
}

// Encode puzzle for URL sharing
function encodePuzzle(puzzleData) {
  const json = JSON.stringify(puzzleData);
  return btoa(encodeURIComponent(json));
}

// Decode puzzle from URL
function decodePuzzle(encoded) {
  const json = decodeURIComponent(atob(encoded));
  return JSON.parse(json);
}

// Initialize game
function initGame() {
  selectedTiles = [];
  solvedCategories = [];
  gameOver = false;
  guessHistory = [];
  mistakesRemaining = isUnlimited ? -1 : maxMistakes;

  renderMistakes();
  renderGrid();
  updateSubmitButton();
  clearMessage();

  newGameBtn.style.display = "none";
  solvedContainer.innerHTML = "";

  // Hide share section if exists
  const shareResults = document.getElementById("share-results");
  if (shareResults) shareResults.style.display = "none";

  // Enable controls
  shuffleBtn.disabled = false;
  deselectBtn.disabled = false;
}

// Render mistakes indicator
function renderMistakes() {
  mistakesDots.innerHTML = "";

  if (isUnlimited) {
    const unlimitedSpan = document.createElement("span");
    unlimitedSpan.className = "unlimited-text";
    unlimitedSpan.textContent = "∞";
    mistakesDots.appendChild(unlimitedSpan);
  } else {
    for (let i = 0; i < maxMistakes; i++) {
      const dot = document.createElement("div");
      dot.className = "mistake-dot";
      if (i >= mistakesRemaining) {
        dot.classList.add("used");
      }
      mistakesDots.appendChild(dot);
    }
  }
}

// Get all remaining (unsolved) items
function getRemainingItems() {
  const solvedItems = new Set(solvedCategories.flatMap((c) => c.items));
  const allItems = puzzle.categories.flatMap((c) => c.items);
  return allItems.filter((item) => !solvedItems.has(item));
}

// Shuffle array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Render game grid
function renderGrid() {
  gameGrid.innerHTML = "";
  const items = shuffleArray(getRemainingItems());

  items.forEach((item) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.textContent = item;
    tile.dataset.item = item;

    if (selectedTiles.includes(item)) {
      tile.classList.add("selected");
    }

    if (gameOver) {
      tile.classList.add("disabled");
    } else {
      tile.addEventListener("click", () => handleTileClick(item));
    }

    gameGrid.appendChild(tile);
  });
}

// Handle tile click
function handleTileClick(item) {
  if (gameOver) return;

  clearMessage();

  if (selectedTiles.includes(item)) {
    selectedTiles = selectedTiles.filter((i) => i !== item);
  } else if (selectedTiles.length < 4) {
    selectedTiles.push(item);
  }

  updateTileStates();
  updateSubmitButton();
}

// Update tile visual states
function updateTileStates() {
  const tiles = document.querySelectorAll(".tile");
  tiles.forEach((tile) => {
    const item = tile.dataset.item;
    if (selectedTiles.includes(item)) {
      tile.classList.add("selected");
    } else {
      tile.classList.remove("selected");
    }
  });
}

// Update submit button state
function updateSubmitButton() {
  submitBtn.disabled = selectedTiles.length !== 4 || gameOver;
}

// Show message
function showMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = "message";
  if (type) {
    messageEl.classList.add(type);
  }
}

// Clear message
function clearMessage() {
  messageEl.textContent = "";
  messageEl.className = "message";
}

// Handle submit
function handleSubmit() {
  if (selectedTiles.length !== 4 || gameOver) return;

  // Check if this exact guess was already made
  const sortedGuess = [...selectedTiles].sort().join(",");
  if (guessHistory.includes(sortedGuess)) {
    showMessage("Already guessed!", "error");
    return;
  }
  guessHistory.push(sortedGuess);

  // Find matching category
  const matchingCategory = puzzle.categories.find((cat) => {
    const categoryItems = new Set(cat.items.map((i) => i.toUpperCase()));
    return (
      selectedTiles.every((item) => categoryItems.has(item.toUpperCase())) &&
      selectedTiles.length === 4
    );
  });

  if (matchingCategory) {
    // Correct guess!
    handleCorrectGuess(matchingCategory);
  } else {
    // Check how many items are from the same category (for "one away" hint)
    const maxMatch = getMaxCategoryMatch();
    handleWrongGuess(maxMatch);
  }
}

// Get maximum items matching any single category
function getMaxCategoryMatch() {
  let maxMatch = 0;
  puzzle.categories.forEach((cat) => {
    const categoryItems = new Set(cat.items.map((i) => i.toUpperCase()));
    const matchCount = selectedTiles.filter((item) =>
      categoryItems.has(item.toUpperCase()),
    ).length;
    maxMatch = Math.max(maxMatch, matchCount);
  });
  return maxMatch;
}

// Handle correct guess with fluid animation
function handleCorrectGuess(category) {
  solvedCategories.push(category);

  // Get selected tiles and their positions
  const selectedTileEls = document.querySelectorAll(".tile.selected");
  const gridRect = gameGrid.getBoundingClientRect();
  const solvedRect = solvedContainer.getBoundingClientRect();

  // Calculate target position (where the new solved row will appear)
  const targetY = solvedRect.bottom - gridRect.top + 10;

  // Animate tiles flying up
  selectedTileEls.forEach((tile, index) => {
    const tileRect = tile.getBoundingClientRect();
    const startX = tileRect.left - gridRect.left;
    const startY = tileRect.top - gridRect.top;

    // Calculate end position (spread across the row)
    const rowWidth = gridRect.width;
    const tileWidth = rowWidth / 4;
    const endX = index * tileWidth + tileWidth / 2 - tileRect.width / 2;
    const endY = -tileRect.height - 20;

    tile.style.position = "absolute";
    tile.style.left = startX + "px";
    tile.style.top = startY + "px";
    tile.style.width = tileRect.width + "px";
    tile.style.height = tileRect.height + "px";
    tile.style.zIndex = "100";
    tile.classList.add("flying");
    tile.classList.remove("selected");

    // Apply the category color during animation
    tile.style.backgroundColor = `var(--${category.color}-bg)`;
    tile.style.color = `var(--${category.color}-text)`;

    // Animate to final position
    requestAnimationFrame(() => {
      tile.style.transition = "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
      tile.style.left = endX + "px";
      tile.style.top = endY + "px";
      tile.style.opacity = "0";
      tile.style.transform = "scale(0.8)";
    });
  });

  showMessage("Correct! 🎉", "success");

  setTimeout(() => {
    // Add solved row
    addSolvedRow(category);

    // Clear selection
    selectedTiles = [];

    // Check for win
    if (solvedCategories.length === 4) {
      handleWin();
    } else {
      renderGrid();
      updateSubmitButton();
    }
  }, 500);
}

// Handle wrong guess
function handleWrongGuess(maxMatch) {
  // Animate shake
  const tiles = document.querySelectorAll(".tile.selected");
  tiles.forEach((tile) => {
    tile.classList.add("shake");
    setTimeout(() => tile.classList.remove("shake"), 500);
  });

  if (!isUnlimited) {
    mistakesRemaining--;
    renderMistakes();
  }

  if (maxMatch === 3) {
    showMessage("One away...", "error");
  } else {
    showMessage("Incorrect!", "error");
  }

  if (!isUnlimited && mistakesRemaining <= 0) {
    handleLoss();
  }
}

// Add solved category row
function addSolvedRow(category) {
  const row = document.createElement("div");
  row.className = `solved-row ${category.color}`;

  const categoryName = document.createElement("div");
  categoryName.className = "solved-category";
  categoryName.textContent = category.name;

  const items = document.createElement("div");
  items.className = "solved-items";
  items.textContent = category.items.join(", ");

  row.appendChild(categoryName);
  row.appendChild(items);
  solvedContainer.appendChild(row);
}

// Handle win
function handleWin() {
  gameOver = true;

  // Clear the grid since all categories are solved
  gameGrid.innerHTML = "";

  setTimeout(() => {
    showModal("Congratulations!", "You found all the connections!", true);
  }, 300);

  newGameBtn.style.display = "block";
  showShareSection();
  disableControls();
}

// Handle loss
function handleLoss() {
  gameOver = true;

  // Reveal remaining categories
  const remaining = puzzle.categories.filter(
    (cat) => !solvedCategories.includes(cat),
  );
  remaining.forEach((cat) => {
    solvedCategories.push(cat); // Add to solved for results tracking
    addSolvedRow(cat);
  });

  // Clear grid
  gameGrid.innerHTML = "";

  setTimeout(() => {
    showModal("Game Over", "Better luck next time!", false);
  }, 500);

  newGameBtn.style.display = "block";
  showShareSection();
  disableControls();
}

// Generate shareable results text
function generateShareText(won) {
  const displayName = puzzleName || "Connections";
  const title = won ? `${displayName} ✨` : displayName;

  let text = `${title}\n`;

  // Add emoji grid for each guess
  guessHistory.forEach((guess) => {
    const guessItems = guess.split(",");
    let row = "";
    guessItems.forEach((item) => {
      const category = puzzle.categories.find((cat) =>
        cat.items.map((i) => i.toUpperCase()).includes(item.toUpperCase()),
      );
      if (category) {
        row += colorEmojis[category.color];
      }
    });
    text += row + "\n";
  });

  return text.trim();
}

// Show share section
function showShareSection() {
  const shareResults = document.getElementById("share-results");
  const shareText = document.getElementById("share-text");

  if (shareResults && shareText) {
    const won = solvedCategories.length === 4 && mistakesRemaining !== 0;
    shareText.value = generateShareText(
      won || (isUnlimited && solvedCategories.length === 4),
    );
    shareResults.style.display = "block";
  }
}

// Disable controls
function disableControls() {
  shuffleBtn.disabled = true;
  deselectBtn.disabled = true;
  submitBtn.disabled = true;
}

// Show modal
function showModal(title, message, won = false) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;

  // Build results visualization
  modalResults.innerHTML = "";
  guessHistory.forEach((guess) => {
    const guessItems = guess.split(",");
    const row = document.createElement("div");
    row.className = "result-row";

    guessItems.forEach((item) => {
      const dot = document.createElement("div");
      dot.className = "result-dot";

      // Find which category this item belongs to
      const category = puzzle.categories.find((cat) =>
        cat.items.map((i) => i.toUpperCase()).includes(item.toUpperCase()),
      );
      if (category) {
        dot.classList.add(category.color);
      }

      row.appendChild(dot);
    });

    modalResults.appendChild(row);
  });

  modal.classList.add("show");
}

// Hide modal
function hideModal() {
  modal.classList.remove("show");
}

// Shuffle remaining tiles
function shuffleTiles() {
  renderGrid();
}

// Deselect all tiles
function deselectAll() {
  selectedTiles = [];
  updateTileStates();
  updateSubmitButton();
  clearMessage();
}

// Copy share text
function copyShareText() {
  const shareText = document.getElementById("share-text");
  if (shareText) {
    navigator.clipboard.writeText(shareText.value).then(() => {
      const copyBtn = document.getElementById("copy-share-btn");
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      }
    });
  }
}

// Event Listeners
shuffleBtn.addEventListener("click", shuffleTiles);
deselectBtn.addEventListener("click", deselectAll);
submitBtn.addEventListener("click", handleSubmit);
newGameBtn.addEventListener("click", initGame);
modalClose.addEventListener("click", hideModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) hideModal();
});

// Copy share button listener
document.addEventListener("DOMContentLoaded", () => {
  const copyShareBtn = document.getElementById("copy-share-btn");
  if (copyShareBtn) {
    copyShareBtn.addEventListener("click", copyShareText);
  }
});

// Keyboard support
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && selectedTiles.length === 4 && !gameOver) {
    handleSubmit();
  }
  if (e.key === "Escape") {
    if (modal.classList.contains("show")) {
      hideModal();
    } else {
      deselectAll();
    }
  }
});
