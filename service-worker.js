const CACHE_NAME = "dsa-roadmap-cache-v4"; // Increment version to force update
const OFFLINE_URL = "offline.html";

const APP_SHELL = [
    "/",
    "/index.html",
    "offline.html",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
    "/icons/icon-maskable-192x192.png",
    "/icons/icon-maskable-512x512.png",
    // Local vendor files
    "/vendor/jspdf.umd.min.js",
    "/vendor/jspdf.plugin.autotable.min.js",
    "/vendor/html2canvas.min.js"
];

// Install: Caches the app shell.
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("SW: Caching app shell");
            return cache.addAll(APP_SHELL);
        })
    );
    self.skipWaiting(); // Force the waiting service worker to become the active one.
});

// ✅ Activate - With immediate claim and better cleanup
self.addEventListener("activate", (event) => {
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((keys) =>
                Promise.all(
                    keys.map((key) => {
                        if (key !== CACHE_NAME) {
                            console.log("SW: Removing old cache", key);
                            return caches.delete(key);
                        }
                    })
                )
            ),
            // Take control immediately
            self.clients.claim()
        ])
    );
});

// Fetch: Stale-while-revalidate for assets, and network-first for navigation.
self.addEventListener("fetch", (event) => {
    const { request } = event;

    // For navigation requests, try network first, then cache, then offline page.
    if (request.mode === "navigate") {
        event.respondWith(
            (async () => {
                try {
                    const networkResponse = await fetch(request);
                    return networkResponse;
                } catch (error) {
                    console.log("SW: Fetch failed; returning offline page instead.", error);
                    const cache = await caches.open(CACHE_NAME);
                    return await cache.match(OFFLINE_URL);
                }
            })()
        );
        return;
    }

    // For other requests (assets), use stale-while-revalidate.
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(request).then((cachedResponse) => {
                const networkFetch = fetch(request).then((networkResponse) => {
                    cache.put(request, networkResponse.clone());
                    return networkResponse;
                });
                return cachedResponse || networkFetch;
            });
        })
    );
});
