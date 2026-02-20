// Create page functionality

// DOM Elements
const puzzleForm = document.getElementById("puzzle-form");
const puzzleNameInput = document.getElementById("puzzle-name");
const mistakesSelect = document.getElementById("mistakes-select");
const previewBtn = document.getElementById("preview-btn");
const clearBtn = document.getElementById("clear-btn");
const shareSection = document.getElementById("share-section");
const shareLink = document.getElementById("share-link");
const copyBtn = document.getElementById("copy-btn");
const copyMessage = document.getElementById("copy-message");
const themeToggle = document.getElementById("theme-toggle");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadSavedForm();
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

// Save form data to localStorage
function saveFormData() {
  const formData = getFormData();
  localStorage.setItem("connections-create-form", JSON.stringify(formData));
}

// Load saved form data
function loadSavedForm() {
  const saved = localStorage.getItem("connections-create-form");
  if (saved) {
    try {
      const formData = JSON.parse(saved);
      populateForm(formData);
    } catch (e) {
      console.error("Failed to load saved form:", e);
    }
  }
}

// Populate form with data
function populateForm(formData) {
  const categoryInputs = document.querySelectorAll(".category-input");
  const colors = ["yellow", "green", "blue", "purple"];

  // Populate puzzle name
  if (formData.name && puzzleNameInput) {
    puzzleNameInput.value = formData.name;
  }

  colors.forEach((color, index) => {
    const category = formData.categories[index];
    if (category) {
      const container = categoryInputs[index];
      const nameInput = container.querySelector(".category-name");
      const itemInputs = container.querySelectorAll(".item-input");

      nameInput.value = category.name || "";
      category.items.forEach((item, i) => {
        if (itemInputs[i]) {
          itemInputs[i].value = item || "";
        }
      });
    }
  });

  if (formData.mistakes) {
    mistakesSelect.value =
      formData.mistakes === -1 ? "unlimited" : formData.mistakes;
  }
}

// Get form data
function getFormData() {
  const categoryInputs = document.querySelectorAll(".category-input");
  const colors = ["yellow", "green", "blue", "purple"];

  const categories = [];
  categoryInputs.forEach((container, index) => {
    const nameInput = container.querySelector(".category-name");
    const itemInputs = container.querySelectorAll(".item-input");

    const items = Array.from(itemInputs).map((input) =>
      input.value.trim().toUpperCase(),
    );

    categories.push({
      name: nameInput.value.trim().toUpperCase(),
      color: colors[index],
      items: items,
    });
  });

  const mistakesValue = mistakesSelect.value;
  const mistakes = mistakesValue === "unlimited" ? -1 : parseInt(mistakesValue);

  // Get puzzle name
  const puzzleName = puzzleNameInput ? puzzleNameInput.value.trim() : "";

  return {
    name: puzzleName || "Custom Puzzle",
    categories,
    mistakes,
  };
}

