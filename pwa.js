// Turns Aegis OS into an installable app (PWA):
// 1. registers the service worker (sw.js) for offline use
// 2. shows an "Install app" button when the browser allows installing

const installBtn = document.getElementById("install-btn");
let installPrompt = null;

// Service workers only work on HTTPS or localhost. Browsers enforce this
// because a service worker can intercept every request the app makes.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("Service worker not registered:", error);
  });
}

// The browser fires this when the app meets the install rules
// (manifest + icons + service worker). We save the event and show our button.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault(); // stop the browser's own mini prompt; we use our button
  installPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();       // opens the browser's real "Install Aegis OS?" dialog
  await installPrompt.userChoice;
  installPrompt = null;         // each prompt can only be used once
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
});
