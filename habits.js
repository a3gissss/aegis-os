import { makeId, dateKey } from "./utils.js";

// Habits are saved under their own key, separate from tasks
const HABITS_KEY = "aegis.habits";
const DAYS_SHOWN = 7;
const habitForm = document.getElementById("habit-form");
const habitInput = document.getElementById("habit-input");
const habitList = document.getElementById("habit-list");
const habitEmpty = document.getElementById("habit-empty");

// Each habit looks like: { id, name, log: ["2026-11-03", "2026-11-04"] }
// log holds the dates the habit was done.
let habits = loadHabits();

function loadHabits() {
  try {
    const saved = JSON.parse(localStorage.getItem(HABITS_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

// The last n days, oldest first, ending with today
function lastDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

// Count consecutive done days going backwards. If today isn't done yet,
// start from yesterday, so the streak doesn't "break" until the day is over.
function currentStreak(habit) {
  const done = new Set(habit.log);
  const day = new Date();
  if (!done.has(dateKey(day))) day.setDate(day.getDate() - 1);

  let streak = 0;
  while (done.has(dateKey(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

function renderHabits() {
  habitList.replaceChildren();
  const days = lastDays(DAYS_SHOWN);
  const todayKey = dateKey(new Date());

  for (const habit of habits) {
    const li = document.createElement("li");
    li.className = "habit";

    const top = document.createElement("div");
    top.className = "habit-top";

    // SECURITY: textContent again, so a habit name can't inject HTML (XSS)
    const name = document.createElement("span");
    name.className = "habit-name";
    name.textContent = habit.name;

    const streak = currentStreak(habit);
    const streakEl = document.createElement("span");
    streakEl.className = streak > 0 ? "streak active" : "streak";
    streakEl.textContent = streak > 0
      ? `🔥 ${streak} day${streak === 1 ? "" : "s"}`
      : "No streak yet";

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Delete habit");
    del.addEventListener("click", () => deleteHabit(habit.id));

    top.append(name, streakEl, del);

    // One button per day; click to mark done / undone
    const row = document.createElement("div");
    row.className = "days";

    for (const day of days) {
      const key = dateKey(day);
      const done = habit.log.includes(key);

      const btn = document.createElement("button");
      btn.className = "day";
      if (done) btn.classList.add("done");
      if (key === todayKey) btn.classList.add("today");
      btn.setAttribute("aria-pressed", String(done));
      btn.setAttribute("aria-label", `${habit.name}, ${day.toDateString()}`);

      const weekday = document.createElement("span");
      weekday.textContent = day.toLocaleDateString(undefined, { weekday: "short" });
      const date = document.createElement("strong");
      date.textContent = day.getDate();

      btn.append(weekday, date);
      btn.addEventListener("click", () => toggleDay(habit.id, key));
      row.append(btn);
    }

    li.append(top, row);
    habitList.append(li);
  }

  habitEmpty.hidden = habits.length > 0;
}

function addHabit(name) {
  habits.push({ id: makeId(), name, log: [] });
  saveHabits();
  renderHabits();
}

function toggleDay(id, key) {
  const habit = habits.find((h) => h.id === id);
  habit.log = habit.log.includes(key)
    ? habit.log.filter((k) => k !== key)
    : [...habit.log, key];
  saveHabits();
  renderHabits();
}

function deleteHabit(id) {
  // Deleting wipes the habit's whole history, so ask first
  if (!confirm("Delete this habit and its history?")) return;
  habits = habits.filter((h) => h.id !== id);
  saveHabits();
  renderHabits();
}

habitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = habitInput.value.trim();
  if (!name) return;
  addHabit(name);
  habitInput.value = "";
  habitInput.focus();
});

renderHabits();
