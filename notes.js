import { makeId, dateKey } from "./utils.js";

// Plain-text notes with search and autosave.
const NOTES_KEY = "aegis.notes";
const SAVE_DELAY = 400; // ms to wait after you stop typing before saving

const browser = document.getElementById("notes-browser");
const editor = document.getElementById("note-editor");
const searchInput = document.getElementById("note-search");
const newBtn = document.getElementById("note-new");
const noteList = document.getElementById("note-list");
const noteEmpty = document.getElementById("note-empty");
const backBtn = document.getElementById("note-back");
const deleteBtn = document.getElementById("note-delete");
const statusEl = document.getElementById("note-status");
const titleInput = document.getElementById("note-title");
const bodyInput = document.getElementById("note-body");

// Each note looks like: { id, title, body, updatedAt }  (updatedAt = timestamp)
let notes = loadNotes();
let openId = null;      // the note in the editor, or null when showing the list
let pendingSave = null; // the waiting setTimeout, if a save is scheduled

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTES_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveNotes() {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    return true;
  } catch {
    // localStorage holds roughly 5 MB per site. If it's full, setItem throws.
    return false;
  }
}

function findNote(id) {
  return notes.find((n) => n.id === id);
}

function isEmpty(note) {
  return !note.title.trim() && !note.body.trim();
}

// First ~90 characters of the body, on one line
function snippet(body) {
  return body.replace(/\s+/g, " ").trim().slice(0, 90);
}

// Today -> "14:30", any other day -> "3 Nov"
function formatUpdated(ts) {
  const date = new Date(ts);
  return dateKey(date) === dateKey(new Date())
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function renderList() {
  noteList.replaceChildren();
  const query = searchInput.value.trim().toLowerCase();

  // Newest first, then keep only the ones matching the search
  const shown = [...notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((n) => !query
      || n.title.toLowerCase().includes(query)
      || n.body.toLowerCase().includes(query));

  for (const note of shown) {
    const li = document.createElement("li");

    // The whole card is a button, so it works with keyboard (Tab + Enter) too
    const card = document.createElement("button");
    card.className = "note-card";
    card.addEventListener("click", () => openNote(note.id));

    // SECURITY: textContent, never innerHTML (XSS)
    const title = document.createElement("strong");
    title.textContent = note.title.trim() || "Untitled";

    const preview = document.createElement("span");
    preview.textContent = snippet(note.body) || "No text yet";

    const time = document.createElement("small");
    time.textContent = formatUpdated(note.updatedAt);

    card.append(title, preview, time);
    li.append(card);
    noteList.append(li);
  }

  if (notes.length === 0) noteEmpty.textContent = "No notes yet. Press New note to write one.";
  else if (shown.length === 0) noteEmpty.textContent = `No notes match "${searchInput.value.trim()}".`;
  noteEmpty.hidden = shown.length > 0;
}

function openNote(id) {
  const note = findNote(id);
  openId = id;
  titleInput.value = note.title;
  bodyInput.value = note.body;
  statusEl.textContent = "";
  browser.hidden = true;
  editor.hidden = false;
}

function newNote() {
  const note = { id: makeId(), title: "", body: "", updatedAt: Date.now() };
  notes.push(note);
  openNote(note.id);
  titleInput.focus();
}

// Debouncing: every keystroke restarts a short countdown, and we only
// save once you pause. Saving on every single keystroke would be wasteful.
function onEdit() {
  const note = findNote(openId);
  note.title = titleInput.value;
  note.body = bodyInput.value;
  note.updatedAt = Date.now();

  statusEl.textContent = "Saving…";
  clearTimeout(pendingSave);
  pendingSave = setTimeout(flushSave, SAVE_DELAY);
}

// Save right now if a save is waiting (used when leaving the editor or the page)
function flushSave() {
  if (pendingSave === null) return;
  clearTimeout(pendingSave);
  pendingSave = null;
  statusEl.textContent = saveNotes() ? "Saved" : "Not saved: storage is full";
}

function closeEditor() {
  flushSave();
  // Don't keep notes you opened but never wrote anything in
  const note = findNote(openId);
  if (note && isEmpty(note)) {
    notes = notes.filter((n) => n.id !== openId);
    saveNotes();
  }
  openId = null;
  editor.hidden = true;
  browser.hidden = false;
  renderList();
}

function deleteNote() {
  if (!confirm("Delete this note?")) return;
  clearTimeout(pendingSave);
  pendingSave = null;
  notes = notes.filter((n) => n.id !== openId);
  saveNotes();
  openId = null;
  editor.hidden = true;
  browser.hidden = false;
  renderList();
}

newBtn.addEventListener("click", newNote);
backBtn.addEventListener("click", closeEditor);
deleteBtn.addEventListener("click", deleteNote);
searchInput.addEventListener("input", renderList);
titleInput.addEventListener("input", onEdit);
bodyInput.addEventListener("input", onEdit);

// Escape goes back to the list
editor.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeEditor();
});

// Closing or reloading the tab: save anything still waiting
window.addEventListener("pagehide", flushSave);

renderList();
