// ================================================
// Dzongkha Live Spelling Checker - Script
// Dictionary loaded from Google Sheets
// ================================================

let errorMap = {}; // Global dictionary object

// ================== GOOGLE SHEETS CONFIG ==================
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjXCQZmHCEOZpHxMHd0tYFnXl9kDxmIwTviWqMlLYi0lCgL3bG3EKpuaNTtxPMpYIt4DY-8uw3NtCV/pub?gid=0&single=true&output=csv";

// Load dictionary from Google Sheets
async function loadDictionary() {
  try {
    console.log("📡 Loading dictionary from Google Sheets...");
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error("Failed to fetch sheet");
    const csvText = await response.text();
    errorMap = parseCSVToErrorMap(csvText);
    console.log(`✅ Dictionary loaded! Total entries: ${Object.keys(errorMap).length}`);
    if (inputArea && inputArea.value.trim()) {
      checkText(inputArea.value);
    }
  } catch (error) {
    console.error("❌ Failed to load data:", error);
    alert("Could not load dictionary from Google Sheets.\n\nPlease check your internet or CSV link.");
  }
}

function parseCSVToErrorMap(csv) {
  const lines = csv.trim().split('\n');
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const columns = parseCSVLine(line);
    if (columns.length >= 4) {
      const wrong = columns[0].trim();
      const correct = columns[1].trim();
      const rule = columns[2].trim();
      const category = columns[3].trim();
      if (wrong) {
        map[wrong] = { correct, rule, category };
      }
    }
  }
  return map;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ================== DOM ELEMENTS ==================
const inputArea = document.getElementById('inputArea');
const highlight = document.getElementById('highlightLayer');
const placeholder = document.getElementById('placeholder');
const wordCountEl = document.getElementById('wordCount');
const errorCountEl = document.getElementById('errorCount');
const correctCountEl = document.getElementById('correctCount');
const popup = document.getElementById('popup');
const popupWrong = document.getElementById('popupWrong');
const popupCorrect = document.getElementById('popupCorrect');
const popupRule = document.getElementById('popupRule');
const popupClose = document.getElementById('popupClose');

inputArea.addEventListener('scroll', () => {
  highlight.scrollTop = inputArea.scrollTop;
});

// ================== TOKENIZER ==================
// Splits text into chunks: whitespace runs, Dzongkha syllables (split on ་ and །), or other chars.
// Each syllable/tsheg-separated segment is checked individually,
// but we re-assemble spans so highlights align with the original text.

function tokenizeForChecking(text) {
  // Split on whitespace boundaries, keeping whitespace as tokens.
  // Within each non-whitespace chunk, further split by Dzongkha
  // syllable separators (tshegs ་ and shads །), keeping the separators.
  const tokens = [];

  // First split on whitespace
  const spaceParts = text.split(/(\s+)/);

  for (const part of spaceParts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      tokens.push({ text: part, isWhitespace: true });
      continue;
    }

    // Within this non-whitespace chunk, split by ་ and །
    // We split but keep the separators attached to the preceding syllable.
    // Strategy: split on positions AFTER ་ or །
    // So "A་B་C།" → ["A་", "B་", "C།"]
    const syllables = part.split(/(?<=[་།])/u);

    for (const syl of syllables) {
      if (syl) tokens.push({ text: syl, isWhitespace: false });
    }
  }

  return tokens;
}

// ================== MAIN CHECK ==================
function checkText(text) {
  if (!text.trim()) {
    placeholder.style.display = 'block';
    highlight.innerHTML = '';
    wordCountEl.textContent = '0';
    errorCountEl.textContent = '0';
    correctCountEl.textContent = '0';
    return;
  }

  placeholder.style.display = 'none';

  const tokens = tokenizeForChecking(text);
  let html = '';
  let words = 0, errors = 0, correct = 0;

  for (const token of tokens) {
    if (token.isWhitespace) {
      html += token.text.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
      continue;
    }

    // Strip trailing tsheg/shad for dictionary lookup, but keep the original for display
    const displayText = token.text;
    const stripped = displayText.replace(/[་།\s]+$/u, '');

    // Only count non-empty stripped tokens as "words"
    if (!stripped) {
      html += escapeHtml(displayText);
      continue;
    }

    words++;

    // Try full token, then stripped version
    const entry = errorMap[displayText] || errorMap[stripped];

    if (entry) {
      errors++;
      const safe = escapeHtml(displayText);
      html += `<span class="error-word"
        data-wrong="${escapeHtml(displayText)}"
        data-correct="${escapeHtml(entry.correct)}"
        data-rule="${escapeHtml(entry.rule)}"
        data-category="${escapeHtml(entry.category)}"
      >${safe}<sup class="hint-badge">!</sup></span>`;
    } else {
      correct++;
      html += escapeHtml(displayText);
    }
  }

  highlight.innerHTML = html;
  wordCountEl.textContent = words;
  errorCountEl.textContent = errors;
  correctCountEl.textContent = correct;

  highlight.querySelectorAll('.error-word').forEach(span => {
    span.addEventListener('click', (e) => showPopup(e, span));
  });
}

// ================== UTILITIES ==================
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showPopup(e, span) {
  e.stopPropagation();
  popupWrong.textContent = span.dataset.wrong;
  popupCorrect.textContent = span.dataset.correct;
  popupRule.innerHTML = `<strong>${span.dataset.category}:</strong> ${span.dataset.rule}`;
  popup.classList.add('visible');

  let x = e.clientX + 12;
  let y = e.clientY + 12;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';

  requestAnimationFrame(() => {
    const rect = popup.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw - 10) popup.style.left = (vw - rect.width - 14) + 'px';
    if (rect.bottom > vh - 10) popup.style.top = (e.clientY - rect.height - 8) + 'px';
  });
}

function hidePopup() {
  popup.classList.remove('visible');
}

popupClose.addEventListener('click', hidePopup);
document.addEventListener('click', (e) => {
  if (!popup.contains(e.target)) hidePopup();
});
inputArea.addEventListener('input', () => {
  checkText(inputArea.value);
});

window.addEventListener('load', () => {
  loadDictionary();
});
