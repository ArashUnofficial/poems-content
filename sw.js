const CACHE_NAME = "mohammad-poems-shell-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  // Add icon paths here if you have them
];

// Install: Cache the app shell
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

// Activate: Clean up old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch: Serve from cache, fall back to network
self.addEventListener("fetch", (e) => {
  // We ignore JSON calls here (let app.js handle them via Fetch API -> IndexedDB)
  // unless the network fails, but app.js handles offline logic for data.
  // We strictly handle UI assets here.

  if (e.request.url.includes(".json")) {
    return; // Let the browser/app.js handle data fetching
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
