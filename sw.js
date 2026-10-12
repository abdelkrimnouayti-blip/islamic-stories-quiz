"use strict";

const CACHE_NAME = "visit-report-v1";
const RUNTIME_CACHE = "visit-report-runtime-v1";
const APP_URL = new URL("./index.html", self.registration.scope).href;
const APP_SHELL = [
  APP_URL,
  new URL("./manifest.json", self.registration.scope).href,
  new URL("./icons/icon-192.png", self.registration.scope).href,
  new URL("./icons/icon-512.png", self.registration.scope).href
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("visit-report-") && key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isGoogleFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

  if (isGoogleFont) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async cache => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;

        const response = await fetch(request);
        if (response.ok || response.type === "opaque") {
          await cache.put(request, response.clone()).catch(error => {
            console.error("تعذر تخزين ملف الخط مؤقتاً:", error);
          });
        }
        return response;
      }).catch(async error => {
        console.error("تعذر تحميل ملف الخط:", error);
        return (await caches.match(request)) || Response.error();
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(async response => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone()).catch(error => {
            console.error("تعذر تحديث نسخة التطبيق المخزنة:", error);
          });
        }
        return response;
      }).catch(async () => {
        return (await caches.match(request)) ||
          (await caches.match(APP_URL)) ||
          Response.error();
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then(async response => {
        if (response.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          await cache.put(request, response.clone()).catch(error => {
            console.error("تعذر تخزين الملف مؤقتاً:", error);
          });
        }
        return response;
      });
    })
  );
});
