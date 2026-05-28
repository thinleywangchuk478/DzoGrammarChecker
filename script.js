// ================================================
// Dzongkha Live Spelling Checker - Script
// Dictionary loaded from Google Sheets
// ================================================

let errorMap = {}; // Global dictionary object

// ================== GOOGLE SHEETS CONFIG ==================
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjXCQZmHCEOZpHxMHd0tYFnXl9kDxmIwTviWqMlLYi0lCgL3bG3EKpuaNTtxPMpYIt4DY-8uw3NtCV/pub?gid=0&single=true&output=csv";
// Replace above with your actual published CSV link

// Load dictionary from Google Sheets
async function loadDictionary() {
  try {
    console.log("📡 Loading dictionary from Google Sheets...");
    
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error("Failed to fetch sheet");

    const csvText = await response.text();
    errorMap = parseCSVToErrorMap(csvText);

    console.log(`✅ Dictionary loaded successfully! Total entries: ${Object.keys(errorMap).length}`);

    // Re-check if user has already typed something
    if (inputArea && inputArea.value.trim()) {
      checkText(inputArea.value);
    }
  } catch (error) {
    console.error("❌ Failed to load data:", error);
    alert("Could not load dictionary from Google Sheets.\n\nPlease check your internet or CSV link.");
  }
}

// Parse CSV into errorMap object
function parseCSVToErrorMap(csv) {
  const lines = csv.trim().split('\n');
  const map = {};

  for (let i = 1; i < lines.length; i++) {  // Skip header row
    const line = lines[i].trim();
    if (!line) continue;

    const columns = parseCSVLine(line);

    if (columns.length >= 4) {
      const wrong = columns[0].trim();
      const correct = columns[1].trim();
      const rule = columns[2].trim();
      const category = columns[3].trim();

      if (wrong) {
        map[wrong] = {
          correct: correct,
          rule: rule,
          category: category
        };
      }
    }
  }
  return map;
}

// Improved CSV parser (handles commas inside fields)
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

// Sync scrolling between textarea and highlight layer
inputArea.addEventListener('scroll', () => {
  highlight.scrollTop = inputArea.scrollTop;
});

// Tokenize text (keeps spaces and newlines)
function tokenize(text) {
  return text.split(/(\s+)/);
}

// Main spelling check function
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
  const tokens = tokenize(text);
  let html = '';
  let words = 0, errors = 0, correct = 0;

  tokens.forEach(token => {
    if (/^\s+$/.test(token)) {
      html += token.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
      return;
    }
    if (!token) return;

    words++;
    const stripped = token.replace(/[།་\s]+$/, '');
    const entry = errorMap[token] || errorMap[stripped];

    if (entry) {
      errors++;
      const safeToken = escapeHtml(token);
      html += `<span class="error-word"
        data-wrong="${safeToken}"
        data-correct="${escapeHtml(entry.correct)}"
        data-rule="${entry.rule}"
        data-category="${entry.category}"
      >${safeToken}<sup class="hint-badge">!</sup></span>`;
    } else {
      correct++;
      html += escapeHtml(token);
    }
  });

  highlight.innerHTML = html;
  wordCountEl.textContent = words;
  errorCountEl.textContent = errors;
  correctCountEl.textContent = correct;

  // Add click listeners to error words
  highlight.querySelectorAll('.error-word').forEach(span => {
    span.addEventListener('click', (e) => showPopup(e, span));
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
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

  // Prevent popup from going off screen
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

// Event Listeners
popupClose.addEventListener('click', hidePopup);

document.addEventListener('click', (e) => {
  if (!popup.contains(e.target)) hidePopup();
});

inputArea.addEventListener('input', () => {
  checkText(inputArea.value);
});

// Load dictionary when page loads
window.addEventListener('load', () => {
  loadDictionary();
});
