const VERSION = "todos.v0";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/assets/style.css",
  "/assets/callstack.webp",
  "/js/todos.js",
  "/js/ulid.min.js",
];

const cacheName = (name) => `${VERSION}-${name}`;

const addResourcesToCache = async (resources) => {
  const cache = await caches.open(VERSION);
  await cache.addAll(resources);
};

self.addEventListener("install", (event) => {
  event.waitUntil(addResourcesToCache(STATIC_ASSETS));
});

async function cacheOnError(request) {
  const cache = await caches.open(VERSION);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    } else {
      const cachedResponse = await cache.match(request);
      return cachedResponse;
    }
  } catch {
    const cachedResponse = await cache.match(request);
    return cachedResponse;
  }
}

async function networkOnly(request) {
  try {
    const response = await fetch(request);

    return response;
  } catch {
    return new Response("Network error happened", {
      status: 408,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method.toLowerCase() === "get") {
    event.respondWith(cacheOnError(request));
  } else {
    event.respondWith(networkOnly(request));
  }
});