// Validate form data
function validateForm() {
  const formData = getFormData();
  const allItems = [];
  const errors = [];

  // Check each category
  formData.categories.forEach((category, index) => {
    const colorNames = ["Yellow", "Green", "Blue", "Purple"];

    if (!category.name) {
      errors.push(`${colorNames[index]} category needs a name`);
    }

    category.items.forEach((item, itemIndex) => {
      if (!item) {
        errors.push(
          `${colorNames[index]} category is missing item ${itemIndex + 1}`,
        );
      } else {
        if (allItems.includes(item)) {
          errors.push(`Duplicate item: "${item}"`);
        } else {
          allItems.push(item);
        }
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// LZ-String compression (minimal implementation for URL encoding)
const LZString = {
  _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",

  compressToEncodedURIComponent: function (input) {
    if (input == null) return "";
    return this._compress(input, 6, function (a) {
      return LZString._keyStr.charAt(a);
    });
  },

  _compress: function (uncompressed, bitsPerChar, getCharFromInt) {
    if (uncompressed == null) return "";
    let i,
      value,
      context_dictionary = {},
      context_dictionaryToCreate = {},
      context_c = "",
      context_wc = "",
      context_w = "",
      context_enlargeIn = 2,
      context_dictSize = 3,
      context_numBits = 2,
      context_data = [],
      context_data_val = 0,
      context_data_position = 0;

    for (i = 0; i < uncompressed.length; i++) {
      context_c = uncompressed.charAt(i);
      if (
        !Object.prototype.hasOwnProperty.call(context_dictionary, context_c)
      ) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }
      context_wc = context_w + context_c;
      if (
        Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)
      ) {
        context_w = context_wc;
      } else {
        if (
          Object.prototype.hasOwnProperty.call(
            context_dictionaryToCreate,
            context_w,
          )
        ) {
          if (context_w.charCodeAt(0) < 256) {
            for (i = 0; i < context_numBits; i++) {
              context_data_val = context_data_val << 1;
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 8; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i = 0; i < context_numBits; i++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 16; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }
    if (context_w !== "") {
      if (
        Object.prototype.hasOwnProperty.call(
          context_dictionaryToCreate,
          context_w,
        )
      ) {
        if (context_w.charCodeAt(0) < 256) {
          for (i = 0; i < context_numBits; i++) {
            context_data_val = context_data_val << 1;
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
          }
          value = context_w.charCodeAt(0);
          for (i = 0; i < 8; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        } else {
          value = 1;
          for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (i = 0; i < 16; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i = 0; i < context_numBits; i++) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position == bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }
      }
      context_enlargeIn--;
      if (context_enlargeIn == 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }
    value = 2;
    for (i = 0; i < context_numBits; i++) {
      context_data_val = (context_data_val << 1) | (value & 1);
      if (context_data_position == bitsPerChar - 1) {
        context_data_position = 0;
        context_data.push(getCharFromInt(context_data_val));
        context_data_val = 0;
      } else {
        context_data_position++;
      }
      value = value >> 1;
    }
    while (true) {
      context_data_val = context_data_val << 1;
      if (context_data_position == bitsPerChar - 1) {
        context_data.push(getCharFromInt(context_data_val));
        break;
      } else context_data_position++;
    }
    return context_data.join("");
  },
};

// Encode puzzle for URL using compact format + LZ compression
function encodePuzzle(puzzleData) {
  // Create compact format: name|mistakes|cat1name,item1,item2,item3,item4|cat2...|cat3...|cat4...
  const parts = [puzzleData.name, puzzleData.mistakes.toString()];

  puzzleData.categories.forEach((cat) => {
    parts.push([cat.name, ...cat.items].join(","));
  });

  const compact = parts.join("|");
  return LZString.compressToEncodedURIComponent(compact);
}

// Generate share link
function generateShareLink() {
  const formData = getFormData();
  const encoded = encodePuzzle(formData);

  // Get base URL (works for both local and GitHub Pages)
  const baseUrl = window.location.href
    .replace("create.html", "index.html")
    .split("?")[0];
  return `${baseUrl}?p=${encoded}`;
}

// Handle form submit
puzzleForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const validation = validateForm();

  if (!validation.valid) {
    alert(
      "Please fix the following errors:\n\n" + validation.errors.join("\n"),
    );
    return;
  }

  saveFormData();

  const link = generateShareLink();
  shareLink.value = link;
  shareSection.style.display = "block";
  copyMessage.textContent = "";

  // Scroll to share section
  shareSection.scrollIntoView({ behavior: "smooth" });
});

// Handle preview
previewBtn.addEventListener("click", () => {
  const validation = validateForm();

  if (!validation.valid) {
    alert(
      "Please fix the following errors:\n\n" + validation.errors.join("\n"),
    );
    return;
  }

  saveFormData();

  const link = generateShareLink();
  window.open(link, "_blank");
});

// Handle clear
clearBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all fields?")) {
    puzzleForm.reset();
    shareSection.style.display = "none";
    localStorage.removeItem("connections-create-form");
  }
});

// Handle copy
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    copyMessage.textContent = "Link copied to clipboard!";
    setTimeout(() => {
      copyMessage.textContent = "";
    }, 3000);
  } catch (e) {
    // Fallback for older browsers
    shareLink.select();
    document.execCommand("copy");
    copyMessage.textContent = "Link copied to clipboard!";
    setTimeout(() => {
      copyMessage.textContent = "";
    }, 3000);
  }
});

// Auto-save on input
document.querySelectorAll("input, select").forEach((el) => {
  el.addEventListener("input", saveFormData);
  el.addEventListener("change", saveFormData);
});
