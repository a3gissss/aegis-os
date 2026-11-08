import { makeId, daysUntil, dueLabel, cleanDate, notifyChange } from "./utils.js";

// The key our tasks are saved under in the browser's localStorage
const STORAGE_KEY = "aegis.tasks";

// Grab the HTML elements we need to work with
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const dueInput = document.getElementById("task-due");
const list = document.getElementById("task-list");
const count = document.getElementById("task-count");

// All tasks live in this array. It is the "single source of truth":
// we change the array, then redraw the page from it.
// Each task looks like: { id, text, done, due: "2026-11-10" or null }
let tasks = loadTasks();

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    // Saved data was missing or corrupted, so start fresh
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  notifyChange();
}

// Lets other screens (like Today) read the tasks without being able to
// replace the array itself
export function getTasks() {
  return tasks;
}

// Order: unfinished first, then by due date (soonest first),
// tasks without a date after dated ones, finished tasks at the bottom.
function compareTasks(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.due && b.due) return a.due.localeCompare(b.due);
  if (a.due) return -1;
  if (b.due) return 1;
  return 0; // same group: keep the order they were added in
}

// Redraw the whole list from the tasks array
function render() {
  list.replaceChildren();

  for (const task of [...tasks].sort(compareTasks)) {
    const li = document.createElement("li");
    li.className = task.done ? "task done" : "task";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const body = document.createElement("div");
    body.className = "task-body";

    // SECURITY: textContent treats the text as plain text, never as HTML.
    // Using innerHTML here would allow XSS (OWASP A03: Injection).
    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;
    body.append(text);

    if (task.due) {
      const { text: label, cls } = dueLabel(task.due);
      const dueEl = document.createElement("small");
      dueEl.className = `due ${cls}`;
      dueEl.textContent = label;
      body.append(dueEl);
    }

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Delete task");
    del.addEventListener("click", () => deleteTask(task.id));

    li.append(checkbox, body, del);
    list.append(li);
  }

  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => t.due && daysUntil(t.due) < 0).length;

  if (tasks.length === 0) {
    count.textContent = "No tasks yet. Add one above.";
  } else {
    count.textContent = `${open.length} of ${tasks.length} left`
      + (overdue ? ` · ${overdue} overdue` : "");
  }
}

function addTask(text, due) {
  tasks.push({ id: makeId(), text, done: false, due: cleanDate(due) });
  saveTasks();
  render();
}

export function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  task.done = !task.done;
  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault(); // stop the browser from reloading the page
  const text = input.value.trim();
  if (!text) return;
  addTask(text, dueInput.value);
  input.value = "";
  dueInput.value = "";
  input.focus();
});

render();
