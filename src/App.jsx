import { useState, useRef } from "react";

const ILLEGIBLE_MARKER = "⚠️ ILLEGIBLE";
const STORAGE_KEY = "mepn-flashcards";
const WEAKSPOTS_KEY = "mepn-weakspots";
const PROGRESS_KEY = "mepn-progress";
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

async function callClaude(prompt, maxTokens = 1500) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await resp.json();
  return data.content?.map((b) => b.text || "").join("") || "";
}

async function scanNotes(imageBase64, mediaType) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          {
            type: "text",
            text: `You are scanning handwritten nursing notes from an accelerated MSN/MEPN program. Extract flashcard pairs.

Rules:
- Create clear FRONT (question/term) and BACK (answer/definition) pairs
- Each card should test one concept
- If any text is truly illegible, write exactly "${ILLEGIBLE_MARKER}: [describe what you can see]" in the back field
- Return ONLY valid JSON, no markdown, no preamble

Format: {"cards": [{"front": "...", "back": "..."}]}`
          }
        ]
      }]
    })
  });
  const data = await resp.json();
  const text = data.content?.map((b) => b.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function loadDecks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveDecks(d) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); return true; } catch { return false; }
}
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); } catch { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {}
}
function loadWeakSpots() {
  try { return JSON.parse(localStorage.getItem(WEAKSPOTS_KEY) || "{}"); } catch { return {}; }
}
function saveWeakSpots(w) {
  try { localStorage.setItem(WEAKSPOTS_KEY, JSON.stringify(w)); } catch {}
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --cream: #F5F0E8; --ink: #1A1208; --rust: #C45C2A; --sage: #4A6741;
    --amber: #D4A017; --paper: #EDE8DC; --rule: #C8BFA8; --faded: #8A7E6A;
    --warn: #B34A1A; --warn-bg: #FDF0E8; --blue: #2A5C8A; --blue-bg: #EBF2FA;
    --purple: #6B3FA0; --purple-bg: #F3EEF9;
  }
  body { background: var(--cream); }
  .app { min-height: 100vh; background: var(--cream); font-family: 'DM Sans', sans-serif; color: var(--ink); }
  .header-strip { background: var(--ink); color: var(--cream); padding: 10px 24px; display: flex; align-items: baseline; gap: 12px; }
  .header-title { font-family: 'DM Serif Display', serif; font-size: 22px; }
  .header-sub { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--amber); letter-spacing: 0.08em; text-transform: uppercase; }
  .main { padding: 24px; max-width: 720px; margin: 0 auto; }
  .deck-intro { font-size: 13px; color: var(--faded); margin-bottom: 20px; font-family: 'DM Mono', monospace; border-left: 2px solid var(--amber); padding-left: 10px; }
  .new-deck-row { display: flex; gap: 8px; margin-bottom: 24px; }
  .input-field { flex: 1; border: 1px solid var(--rule); background: var(--paper); border-radius: 2px; padding: 9px 12px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--ink); outline: none; transition: border-color 0.15s; }
  .input-field:focus { border-color: var(--rust); }
  .btn { border: 1px solid var(--ink); background: var(--ink); color: var(--cream); border-radius: 2px; padding: 9px 16px; font-size: 13px; font-family: 'DM Mono', monospace; cursor: pointer; letter-spacing: 0.04em; transition: all 0.15s; white-space: nowrap; }
  .btn:hover { background: var(--rust); border-color: var(--rust); }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn:disabled:hover { background: var(--ink); border-color: var(--ink); }
  .btn-ghost { background: transparent; color: var(--ink); border: 1px solid var(--rule); }
  .btn-ghost:hover { background: var(--paper); border-color: var(--rule); }
  .btn-danger { color: var(--warn); }
  .btn-danger:hover { background: var(--warn-bg); border-color: var(--warn); color: var(--warn); }
  .btn-blue { background: var(--blue); border-color: var(--blue); }
  .btn-blue:hover { background: #1e4a73; border-color: #1e4a73; }
  .btn-purple { background: var(--purple); border-color: var(--purple); }
  .btn-purple:hover { background: #5a2f8a; border-color: #5a2f8a; }
  .btn-sage { background: var(--sage); border-color: var(--sage); }
  .btn-sage:hover { background: #3a5232; border-color: #3a5232; }
  .btn-sm { padding: 4px 10px; font-size: 11px; }
  .deck-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 3px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; margin-bottom: 8px; transition: border-color 0.15s; }
  .deck-card:hover { border-color: var(--rust); }
  .deck-icon { width: 36px; height: 36px; background: var(--ink); border-radius: 2px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; }
  .deck-name { font-weight: 500; font-size: 15px; margin-bottom: 2px; }
  .deck-meta { font-size: 12px; color: var(--faded); font-family: 'DM Mono', monospace; }
  .deck-flagged { color: var(--warn); margin-left: 8px; }
  .empty-state { text-align: center; color: var(--faded); font-size: 13px; margin-top: 40px; font-family: 'DM Mono', monospace; }
  .deck-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid var(--rule); flex-wrap: wrap; }
  .deck-header-title { font-family: 'DM Serif Display', serif; font-size: 22px; flex: 1; }
  .save-ok { color: var(--sage); font-family: 'DM Mono', monospace; font-size: 11px; }
  .save-err { color: var(--warn); font-family: 'DM Mono', monospace; font-size: 11px; }
  .upload-zone { border: 1.5px dashed var(--rule); border-radius: 3px; padding: 28px 24px; text-align: center; cursor: pointer; background: var(--paper); margin-bottom: 20px; transition: border-color 0.15s; }
  .upload-zone:hover { border-color: var(--rust); background: var(--cream); }
  .upload-icon { font-size: 28px; display: block; margin-bottom: 8px; opacity: 0.5; }
  .upload-label { font-weight: 500; font-size: 14px; margin-bottom: 4px; }
  .upload-hint { font-size: 12px; color: var(--faded); font-family: 'DM Mono', monospace; }
  .error-msg { color: var(--warn); font-size: 13px; margin-bottom: 12px; font-family: 'DM Mono', monospace; }
  .cards-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
  .cards-count { font-size: 13px; color: var(--faded); font-family: 'DM Mono', monospace; }
  .flag-pill { font-size: 11px; padding: 3px 10px; border-radius: 12px; background: var(--warn-bg); color: var(--warn); font-family: 'DM Mono', monospace; font-weight: 500; border: 1px solid #E8C4B0; }
  .flash-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 3px; padding: 14px 16px; margin-bottom: 8px; }
  .flash-card.flagged { border-left: 3px solid var(--warn); border-color: #E8C4B0; background: var(--warn-bg); }
  .card-row { display: flex; gap: 12px; align-items: flex-start; }
  .card-content { flex: 1; min-width: 0; }
  .card-front { font-size: 14px; font-weight: 500; margin-bottom: 4px; }
  .card-back { font-size: 13px; color: var(--faded); }
  .card-back.warn { color: var(--warn); }
  .card-actions { display: flex; gap: 4px; flex-shrink: 0; }
  .card-num { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--rule); margin-bottom: 6px; }
  .edit-area { display: flex; flex-direction: column; gap: 8px; }
  .edit-textarea { width: 100%; border: 1px solid var(--rule); background: var(--cream); border-radius: 2px; padding: 8px 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--ink); resize: vertical; outline: none; }
  .edit-textarea:focus { border-color: var(--rust); }
  .edit-actions { display: flex; gap: 6px; }
  .mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .mode-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 4px; padding: 16px; cursor: pointer; transition: all 0.15s; text-align: left; }
  .mode-card:hover { border-color: var(--rust); background: var(--cream); }
  .mode-card-icon { font-size: 24px; margin-bottom: 8px; display: block; }
  .mode-card-title { font-weight: 500; font-size: 14px; margin-bottom: 4px; }
  .mode-card-desc { font-size: 12px; color: var(--faded); font-family: 'DM Mono', monospace; }
  .study-wrap { padding: 24px; max-width: 600px; margin: 0 auto; }
  .study-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .study-progress { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--faded); }
  .study-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 4px; padding: 40px 32px; min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; cursor: pointer; margin-bottom: 20px; transition: border-color 0.15s, transform 0.1s; }
  .study-card:hover { border-color: var(--rust); transform: translateY(-1px); }
  .study-card.flagged { background: var(--warn-bg); border-color: #E8C4B0; cursor: default; }
  .study-card.flagged:hover { transform: none; }
  .study-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--faded); margin-bottom: 16px; }
  .study-text { font-family: 'DM Serif Display', serif; font-size: 22px; color: var(--ink); line-height: 1.4; }
  .study-text.warn { color: var(--warn); }
  .study-hint { font-size: 12px; color: var(--rule); margin-top: 16px; font-family: 'DM Mono', monospace; }
  .study-controls { display: flex; gap: 8px; justify-content: center; }
  .progress-bar-wrap { height: 3px; background: var(--rule); border-radius: 2px; margin-bottom: 20px; overflow: hidden; }
  .progress-bar-fill { height: 100%; background: var(--rust); border-radius: 2px; transition: width 0.3s ease; }
  .quiz-question { background: var(--paper); border: 1px solid var(--rule); border-radius: 4px; padding: 24px; margin-bottom: 16px; }
  .quiz-q-text { font-family: 'DM Serif Display', serif; font-size: 20px; line-height: 1.4; margin-bottom: 20px; }
  .quiz-options { display: flex; flex-direction: column; gap: 8px; }
  .quiz-option { background: var(--cream); border: 1px solid var(--rule); border-radius: 3px; padding: 12px 16px; cursor: pointer; text-align: left; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--ink); transition: all 0.15s; display: flex; gap: 10px; align-items: flex-start; }
  .quiz-option:hover:not(:disabled) { border-color: var(--rust); background: var(--paper); }
  .quiz-option.correct { background: #EBF5EC; border-color: var(--sage); color: var(--sage); }
  .quiz-option.wrong { background: var(--warn-bg); border-color: var(--warn); color: var(--warn); }
  .quiz-option-letter { font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 500; min-width: 18px; margin-top: 1px; }
  .quiz-feedback { margin-top: 12px; padding: 10px 14px; border-radius: 3px; font-size: 13px; font-family: 'DM Mono', monospace; }
  .quiz-feedback.correct { background: #EBF5EC; color: var(--sage); border: 1px solid var(--sage); }
  .quiz-feedback.wrong { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn); }
  .score-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 4px; padding: 32px; text-align: center; margin-bottom: 20px; }
  .score-number { font-family: 'DM Serif Display', serif; font-size: 64px; color: var(--ink); line-height: 1; margin-bottom: 8px; }
  .score-label { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--faded); letter-spacing: 0.06em; text-transform: uppercase; }
  .score-grade { font-family: 'DM Serif Display', serif; font-size: 28px; margin: 12px 0; }
  .score-grade.pass { color: var(--sage); }
  .score-grade.fail { color: var(--warn); }
  .review-item { background: var(--paper); border: 1px solid var(--rule); border-radius: 3px; padding: 14px 16px; margin-bottom: 8px; }
  .review-item.wrong { border-left: 3px solid var(--warn); }
  .review-item.correct { border-left: 3px solid var(--sage); }
  .review-q { font-size: 14px; font-weight: 500; margin-bottom: 6px; }
  .review-answer { font-size: 13px; color: var(--faded); }
  .review-answer span { font-weight: 500; }
  .review-answer .correct-ans { color: var(--sage); }
  .review-answer .wrong-ans { color: var(--warn); }
  .section-title { font-family: 'DM Serif Display', serif; font-size: 20px; margin-bottom: 16px; }
  .tool-box { background: var(--paper); border: 1px solid var(--rule); border-radius: 4px; padding: 20px; margin-bottom: 16px; }
  .tool-result { background: var(--cream); border: 1px solid var(--rule); border-radius: 3px; padding: 16px; margin-top: 16px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
  .weak-item { background: var(--paper); border: 1px solid var(--rule); border-radius: 3px; padding: 12px 16px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
  .weak-bar-wrap { height: 4px; background: var(--rule); border-radius: 2px; margin-top: 6px; overflow: hidden; width: 100%; }
  .weak-bar-fill { height: 100%; border-radius: 2px; background: var(--warn); }
  .checkbox-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--rule); cursor: pointer; }
  .checkbox-row:last-child { border-bottom: none; }
  .checkbox-row input { width: 16px; height: 16px; accent-color: var(--rust); cursor: pointer; }
  .loading-overlay { text-align: center; padding: 40px 20px; }
  .loading-spinner { font-size: 32px; display: block; margin-bottom: 12px; animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .loading-text { font-family: 'DM Mono', monospace; font-size: 13px; color: var(--faded); }
  .tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--rule); padding-bottom: 0; }
  .tab { padding: 8px 14px; font-size: 13px; font-family: 'DM Mono', monospace; cursor: pointer; border: none; background: none; color: var(--faded); border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s; }
  .tab.active { color: var(--ink); border-bottom-color: var(--rust); }
  .tab:hover { color: var(--ink); }
  .nav-bar { background: var(--paper); border-bottom: 1px solid var(--rule); padding: 8px 24px; display: flex; gap: 6px; flex-wrap: wrap; }
  .textarea-input { width: 100%; border: 1px solid var(--rule); background: var(--cream); border-radius: 2px; padding: 10px 12px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--ink); resize: vertical; outline: none; min-height: 100px; }
  .textarea-input:focus { border-color: var(--rust); }
  .case-scenario { background: var(--blue-bg); border: 1px solid #B8D0E8; border-radius: 4px; padding: 20px; margin-bottom: 16px; font-size: 14px; line-height: 1.7; }
  .case-scenario-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--blue); margin-bottom: 8px; }
