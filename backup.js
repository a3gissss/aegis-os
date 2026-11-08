import { cleanDate, dateKey } from "./utils.js";

// Export all your data to a .json file, and import it back.
const BACKUP_FORMAT = "aegis-os-backup";
const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = "aegis.lastBackup";
const RESTORED_KEY = "aegis.justRestored"; // sessionStorage: message to show after reload
const MAX_FILE_SIZE = 5 * 1024 * 1024;   // 5 MB, the most localStorage could hold anyway

const statusEl = document.getElementById("backup-status");
const exportBtn = document.getElementById("backup-export");
const importBtn = document.getElementById("backup-import");
const fileInput = document.getElementById("backup-file");

const isString = (v) => typeof v === "string";
const isBool = (v) => typeof v === "boolean";
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isDate = (v) => cleanDate(v) !== null;

// SECURITY: an imported file is untrusted input. Anyone could hand you a
// "backup" that's been edited. So for every item we check each field's type
// and build a fresh copy with ONLY the fields we know about. Anything else
// in the file is dropped. Accepting data without checking it like this is
// part of OWASP A08: Software and Data Integrity Failures.
//
// Each clean() takes one untrusted item and returns a safe copy, or null.
const COLLECTIONS = {
  tasks: {
    key: "aegis.tasks",
    clean: (t) => isString(t.id) && isString(t.text) && isBool(t.done)
      ? { id: t.id, text: t.text.slice(0, 200), done: t.done, due: cleanDate(t.due) }
      : null,
  },
  habits: {
    key: "aegis.habits",
    clean: (h) => isString(h.id) && isString(h.name) && Array.isArray(h.log)
      ? { id: h.id, name: h.name.slice(0, 100), log: h.log.filter(isDate) }
      : null,
  },
  goals: {
    key: "aegis.goals",
    clean: (g) => isString(g.id) && isString(g.title) && Array.isArray(g.steps)
      ? {
          id: g.id,
          title: g.title.slice(0, 120),
          due: cleanDate(g.due),
          steps: g.steps
            .filter((s) => isObject(s) && isString(s.id) && isString(s.text) && isBool(s.done))
            .map((s) => ({ id: s.id, text: s.text.slice(0, 150), done: s.done })),
        }
      : null,
  },
  sessions: {
    key: "aegis.sessions",
    clean: (s) => isString(s.id) && isString(s.subject) && isNumber(s.minutes)
      && isDate(s.date) && isNumber(s.endedAt)
      ? { id: s.id, subject: s.subject.slice(0, 80), minutes: s.minutes, date: s.date, endedAt: s.endedAt }
      : null,
  },
  notes: {
    key: "aegis.notes",
    clean: (n) => isString(n.id) && isString(n.title) && isString(n.body) && isNumber(n.updatedAt)
      ? { id: n.id, title: n.title.slice(0, 120), body: n.body, updatedAt: n.updatedAt }
      : null,
  },
};

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.className = `count ${tone}`;
}

// "Last backup: 3 days ago". Turns orange if it's been a week or more.
function renderStatus() {
  const last = Number(localStorage.getItem(LAST_BACKUP_KEY));
  if (!last) return setStatus("Last backup: never", "warn");

  const days = Math.floor((Date.now() - last) / 86400000);
  const when = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  setStatus(`Last backup: ${when}`, days >= 7 ? "warn" : "");
}

function exportBackup() {
  const data = {};
  for (const [name, { key }] of Object.entries(COLLECTIONS)) {
    data[name] = readList(key);
  }

  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };

  // Make a file in memory (a Blob), give it a temporary URL,
  // and "click" an invisible link to it to start the download.
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aegis-backup-${dateKey(new Date())}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // free the memory afterwards

  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  renderStatus();
}

async function importBackup(file) {
  // Check the size BEFORE reading, so a huge file can't freeze the page
  if (file.size > MAX_FILE_SIZE) {
    return setStatus("Import failed: file is too large to be a backup.", "error");
  }

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    return setStatus("Import failed: that file isn't valid JSON.", "error");
  }

  if (!isObject(backup) || backup.format !== BACKUP_FORMAT || !isObject(backup.data)) {
    return setStatus("Import failed: that isn't an Aegis OS backup file.", "error");
  }
  if (backup.version !== BACKUP_VERSION) {
    return setStatus("Import failed: backup was made by a different version.", "error");
  }

  // Clean every collection, counting what had to be thrown away
  const cleaned = {};
  const counts = [];
  let skipped = 0;

  for (const [name, { clean }] of Object.entries(COLLECTIONS)) {
    const list = Array.isArray(backup.data[name]) ? backup.data[name] : [];
    const good = list.filter(isObject).map(clean).filter(Boolean);
    skipped += list.length - good.length;
    cleaned[name] = good;
    // "1 task", "2 tasks" (every collection name is a plain plural ending in "s")
    counts.push(`${good.length} ${good.length === 1 ? name.slice(0, -1) : name}`);
  }

  const message = "Replace ALL your current data with this backup?\n\n"
    + counts.join(", ")
    + (skipped ? `\n(${skipped} invalid item${skipped === 1 ? "" : "s"} will be skipped)` : "")
    + "\n\nThis can't be undone. Export a backup first if you're unsure.";
  if (!confirm(message)) return;

  for (const [name, { key }] of Object.entries(COLLECTIONS)) {
    localStorage.setItem(key, JSON.stringify(cleaned[name]));
  }

  // Every part of the app loads its data on page load, so the simplest
  // way to show the restored data everywhere is to reload the page.
  try {
    sessionStorage.setItem(RESTORED_KEY, `Backup restored: ${counts.join(", ")}`);
  } catch {
    // only affects the confirmation message
  }
  location.reload();
}

exportBtn.addEventListener("click", exportBackup);

// The real file picker is hidden (it's hard to style), so our button opens it
importBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  fileInput.value = ""; // so choosing the same file again still triggers "change"
  if (file) importBackup(file);
});

// After a successful import + reload, show the result once
let restored = null;
try {
  restored = sessionStorage.getItem(RESTORED_KEY);
  sessionStorage.removeItem(RESTORED_KEY);
} catch {
  // ignore
}
if (restored) setStatus(restored, "ok");
else renderStatus();
