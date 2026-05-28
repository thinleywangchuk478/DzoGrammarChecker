// ================================================
// Dzongkha Live Spelling Checker - Script
// Dictionary loaded from Google Sheets
// ================================================

let errorMap = {};
let sortedKeys = []; // sorted longest-first for greedy multi-syllable matching

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjXCQZmHCEOZpHxMHd0tYFnXl9kDxmIwTviWqMlLYi0lCgL3bG3EKpuaNTtxPMpYIt4DY-8uw3NtCV/pub?gid=0&single=true&output=csv";

async function loadDictionary() {
  try {
    console.log("📡 Loading dictionary from Google Sheets...");
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error("Failed to fetch sheet");
    const csvText = await response.text();
    errorMap = parseCSVToErrorMap(csvText);
    // Sort keys longest-first so multi-syllable entries match before single-syllable ones
    sortedKeys = Object.keys(errorMap).sort((a, b) => b.length - a.length);
    console.log(`✅ Dictionary loaded! Total entries: ${sortedKeys.length}`);
    if (inputArea && inputArea.value.trim()) checkText(inputArea.value);
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
      const wrong    = columns[0].trim();
      const correct  = columns[1].trim();
      const rule     = columns[2].trim();
      const category = columns[3].trim();
      if (wrong) map[wrong] = { correct, rule, category };
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
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += char; }
  }
  result.push(current);
  return result;
}

// ================== DOM ELEMENTS ==================
const inputArea   = document.getElementById('inputArea');
const highlight   = document.getElementById('highlightLayer');
const placeholder = document.getElementById('placeholder');
const wordCountEl  = document.getElementById('wordCount');
const errorCountEl = document.getElementById('errorCount');
const correctCountEl = document.getElementById('correctCount');
const popup        = document.getElementById('popup');
const popupWrong   = document.getElementById('popupWrong');
const popupCorrect = document.getElementById('popupCorrect');
const popupRule    = document.getElementById('popupRule');
const popupClose   = document.getElementById('popupClose');

inputArea.addEventListener('scroll', () => { highlight.scrollTop = inputArea.scrollTop; });

// ================== GREEDY TOKENIZER ==================
// Walks through the text character by character.
// At each position, tries to match the longest dictionary key first (multi-syllable aware).
// Falls back to consuming one syllable (up to and including the next ་ or །).
// Whitespace and non-Dzongkha runs are emitted as-is.

function tokenizeGreedy(text) {
  const tokens = []; // { text, entry|null }
  let i = 0;

  while (i < text.length) {
    // Consume whitespace
    if (/\s/.test(text[i])) {
      let ws = '';
      while (i < text.length && /\s/.test(text[i])) ws += text[i++];
      tokens.push({ text: ws, entry: null, isWhitespace: true });
      continue;
    }

    // Try longest dictionary key at this position
    let matched = false;
    for (const key of sortedKeys) {
      if (text.startsWith(key, i)) {
        tokens.push({ text: key, entry: errorMap[key], isWhitespace: false });
        i += key.length;
        matched = true;
        break;
      }
      // Also try key without trailing tsheg/shad, but match with separator in text
      const stripped = key.replace(/[་།]+$/u, '');
      if (stripped !== key && text.startsWith(stripped, i)) {
        // check what follows — must be tsheg/shad or end
        const after = text[i + stripped.length];
        if (!after || /[་།\s]/.test(after)) {
          tokens.push({ text: stripped, entry: errorMap[key], isWhitespace: false });
          i += stripped.length;
          matched = true;
          break;
        }
      }
    }

    if (matched) continue;

    // No dictionary match — consume one syllable (up to next ་ or །, inclusive)
    let syl = '';
    while (i < text.length && !/\s/.test(text[i])) {
      syl += text[i];
      const ch = text[i++];
      if (ch === '་' || ch === '།') break;
    }
    if (syl) tokens.push({ text: syl, entry: null, isWhitespace: false });
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
  const tokens = tokenizeGreedy(text);
  let html = '';
  let words = 0, errors = 0, correct = 0;

  for (const token of tokens) {
    if (token.isWhitespace) {
      html += token.text.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
      continue;
    }

    // Skip pure separator tokens
    if (/^[་།]+$/.test(token.text)) {
      html += escapeHtml(token.text);
      continue;
    }

    words++;

    if (token.entry) {
      errors++;
      const safe = escapeHtml(token.text);
      html += `<span class="error-word"
        data-wrong="${escapeHtml(token.text)}"
        data-correct="${escapeHtml(token.entry.correct)}"
        data-rule="${escapeHtml(token.entry.rule)}"
        data-category="${escapeHtml(token.entry.category)}"
      >${safe}<sup class="hint-badge">!</sup></span>`;
    } else {
      correct++;
      html += escapeHtml(token.text);
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

// ================== POPUP ==================
function showPopup(e, span) {
  e.stopPropagation();
  popupWrong.textContent   = span.dataset.wrong;
  popupCorrect.textContent = span.dataset.correct;
  popupRule.innerHTML = `<strong>${span.dataset.category}:</strong> ${span.dataset.rule}`;

  // Store reference so click-to-fix knows which error
  popup.dataset.wrong   = span.dataset.wrong;
  popup.dataset.correct = span.dataset.correct;

  popup.classList.add('visible');

  let x = e.clientX + 12, y = e.clientY + 12;
  popup.style.left = x + 'px';
  popup.style.top  = y + 'px';

  requestAnimationFrame(() => {
    const rect = popup.getBoundingClientRect();
    if (rect.right  > window.innerWidth  - 10) popup.style.left = (window.innerWidth  - rect.width  - 14) + 'px';
    if (rect.bottom > window.innerHeight - 10) popup.style.top  = (e.clientY - rect.height - 8) + 'px';
  });
}

function hidePopup() { popup.classList.remove('visible'); }

// ================== CLICK-TO-FIX ==================
// Clicking the correct answer in the popup replaces the error in the textarea
popupCorrect.style.cursor = 'pointer';
popupCorrect.title = 'Click to fix';

popupCorrect.addEventListener('click', () => {
  const wrong   = popup.dataset.wrong;
  const correct = popup.dataset.correct;
  if (!wrong || !correct) return;

  // Replace only the FIRST occurrence in the textarea
  const current = inputArea.value;
  const idx = current.indexOf(wrong);
  if (idx !== -1) {
    inputArea.value = current.slice(0, idx) + correct + current.slice(idx + wrong.length);
    checkText(inputArea.value);
  }
  hidePopup();
});

// ================== EVENT LISTENERS ==================
popupClose.addEventListener('click', hidePopup);
document.addEventListener('click', (e) => { if (!popup.contains(e.target)) hidePopup(); });
inputArea.addEventListener('input', () => { checkText(inputArea.value); });
window.addEventListener('load', () => { loadDictionary(); });

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