`;

export default function App() {
  const [decks, setDecks] = useState(() => loadDecks());
  const [weakSpots, setWeakSpots] = useState(() => loadWeakSpots());
  const [deckProgress, setDeckProgress] = useState(() => loadProgress());
  const [view, setView] = useState("home"); // home | deck | study | quiz | finalexam | weakspots | tools
  const [activeDeck, setActiveDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [newDeckName, setNewDeckName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [flipped, setFlipped] = useState({});
  const [editingCard, setEditingCard] = useState(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [filter, setFilter] = useState("all");

  // Study
  const [studyIdx, setStudyIdx] = useState(0);
  const [studyFlipped, setStudyFlipped] = useState(false);

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizRevealed, setQuizRevealed] = useState({});
  const [quizDone, setQuizDone] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);

  // Final exam
  const [selectedDecks, setSelectedDecks] = useState([]);
  const [examQuestions, setExamQuestions] = useState([]);
  const [examAnswers, setExamAnswers] = useState({});
  const [examRevealed, setExamRevealed] = useState({});
  const [examDone, setExamDone] = useState(false);
  const [examIdx, setExamIdx] = useState(0);

  // Tools
  const [toolTab, setToolTab] = useState("mnemonic");
  const [toolInput, setToolInput] = useState("");
  const [toolResult, setToolResult] = useState("");
  const [toolLoading, setToolLoading] = useState(false);
  const [caseStudy, setCaseStudy] = useState(null);
  const [caseAnswers, setCaseAnswers] = useState({});
  const [caseRevealed, setCaseRevealed] = useState({});

  const fileRef = useRef();

  function updateDecks(updated) {
    setDecks(updated);
    saveDecks(updated);
  }

  function updateWeakSpots(updated) {
    setWeakSpots(updated);
    saveWeakSpots(updated);
  }

  function recordResult(front, correct) {
    const updated = { ...weakSpots };
    if (!updated[front]) updated[front] = { wrong: 0, total: 0 };
    updated[front].total += 1;
    if (!correct) updated[front].wrong += 1;
    updateWeakSpots(updated);
  }

  function createDeck() {
    const name = newDeckName.trim();
    if (!name) return;
    const updated = { ...decks, [name]: [] };
    updateDecks(updated);
    setNewDeckName("");
    openDeck(name, []);
  }

  function openDeck(name, deckCards) {
    setActiveDeck(name);
    setCards(deckCards);
    setFilter("all");
    setFlipped({});
    setEditingCard(null);
    const saved = loadProgress();
    setStudyIdx(saved[name] || 0);
    setView("deck");
  }

  function deleteDeck(name) {
    const updated = { ...decks };
    delete updated[name];
    updateDecks(updated);
  }

  function updateCards(newCards) {
    setCards(newCards);
    const updated = { ...decks, [activeDeck]: newCards };
    updateDecks(updated);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(""), 2000);
  }

  async function handleFiles(files) {
    if (!files.length) return;
    setLoading(true);
    setLoadingMsg("Scanning your notes...");
    setError("");
    try {
      const newCards = [];
      for (const file of Array.from(files)) {
        const b64 = await toBase64(file);
        const result = await scanNotes(b64, file.type || "image/jpeg");
        newCards.push(...(result.cards || []));
      }
      updateCards([...cards, ...newCards]);
    } catch {
      setError("Failed to scan notes. Make sure the image is clear and try again.");
    }
    setLoading(false);
  }

  function startEdit(idx) { setEditingCard(idx); setEditFront(cards[idx].front); setEditBack(cards[idx].back); }
  function saveEdit() {
    const updated = [...cards];
    updated[editingCard] = { front: editFront, back: editBack };
    updateCards(updated);
    setEditingCard(null);
  }
  function deleteCard(idx) {
    updateCards(cards.filter((_, i) => i !== idx));
    if (editingCard === idx) setEditingCard(null);
  }

  // --- QUIZ ---
  async function startQuiz() {
    if (cards.length < 4) { setError("Need at least 4 cards to start a quiz."); return; }
    setLoading(true);
    setLoadingMsg("Generating NCLEX-style quiz questions...");
    setError("");
    try {
      const sample = [...cards].sort(() => Math.random() - 0.5).slice(0, Math.min(10, cards.length));
      const prompt = `You are an NCLEX exam question writer for nursing students. Given these flashcard pairs, create multiple choice questions with 4 options each. Generate smart, plausible wrong answers based on your nursing knowledge — make them tricky like a real exam.

