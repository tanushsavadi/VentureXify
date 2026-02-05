// Service Worker - Empty placeholder to prevent 404 errors
// This is a no-op service worker that simply responds to install/activate events

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// No-op fetch handler - let requests pass through normally
self.addEventListener('fetch', (event) => {
  // Don't intercept any requests, let them pass through to network
  return;
});
