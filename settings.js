// Opens and closes the Settings panel.
// It's a native <dialog>: showModal() dims the page behind it, traps
// keyboard focus inside, and closes on Escape, all built into the browser.

const dialog = document.getElementById("settings");
const openBtn = document.getElementById("settings-btn");
const closeBtn = document.getElementById("settings-close");

openBtn.addEventListener("click", () => dialog.showModal());
closeBtn.addEventListener("click", () => dialog.close());

// Tapping the dimmed area outside the panel closes it. A click on the
// backdrop reports the <dialog> itself as its target; clicks on the panel's
// contents report the element inside instead.
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