Flashcards:
${sample.map((c, i) => `${i + 1}. Q: ${c.front} | A: ${c.back}`).join("\n")}

Return ONLY valid JSON, no markdown:
{"questions": [{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": "A", "explanation": "..."}]}`;
      const text = await callClaude(prompt, 2000);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setQuizQuestions(parsed.questions || []);
      setQuizAnswers({});
      setQuizRevealed({});
      setQuizDone(false);
      setQuizIdx(0);
      setView("quiz");
    } catch {
      setError("Failed to generate quiz. Try again.");
    }
    setLoading(false);
  }

  function answerQuiz(qIdx, option) {
    if (quizRevealed[qIdx]) return;
    const correct = option[0] === quizQuestions[qIdx].correct;
    setQuizAnswers(a => ({ ...a, [qIdx]: option }));
    setQuizRevealed(r => ({ ...r, [qIdx]: true }));
    recordResult(quizQuestions[qIdx].question, correct);
  }

  // --- FINAL EXAM ---
  async function startFinalExam() {
    if (selectedDecks.length === 0) { setError("Select at least one deck."); return; }
    const allCards = selectedDecks.flatMap(d => decks[d] || []);
    if (allCards.length < 4) { setError("Not enough cards across selected decks."); return; }
    setLoading(true);
    setLoadingMsg("Generating your 30-question final exam...");
    setError("");
    try {
      const sample = [...allCards].sort(() => Math.random() - 0.5).slice(0, Math.min(30, allCards.length));
      const prompt = `You are an NCLEX exam question writer for an accelerated MSN/MEPN nursing program. Create a comprehensive final exam with exactly ${sample.length} multiple choice questions based on these flashcards. Make questions challenging with plausible distractors — like a real nursing exam.

Flashcards:
${sample.map((c, i) => `${i + 1}. Q: ${c.front} | A: ${c.back}`).join("\n")}

Return ONLY valid JSON, no markdown:
{"questions": [{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": "A", "explanation": "..."}]}`;
      const text = await callClaude(prompt, 4000);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setExamQuestions(parsed.questions || []);
      setExamAnswers({});
      setExamRevealed({});
      setExamDone(false);
      setExamIdx(0);
      setView("finalexam");
    } catch {
      setError("Failed to generate exam. Try again.");
    }
    setLoading(false);
  }

  function answerExam(qIdx, option) {
    if (examRevealed[qIdx]) return;
    const correct = option[0] === examQuestions[qIdx].correct;
    setExamAnswers(a => ({ ...a, [qIdx]: option }));
    setExamRevealed(r => ({ ...r, [qIdx]: true }));
    recordResult(examQuestions[qIdx].question, correct);
  }

  // --- TOOLS ---
  async function runMnemonic() {
    if (!toolInput.trim()) return;
    setToolLoading(true);
    setToolResult("");
    try {
      const text = await callClaude(`You are helping a nursing student in an accelerated MSN/MEPN program memorize content. Create a memorable mnemonic, memory trick, or learning aid for this concept. Make it vivid, easy to remember, and clinically relevant.\n\nConcept: ${toolInput}\n\nProvide: 1) The mnemonic/trick 2) What each part stands for 3) A tip for remembering it.`);
      setToolResult(text);
    } catch { setToolResult("Failed to generate. Try again."); }
    setToolLoading(false);
  }

  async function runSimplify() {
    if (!toolInput.trim()) return;
    setToolLoading(true);
    setToolResult("");
    try {
      const text = await callClaude(`You are helping a nursing student in an accelerated MSN/MEPN program understand complex content. Simplify the following notes into plain English. Pull out the key points, explain any jargon, and make it easy to understand and remember.\n\nNotes:\n${toolInput}`);
      setToolResult(text);
    } catch { setToolResult("Failed to simplify. Try again."); }
    setToolLoading(false);
  }

  async function runCaseStudy() {
    const allCards = Object.values(decks).flat();
    if (allCards.length < 3) { setToolResult("Add more flashcards first — need at least 3 cards to generate a case study."); return; }
    setToolLoading(true);
    setToolResult("");
    setCaseStudy(null);
    setCaseAnswers({});
    setCaseRevealed({});
    try {
      const sample = [...allCards].sort(() => Math.random() - 0.5).slice(0, 8);
      const prompt = `You are creating a clinical case study for an accelerated MSN/MEPN nursing student. Based on these nursing concepts, create a realistic patient scenario with 4 multiple choice questions that test clinical reasoning.

Concepts: ${sample.map(c => c.front).join(", ")}

Return ONLY valid JSON, no markdown:
{"scenario": "A detailed 3-4 sentence patient scenario...", "questions": [{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": "A", "explanation": "..."}]}`;
      const text = await callClaude(prompt, 2000);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setCaseStudy(parsed);
    } catch { setToolResult("Failed to generate case study. Try again."); }
    setToolLoading(false);
  }

  function answerCase(qIdx, option) {
    if (caseRevealed[qIdx]) return;
    setCaseAnswers(a => ({ ...a, [qIdx]: option }));
    setCaseRevealed(r => ({ ...r, [qIdx]: true }));
  }

  const illegibleCards = cards.filter(c => c.back.includes(ILLEGIBLE_MARKER));
  const displayCards = filter === "illegible" ? illegibleCards : cards;

  function calcScore(questions, answers) {
    const answered = Object.keys(answers).length;
    const correct = Object.entries(answers).filter(([i, a]) => a[0] === questions[i]?.correct).length;
    return { correct, total: questions.length, pct: Math.round((correct / questions.length) * 100) };
  }

  function gradeLabel(pct) {
    if (pct >= 90) return { label: "Excellent", cls: "pass" };
    if (pct >= 80) return { label: "Good", cls: "pass" };
    if (pct >= 70) return { label: "Passing", cls: "pass" };
    return { label: "Needs Review", cls: "fail" };
  }

  function QuizView({ questions, answers, revealed, done, idx, setIdx, setDone, onAnswer, title }) {
    if (done) {
      const { correct, total, pct } = calcScore(questions, answers);
      const grade = gradeLabel(pct);
      return (
        <div className="study-wrap">
          <div className="study-nav">
            <span className="study-progress">{title}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setView(title === "Quiz" ? "deck" : "home")}>← back</button>
          </div>
          <div className="score-card">
            <div className="score-number">{pct}%</div>
            <div className="score-label">final score</div>
            <div className={`score-grade ${grade.cls}`}>{grade.label}</div>
            <p style={{ fontSize: 14, color: "var(--faded)", fontFamily: "'DM Mono', monospace" }}>{correct} / {total} correct</p>
          </div>
          <h3 className="section-title">Review</h3>
          {questions.map((q, i) => {
            const isCorrect = answers[i]?.[0] === q.correct;
            return (
              <div key={i} className={`review-item ${isCorrect ? "correct" : "wrong"}`}>
                <div className="review-q">{q.question}</div>
                <div className="review-answer">
                  Your answer: <span className={isCorrect ? "correct-ans" : "wrong-ans"}>{answers[i] || "Not answered"}</span>
                  {!isCorrect && <><br />Correct: <span className="correct-ans">{q.options.find(o => o[0] === q.correct)}</span></>}
                  {q.explanation && <><br /><span style={{ color: "var(--faded)" }}>{q.explanation}</span></>}
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={() => setView(title === "Quiz" ? "deck" : "home")}>done</button>
          </div>
        </div>
      );
    }

    const q = questions[idx];
    if (!q) return null;
    const userAnswer = answers[idx];
    const isRevealed = revealed[idx];

    return (
      <div className="study-wrap">
        <div className="study-nav">
          <span className="study-progress">{idx + 1} / {questions.length}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setView(title === "Quiz" ? "deck" : "home")}>← exit</button>
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
        </div>
        <div className="quiz-question">
          <div className="quiz-q-text">{q.question}</div>
          <div className="quiz-options">
            {q.options.map((opt, oi) => {
              let cls = "";
              if (isRevealed) {
                if (opt[0] === q.correct) cls = "correct";
                else if (opt === userAnswer) cls = "wrong";
              }
              return (
                <button key={oi} className={`quiz-option ${cls}`} onClick={() => onAnswer(idx, opt)} disabled={isRevealed}>
                  <span className="quiz-option-letter">{opt[0]}.</span>
                  <span>{opt.slice(3)}</span>
                </button>
              );
            })}
          </div>
          {isRevealed && (
            <div className={`quiz-feedback ${userAnswer?.[0] === q.correct ? "correct" : "wrong"}`}>
              {userAnswer?.[0] === q.correct ? "✓ Correct!" : `✗ Incorrect. ${q.explanation || ""}`}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {isRevealed && (
            idx < questions.length - 1
              ? <button className="btn" onClick={() => setIdx(i => i + 1)}>next →</button>
              : <button className="btn btn-sage" onClick={() => setDone(true)}>see results ↗</button>
          )}
        </div>
      </div>
    );
  }

  // ---- RENDER ----

  if (loading) return (
    <div className="app">
      <style>{styles}</style>
      <div className="header-strip"><span className="header-title">MEPN</span><span className="header-sub">working...</span></div>
      <div className="loading-overlay">
        <span className="loading-spinner">⚙</span>
        <p className="loading-text">{loadingMsg}</p>
      </div>
    </div>
  );

  if (view === "quiz") return (
    <div className="app"><style>{styles}</style>
      <div className="header-strip"><span className="header-title">MEPN</span><span className="header-sub">quiz mode</span></div>
      <QuizView questions={quizQuestions} answers={quizAnswers} revealed={quizRevealed} done={quizDone} idx={quizIdx} setIdx={setQuizIdx} setDone={setQuizDone} onAnswer={answerQuiz} title="Quiz" />
    </div>
  );

  if (view === "finalexam") return (
    <div className="app"><style>{styles}</style>
      <div className="header-strip"><span className="header-title">MEPN</span><span className="header-sub">final exam</span></div>
      <QuizView questions={examQuestions} answers={examAnswers} revealed={examRevealed} done={examDone} idx={examIdx} setIdx={setExamIdx} setDone={setExamDone} onAnswer={answerExam} title="Final Exam" />
    </div>
  );

  if (view === "study") {
    const studyDeck = displayCards;
    const card = studyDeck[studyIdx];
    const isIllegible = card?.back.includes(ILLEGIBLE_MARKER);
    return (
      <div className="app"><style>{styles}</style>
        <div className="header-strip"><span className="header-title">MEPN</span><span className="header-sub">study mode</span></div>
        <div className="study-wrap">
          <div className="study-nav">
            <span className="study-progress">{studyIdx + 1} / {studyDeck.length}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setView("deck")}>← back</button>
          </div>
          <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${((studyIdx + 1) / studyDeck.length) * 100}%` }} /></div>
          <div className={`study-card ${isIllegible ? "flagged" : ""}`} onClick={() => !isIllegible && setStudyFlipped(f => !f)}>
            <div className="study-label">{studyFlipped ? "answer" : "question"}</div>
            <p className={`study-text ${isIllegible ? "warn" : ""}`}>{studyFlipped ? card.back : card.front}</p>
            {!studyFlipped && !isIllegible && <span className="study-hint">tap to reveal</span>}
          </div>
          <div className="study-controls">
            <button className="btn btn-ghost btn-sm" onClick={() => { setStudyFlipped(false); setStudyIdx(i => { const n = (i - 1 + studyDeck.length) % studyDeck.length; const p = loadProgress(); saveProgress({ ...p, [activeDeck]: n }); return n; }); }}>← prev</button>
            <button className="btn btn-sm" onClick={() => setStudyFlipped(f => !f)}>{studyFlipped ? "question" : "reveal"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setStudyFlipped(false); setStudyIdx(i => { const n = (i + 1) % studyDeck.length; const p = loadProgress(); saveProgress({ ...p, [activeDeck]: n }); return n; }); }}>next →</button>
          </div>
          <p style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--rule)", marginTop: 12 }}>progress saved automatically</p>
        </div>
      </div>
    );
  }

  if (view === "weakspots") {
    const spots = Object.entries(weakSpots).sort((a, b) => (b[1].wrong / b[1].total) - (a[1].wrong / a[1].total)).slice(0, 20);
    return (
      <div className="app"><style>{styles}</style>
        <div className="header-strip"><span className="header-title">MEPN</span><span className="header-sub">weak spots</span></div>
        <div className="main">
          <div className="deck-header">
            <button className="btn btn-ghost btn-sm" onClick={() => setView("home")}>← home</button>
            <h2 className="deck-header-title">Weak Spots</h2>
            {Object.keys(weakSpots).length > 0 && <button className="btn btn-ghost btn-sm btn-danger" onClick={() => { updateWeakSpots({}); }}>clear</button>}
          </div>
          {spots.length === 0 ? <p className="empty-state">No data yet — take a quiz or exam first.</p> : spots.map(([q, data]) => {
            const pct = Math.round((data.wrong / data.total) * 100);
            return (
              <div key={q} className="weak-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{q}</p>
                  <p style={{ fontSize: 12, color: "var(--faded)", fontFamily: "'DM Mono', monospace" }}>{data.wrong} wrong / {data.total} attempts</p>
                  <div className="weak-bar-wrap"><div className="weak-bar-fill" style={{ width: `${pct}%` }} /></div>
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: pct > 50 ? "var(--warn)" : "var(--faded)", marginLeft: 12, flexShrink: 0 }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "tools") {
    return (
      <div className="app"><style>{styles}</style>
        <div className="header-strip"><span className="header-title">MEPN</span><span className="header-sub">study tools</span></div>
        <div className="main">
          <div className="deck-header">
            <button className="btn btn-ghost btn-sm" onClick={() => setView("home")}>← home</button>
            <h2 className="deck-header-title">Study Tools</h2>
          </div>
          <div className="tabs">
            {["mnemonic", "simplify", "casestudy"].map(t => (
              <button key={t} className={`tab ${toolTab === t ? "active" : ""}`} onClick={() => { setToolTab(t); setToolResult(""); setCaseStudy(null); setToolInput(""); }}>
                {t === "mnemonic" ? "🧠 Mnemonics" : t === "simplify" ? "✏️ Simplify Notes" : "🏥 Case Study"}
              </button>
            ))}
          </div>

          {toolTab === "mnemonic" && (
            <div className="tool-box">
              <p style={{ fontSize: 14, marginBottom: 12 }}>Enter a term, drug, concept, or list you want to memorize.</p>
              <textarea className="textarea-input" value={toolInput} onChange={e => setToolInput(e.target.value)} placeholder="e.g. Beta blockers side effects, or the 5 rights of medication administration..." />
              <button className="btn" style={{ marginTop: 12 }} onClick={runMnemonic} disabled={toolLoading}>{toolLoading ? "generating..." : "generate mnemonic"}</button>
              {toolResult && <div className="tool-result">{toolResult}</div>}
            </div>
          )}

          {toolTab === "simplify" && (
            <div className="tool-box">
              <p style={{ fontSize: 14, marginBottom: 12 }}>Paste dense notes and get a plain English breakdown.</p>
              <textarea className="textarea-input" value={toolInput} onChange={e => setToolInput(e.target.value)} placeholder="Paste your notes here..." style={{ minHeight: 150 }} />
              <button className="btn" style={{ marginTop: 12 }} onClick={runSimplify} disabled={toolLoading}>{toolLoading ? "simplifying..." : "simplify notes"}</button>
              {toolResult && <div className="tool-result">{toolResult}</div>}
            </div>
          )}

          {toolTab === "casestudy" && (
            <div className="tool-box">
              <p style={{ fontSize: 14, marginBottom: 12 }}>Generate a clinical case study based on your uploaded notes across all decks.</p>
              <button className="btn btn-blue" onClick={runCaseStudy} disabled={toolLoading}>{toolLoading ? "generating..." : "generate case study"}</button>
              {toolResult && !caseStudy && <div className="tool-result">{toolResult}</div>}
              {caseStudy && (
                <>
                  <div className="case-scenario" style={{ marginTop: 16 }}>
                    <div className="case-scenario-label">patient scenario</div>
                    {caseStudy.scenario}
                  </div>
                  {caseStudy.questions?.map((q, i) => {
                    const userAnswer = caseAnswers[i];
                    const isRevealed = caseRevealed[i];
                    return (
                      <div key={i} className="quiz-question" style={{ marginBottom: 12 }}>
                        <div className="quiz-q-text" style={{ fontSize: 16 }}>{i + 1}. {q.question}</div>
                        <div className="quiz-options">
                          {q.options.map((opt, oi) => {
                            let cls = "";
                            if (isRevealed) {
                              if (opt[0] === q.correct) cls = "correct";
                              else if (opt === userAnswer) cls = "wrong";
                            }
                            return (
                              <button key={oi} className={`quiz-option ${cls}`} onClick={() => answerCase(i, opt)} disabled={isRevealed}>
                                <span className="quiz-option-letter">{opt[0]}.</span>
                                <span>{opt.slice(3)}</span>
                              </button>
                            );
                          })}
                        </div>
                        {isRevealed && <div className={`quiz-feedback ${userAnswer?.[0] === q.correct ? "correct" : "wrong"}`}>{userAnswer?.[0] === q.correct ? "✓ Correct!" : `✗ ${q.explanation || "Incorrect."}`}</div>}
                      </div>
                    );
                  })}
                  <button className="btn" style={{ marginTop: 8 }} onClick={runCaseStudy}>new case study ↻</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "finalexamsetup") {
    const deckNames = Object.keys(decks);
    return (
      <div className="app"><style>{styles}</style>
        <div className="header-strip"><span className="header-title">MEPN</span><span className="header-sub">final exam</span></div>
        <div className="main">
          <div className="deck-header">
            <button className="btn btn-ghost btn-sm" onClick={() => setView("home")}>← home</button>
            <h2 className="deck-header-title">Final Exam Setup</h2>
          </div>
          <p style={{ fontSize: 14, marginBottom: 16 }}>Select the decks to include in your 30-question final exam.</p>
          <div className="tool-box">
            {deckNames.length === 0 ? <p className="empty-state">No decks yet.</p> : deckNames.map(name => (
              <label key={name} className="checkbox-row">
                <input type="checkbox" checked={selectedDecks.includes(name)} onChange={e => {
                  setSelectedDecks(s => e.target.checked ? [...s, name] : s.filter(d => d !== name));
                }} />
                <span style={{ flex: 1 }}>{name}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--faded)" }}>{decks[name].length} cards</span>
              </label>
            ))}
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn" onClick={startFinalExam} disabled={selectedDecks.length === 0}>start exam ({selectedDecks.length} deck{selectedDecks.length !== 1 ? "s" : ""}) ↗</button>
        </div>
      </div>
    );
  }

  if (view === "deck") {
    return (
      <div className="app"><style>{styles}</style>
        <div className="header-strip"><span className="header-title">MEPN</span><span className="header-sub">{activeDeck}</span></div>
        <div className="main">
          <div className="deck-header">
            <button className="btn btn-ghost btn-sm" onClick={() => setView("home")}>← decks</button>
            <h2 className="deck-header-title">{activeDeck}</h2>
            {saveStatus && <span className="save-ok">✓ saved</span>}
          </div>

          <div className="mode-grid">
            <div className="mode-card" onClick={() => { setStudyFlipped(false); setView("study"); }}>
              <span className="mode-card-icon">🃏</span>
              <div className="mode-card-title">Flashcard Study</div>
              <div className="mode-card-desc">{studyIdx > 0 ? `resume at card ${studyIdx + 1}` : "flip through cards"}</div>
            </div>
            <div className="mode-card" onClick={startQuiz}>
              <span className="mode-card-icon">📝</span>
              <div className="mode-card-title">Quiz Mode</div>
              <div className="mode-card-desc">NCLEX-style questions</div>
            </div>
          </div>

          <div className="upload-zone" onClick={() => !loading && fileRef.current.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
            <span className="upload-icon">⬆</span>
            <p className="upload-label">drop images here or click to upload</p>
            <p className="upload-hint">JPG, PNG — multiple files supported</p>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
          </div>

          {error && <p className="error-msg">⚠ {error}</p>}

          {cards.length > 0 && (
            <>
              <div className="cards-toolbar">
                <span className="cards-count">{cards.length} cards</span>
                {illegibleCards.length > 0 && <span className="flag-pill">⚠ {illegibleCards.length} need clarification</span>}
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setFilter(f => f === "illegible" ? "all" : "illegible")}>{filter === "illegible" ? "show all" : "show flagged"}</button>
                </div>
              </div>
              <div>
                {displayCards.map((card) => {
                  const realIdx = cards.indexOf(card);
                  const isIllegible = card.back.includes(ILLEGIBLE_MARKER);
                  const isEditing = editingCard === realIdx;
                  const isFlipped = flipped[realIdx];
                  return (
                    <div key={realIdx} className={`flash-card ${isIllegible ? "flagged" : ""}`}>
                      <div className="card-num">#{realIdx + 1}</div>
                      {isEditing ? (
                        <div className="edit-area">
                          <textarea className="edit-textarea" value={editFront} onChange={e => setEditFront(e.target.value)} rows={2} placeholder="Front" />
                          <textarea className="edit-textarea" value={editBack} onChange={e => setEditBack(e.target.value)} rows={3} placeholder="Back" />
                          <div className="edit-actions">
                            <button className="btn btn-sm" onClick={saveEdit}>save</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditingCard(null)}>cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="card-row">
                          <div className="card-content">
                            <p className="card-front">{card.front}</p>
                            {isFlipped && <p className={`card-back ${isIllegible ? "warn" : ""}`}>{card.back}</p>}
                          </div>
                          <div className="card-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => setFlipped(f => ({ ...f, [realIdx]: !f[realIdx] }))}>{isFlipped ? "hide" : "show"}</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(realIdx)}>edit</button>
                            <button className="btn btn-ghost btn-sm btn-danger" onClick={() => deleteCard(realIdx)}>✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {cards.length === 0 && <p className="empty-state">No cards yet — upload some notes above.</p>}
        </div>
      </div>
    );
  }

  // HOME
  const deckNames = Object.keys(decks);
  const totalCards = Object.values(decks).flat().length;
  const weakCount = Object.keys(weakSpots).length;
  return (
    <div className="app"><style>{styles}</style>
      <div className="header-strip"><span className="header-title">MEPN</span><span className="header-sub">flashcard builder</span></div>
      <div className="main">
        <p className="deck-intro">Decks persist automatically — they'll be here when you return.</p>

        <div className="mode-grid" style={{ marginBottom: 28 }}>
          <div className="mode-card" onClick={() => { setSelectedDecks([]); setError(""); setView("finalexamsetup"); }}>
            <span className="mode-card-icon">🎓</span>
            <div className="mode-card-title">Final Exam Mode</div>
            <div className="mode-card-desc">30-question exam across decks</div>
          </div>
          <div className="mode-card" onClick={() => setView("weakspots")}>
            <span className="mode-card-icon">🎯</span>
            <div className="mode-card-title">Weak Spots</div>
            <div className="mode-card-desc">{weakCount > 0 ? `${weakCount} topics tracked` : "tracks what you get wrong"}</div>
          </div>
          <div className="mode-card" onClick={() => { setToolTab("casestudy"); setToolResult(""); setCaseStudy(null); setView("tools"); }}>
            <span className="mode-card-icon">🏥</span>
            <div className="mode-card-title">Case Study</div>
            <div className="mode-card-desc">Clinical reasoning practice</div>
          </div>
          <div className="mode-card" onClick={() => { setToolTab("mnemonic"); setToolResult(""); setToolInput(""); setView("tools"); }}>
            <span className="mode-card-icon">🧠</span>
            <div className="mode-card-title">Study Tools</div>
            <div className="mode-card-desc">Mnemonics + simplify notes</div>
          </div>
        </div>

        <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 14 }}>Your Decks</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            const data = localStorage.getItem("mepn-flashcards") || "{}";
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "mepn-decks.json"; a.click();
            URL.revokeObjectURL(url);
          }}>⬇ export decks</button>
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
            ⬆ import decks
            <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => {
                try {
                  const parsed = JSON.parse(ev.target.result);
                  const merged = { ...loadDecks(), ...parsed };
                  saveDecks(merged);
                  setDecks(merged);
                  alert("Decks imported successfully!");
                } catch { alert("Invalid file. Make sure it's a mepn-decks.json file."); }
              };
              reader.readAsText(file);
            }} />
          </label>
        </div>
        <div className="new-deck-row">
          <input className="input-field" value={newDeckName} onChange={e => setNewDeckName(e.target.value)} onKeyDown={e => e.key === "Enter" && createDeck()} placeholder="New deck name (e.g. NURS 500, Pharmacology...)" />
          <button className="btn" onClick={createDeck}>+ create</button>
        </div>

        {deckNames.length === 0 ? (
          <p className="empty-state">No decks yet — create one above.</p>
        ) : deckNames.map(name => {
          const deckCards = decks[name];
          const flagged = deckCards.filter(c => c.back.includes(ILLEGIBLE_MARKER)).length;
          return (
            <div key={name} className="deck-card">
              <div className="deck-icon">🗂</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="deck-name">{name}</p>
                <p className="deck-meta">{deckCards.length} card{deckCards.length !== 1 ? "s" : ""}{flagged > 0 && <span className="deck-flagged">⚠ {flagged} flagged</span>}</p>
              </div>
              <button className="btn btn-sm" onClick={() => openDeck(name, deckCards)}>open</button>
              <button className="btn btn-ghost btn-sm btn-danger" onClick={() => deleteDeck(name)}>✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
