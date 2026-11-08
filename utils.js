// Small helpers shared by every part of the app.
// Other files get them with: import { makeId } from "./utils.js";

export function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Turn a Date into "2026-11-04" using the LOCAL date.
// toISOString() would use UTC and give the wrong day late at night.
export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The reverse: "2026-11-04" -> a Date at local midnight
export function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Whole days from today until the given "YYYY-MM-DD" (negative = in the past)
export function daysUntil(key) {
  const today = parseDateKey(dateKey(new Date()));
  return Math.round((parseDateKey(key) - today) / 86400000);
}

// Turn a due date into a friendly label plus a CSS class for its color.
// Used by both tasks and goals.
export function dueLabel(due) {
  const days = daysUntil(due);
  const pretty = parseDateKey(due).toLocaleDateString(
    undefined, { weekday: "short", day: "numeric", month: "short" }
  );

  if (days < 0) return { text: `Overdue · ${pretty}`, cls: "overdue" };
  if (days === 0) return { text: "Due today", cls: "today" };
  if (days === 1) return { text: "Due tomorrow", cls: "soon" };
  return { text: `Due ${pretty}`, cls: "" };
}

// Only accept a real "YYYY-MM-DD" string; anything else becomes null
export function cleanDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
