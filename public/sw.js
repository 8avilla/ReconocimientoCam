// Service worker mínimo: hace la app instalable (PWA/TWA).
// No cachea nada a propósito: la sesión (NextAuth) y los datos deben ir siempre a la red.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
