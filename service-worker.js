const CURURU_CACHE_VERSION = 'cururu-pwa-cleanup-v10-20260521';

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith('cururu-'))
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
            .then(() => self.registration.unregister())
    );
});

self.addEventListener('fetch', () => {
    // Cleanup worker: do not intercept or cache any request.
});
