// Switches between the Tasks and Habits views,
// and remembers which one you had open last.
const VIEW_KEY = "aegis.view";
const tabButtons = document.querySelectorAll(".tab");

function showView(view) {
  for (const tab of tabButtons) {
    const active = tab.dataset.view === view;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    document.getElementById(`${tab.dataset.view}-view`).hidden = !active;
  }
  localStorage.setItem(VIEW_KEY, view);
}

for (const tab of tabButtons) {
  tab.addEventListener("click", () => showView(tab.dataset.view));
}

// Show today's date under the title, e.g. "Wednesday, November 4"
document.getElementById("today").textContent = new Date().toLocaleDateString(
  undefined, { weekday: "long", month: "long", day: "numeric" }
);

// Only accept known views, in case storage holds something unexpected
const VIEWS = ["tasks", "habits", "goals", "study", "notes"];
const savedView = localStorage.getItem(VIEW_KEY);
showView(VIEWS.includes(savedView) ? savedView : "tasks");
