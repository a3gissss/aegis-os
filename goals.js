import { makeId, dueLabel, cleanDate } from "./utils.js";

// Goals are big outcomes broken into small steps.
// Progress = how many steps are done.
const GOALS_KEY = "aegis.goals";

const goalForm = document.getElementById("goal-form");
const goalInput = document.getElementById("goal-input");
const goalDueInput = document.getElementById("goal-due");
const goalList = document.getElementById("goal-list");
const goalEmpty = document.getElementById("goal-empty");

// Each goal looks like:
// { id, title, due: "2026-12-31" or null, steps: [{ id, text, done }] }
let goals = loadGoals();

function loadGoals() {
  try {
    const saved = JSON.parse(localStorage.getItem(GOALS_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveGoals() {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

function findGoal(id) {
  return goals.find((g) => g.id === id);
}

function renderGoals() {
  goalList.replaceChildren();

  for (const goal of goals) {
    const total = goal.steps.length;
    const doneCount = goal.steps.filter((s) => s.done).length;
    const percent = total ? Math.round((doneCount / total) * 100) : 0;
    const complete = total > 0 && doneCount === total;

    const li = document.createElement("li");
    li.className = complete ? "goal complete" : "goal";
    li.dataset.goalId = goal.id;

    // Header: title, optional target date, delete button
    const top = document.createElement("div");
    top.className = "goal-top";

    const heading = document.createElement("div");
    heading.className = "goal-heading";

    // SECURITY: textContent, never innerHTML (XSS)
    const title = document.createElement("span");
    title.className = "goal-title";
    title.textContent = goal.title;
    heading.append(title);

    if (goal.due && !complete) {
      const { text, cls } = dueLabel(goal.due);
      const dueEl = document.createElement("small");
      dueEl.className = `due ${cls}`;
      dueEl.textContent = text;
      heading.append(dueEl);
    }

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Delete goal");
    del.addEventListener("click", () => deleteGoal(goal.id));

    top.append(heading, del);

    // Progress bar: an outer track with an inner fill set to percent width
    const bar = document.createElement("div");
    bar.className = "progress";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(percent));

    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = `${percent}%`;
    bar.append(fill);

    const status = document.createElement("p");
    status.className = "progress-text";
    if (total === 0) status.textContent = "Add steps below to start tracking progress";
    else if (complete) status.textContent = "🎉 Goal complete!";
    else status.textContent = `${doneCount} of ${total} steps · ${percent}%`;

    // Step list
    const stepList = document.createElement("ul");
    stepList.className = "steps";

    for (const step of goal.steps) {
      const stepLi = document.createElement("li");
      stepLi.className = step.done ? "step done" : "step";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = step.done;
      checkbox.addEventListener("change", () => toggleStep(goal.id, step.id));

      const text = document.createElement("span");
      text.textContent = step.text;

      const delStep = document.createElement("button");
      delStep.className = "delete";
      delStep.textContent = "✕";
      delStep.setAttribute("aria-label", "Delete step");
      delStep.addEventListener("click", () => deleteStep(goal.id, step.id));

      stepLi.append(checkbox, text, delStep);
      stepList.append(stepLi);
    }

    // Small form for adding a step to this goal
    const stepForm = document.createElement("form");
    stepForm.className = "step-form";

    const stepInput = document.createElement("input");
    stepInput.type = "text";
    stepInput.placeholder = "Add a step…";
    stepInput.maxLength = 150;
    stepInput.autocomplete = "off";
    stepInput.setAttribute("aria-label", "New step");

    const stepBtn = document.createElement("button");
    stepBtn.type = "submit";
    stepBtn.textContent = "+";
    stepBtn.setAttribute("aria-label", "Add step");

    stepForm.append(stepInput, stepBtn);
    stepForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = stepInput.value.trim();
      if (value) addStep(goal.id, value);
    });

    li.append(top, bar, status, stepList, stepForm);
    goalList.append(li);
  }

  goalEmpty.hidden = goals.length > 0;
}

// Re-rendering rebuilds every input, which loses keyboard focus.
// This puts the cursor back in the goal's step box so you can keep typing.
function focusStepInput(goalId) {
  const input = goalList.querySelector(
    `[data-goal-id="${CSS.escape(goalId)}"] .step-form input`
  );
  if (input) input.focus();
}

function addGoal(title, due) {
  goals.push({ id: makeId(), title, due: cleanDate(due), steps: [] });
  saveGoals();
  renderGoals();
}

function deleteGoal(id) {
  if (!confirm("Delete this goal and all its steps?")) return;
  goals = goals.filter((g) => g.id !== id);
  saveGoals();
  renderGoals();
}

function addStep(goalId, text) {
  findGoal(goalId).steps.push({ id: makeId(), text, done: false });
  saveGoals();
  renderGoals();
  focusStepInput(goalId);
}

function toggleStep(goalId, stepId) {
  const step = findGoal(goalId).steps.find((s) => s.id === stepId);
  step.done = !step.done;
  saveGoals();
  renderGoals();
}

function deleteStep(goalId, stepId) {
  const goal = findGoal(goalId);
  goal.steps = goal.steps.filter((s) => s.id !== stepId);
  saveGoals();
  renderGoals();
}

goalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = goalInput.value.trim();
  if (!title) return;
  addGoal(title, goalDueInput.value);
  goalInput.value = "";
  goalDueInput.value = "";
  // Jump straight to adding the first step of the new goal
  focusStepInput(goals[goals.length - 1].id);
});

renderGoals();
