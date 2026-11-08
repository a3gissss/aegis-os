import { dateKey, daysUntil, dueLabel, onChange } from "./utils.js";
import { getTasks, toggleTask } from "./app.js";
import { getHabits, toggleDay, currentStreak } from "./habits.js";
import { getGoals, toggleStep } from "./goals.js";
import { getSessions } from "./timer.js";
import { showView } from "./tabs.js";

// The Today screen: everything that needs you today, in one place.
// It owns no data of its own. It reads from the other parts of the app
// and uses their own functions to make changes, so all tabs stay in sync.

const headline = document.getElementById("today-headline");
const bar = document.getElementById("today-bar");
const fill = document.getElementById("today-fill");
const taskList = document.getElementById("today-tasks");
const habitList = document.getElementById("today-habits");
const goalList = document.getElementById("today-goals");
const studyText = document.getElementById("today-study-text");
const studyBtn = document.getElementById("today-study-btn");

// One tickable row. The whole row is a <label>, so tapping anywhere on it
// ticks the checkbox: a much bigger target than the checkbox alone.
function checkRow({ text, meta = "", metaClass = "", checked, onToggle }) {
  const li = document.createElement("li");
  li.className = checked ? "today-item done" : "today-item";

  const label = document.createElement("label");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.addEventListener("change", onToggle);

  const body = document.createElement("span");
  body.className = "today-body";

  // SECURITY: textContent, never innerHTML (XSS)
  const main = document.createElement("span");
  main.className = "today-main";
  main.textContent = text;
  body.append(main);

  if (meta) {
    const small = document.createElement("small");
    small.className = `today-meta ${metaClass}`;
    small.textContent = meta;
    body.append(small);
  }

  label.append(checkbox, body);
  li.append(label);
  return li;
}

// A placeholder row with a link to the tab where you'd add things
function emptyRow(message, view, linkText) {
  const li = document.createElement("li");
  li.className = "today-empty";

  const text = document.createElement("span");
  text.textContent = message;

  const link = document.createElement("button");
  link.className = "link-btn";
  link.textContent = linkText;
  link.addEventListener("click", () => showView(view));

  li.append(text, link);
  return li;
}

function renderToday() {
  const todayKey = dateKey(new Date());
  let total = 0; // things that count towards today's progress
  let done = 0;

  // Tasks: due today (done or not) plus anything overdue and unfinished
  taskList.replaceChildren();
  const dueTasks = getTasks()
    .filter((t) => t.due && (t.due === todayKey || (!t.done && daysUntil(t.due) < 0)))
    .sort((a, b) => a.due.localeCompare(b.due));

  for (const task of dueTasks) {
    const { text, cls } = dueLabel(task.due);
    taskList.append(checkRow({
      text: task.text,
      meta: text,
      metaClass: task.done ? "" : `due ${cls}`,
      checked: task.done,
      onToggle: () => toggleTask(task.id),
    }));
    total++;
    if (task.done) done++;
  }
  if (dueTasks.length === 0) {
    taskList.append(emptyRow("Nothing due today.", "tasks", "All tasks →"));
  }

  // Habits: every habit, ticked if done today
  habitList.replaceChildren();
  for (const habit of getHabits()) {
    const isDone = habit.log.includes(todayKey);
    const streak = currentStreak(habit);
    habitList.append(checkRow({
      text: habit.name,
      meta: streak > 0 ? `🔥 ${streak} day${streak === 1 ? "" : "s"}` : "Start a streak today",
      checked: isDone,
      onToggle: () => toggleDay(habit.id, todayKey),
    }));
    total++;
    if (isDone) done++;
  }
  if (getHabits().length === 0) {
    habitList.append(emptyRow("No habits yet.", "habits", "Add one →"));
  }

  // Goals: the first unfinished step of each goal. Ticking it shows the next one.
  goalList.replaceChildren();
  let goalRows = 0;
  for (const goal of getGoals()) {
    const next = goal.steps.find((s) => !s.done);
    if (!next) continue;
    const stepsDone = goal.steps.filter((s) => s.done).length;
    goalList.append(checkRow({
      text: next.text,
      meta: `${goal.title} · ${stepsDone} of ${goal.steps.length} steps`,
      checked: false,
      onToggle: () => toggleStep(goal.id, next.id),
    }));
    goalRows++;
  }
  if (goalRows === 0) {
    goalList.append(emptyRow("No goal steps waiting.", "goals", "Goals →"));
  }

  // Study: today's minutes
  const sessions = getSessions().filter((s) => s.date === todayKey);
  const minutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  studyText.textContent = sessions.length
    ? `${minutes} min studied · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`
    : "No study yet today.";

  // Headline + progress bar (goal steps don't count: goals aren't daily)
  bar.hidden = total === 0;
  fill.style.width = total ? `${(done / total) * 100}%` : "0%";
  if (total === 0) headline.textContent = "Nothing planned for today. Add a task with a due date or a habit to get started.";
  else if (done === total) headline.textContent = "🎉 All done for today!";
  else headline.textContent = `${total - done} left today · ${done} of ${total} done`;
}

studyBtn.addEventListener("click", () => showView("study"));

// Redraw whenever anything is saved anywhere in the app
onChange(renderToday);

// If the app was left open overnight, refresh when you come back to it
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderToday();
});

renderToday();
