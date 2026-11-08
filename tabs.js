// Switches between the views (Today, Tasks, Habits, ...).
// The app always opens on Today, so you see what matters first.
const tabButtons = document.querySelectorAll(".tab");

// Exported so other screens can jump to a tab (e.g. Today's "Start focus")
export function showView(view) {
  for (const tab of tabButtons) {
    const active = tab.dataset.view === view;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    document.getElementById(`${tab.dataset.view}-view`).hidden = !active;
  }
  window.scrollTo(0, 0);
}

for (const tab of tabButtons) {
  tab.addEventListener("click", () => showView(tab.dataset.view));
}

// Show today's date under the title, e.g. "Sunday 8 November"
document.getElementById("today").textContent = new Date().toLocaleDateString(
  undefined, { weekday: "long", month: "long", day: "numeric" }
);

showView("today");
