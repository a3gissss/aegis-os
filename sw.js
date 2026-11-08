// Service worker: a script the browser runs in the background, between
// the app and the network. It lets Aegis OS open even when you're offline.
//
// Strategy: "network first, cache as fallback".
// Online: always fetch the latest files (so code changes show up right away),
//         and keep a copy in the cache.
// Offline: the fetch fails, so serve the cached copy instead.

const CACHE = "aegis-v3"; // bump this whenever APP_FILES or this file's logic changes

// The "app shell": every file needed to start the app
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./utils.js",
  "./app.js",
  "./habits.js",
  "./goals.js",
  "./timer.js",
  "./notes.js",
  "./backup.js",
  "./tabs.js",
  "./today.js",
  "./pwa.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Runs once, when the browser installs this service worker
self.addEventListener("install", (event) => {
  // cache: "reload" skips the browser's normal HTTP cache, so we store the
  // real latest files, not possibly-stale copies of them
  const fresh = APP_FILES.map((file) => new Request(file, { cache: "reload" }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(fresh)));
  self.skipWaiting(); // activate straight away instead of waiting for old tabs to close
});

// Runs when this version takes over: delete caches from older versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle our own files, and only reads (GET).
  // Never cache requests to other sites or anything that changes data.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // cache: "no-cache" makes fetch() check with the server every time instead of
  // quietly reusing the browser's HTTP cache. Without it, "network first" could
  // still hand back an old file, mixing new and old code (a real bug we hit).
  // Page navigations can't be re-created with options, so those go by URL.
  const fresh = request.mode === "navigate" ? request.url : request;

  event.respondWith(
    fetch(fresh, { cache: "no-cache" })
      .then((response) => {
        // Only cache good responses, never errors
        if (response.ok) {
          const copy = response.clone(); // a response can only be read once, so cache a copy
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then((cached) =>
          cached || (request.mode === "navigate" ? caches.match("./index.html") : Response.error())
        )
      )
  );
});
