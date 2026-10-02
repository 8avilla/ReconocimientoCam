// Service worker de Super Torneos: hace la app instalable y deja abrir los partidos ya visitados sin conexión.
//
// - Archivos estáticos (/_next/static, iconos, imágenes optimizadas): primero la caché.
// - Páginas y datos de la API (solo GET): primero la red; si falla o tarda, lo último guardado.
// - Nada de escrituras (POST/PATCH/DELETE) ni de /api/auth, salvo la sesión: los cambios hechos sin
//   conexión los guarda la propia app en una cola y los envía al volver (ver src/lib/client/outbox.ts).
// - Al cerrar sesión la app manda "clear-caches": no debe quedar nada de una persona en el dispositivo.

const VERSION = "v1";
const STATIC = `st-static-${VERSION}`;
const IMAGES = `st-images-${VERSION}`;
const PAGES = `st-pages-${VERSION}`;
const RSC = `st-rsc-${VERSION}`; // cargas internas de Next entre pantallas (no son HTML)
const API = `st-api-${VERSION}`;
const ALL = [STATIC, IMAGES, PAGES, RSC, API];
const LIMITS = { [IMAGES]: 300, [PAGES]: 60, [RSC]: 120, [API]: 250 };
const NETWORK_TIMEOUT_MS = 4000;

// Datos que nunca se guardan: cuentas, auditoría, uso y ajustes del sistema.
const API_DENY = [/^\/api\/auth\/(?!session$)/, /^\/api\/users/, /^\/api\/audit-logs/, /^\/api\/usage/, /^\/api\/system-settings/, /^\/api\/roles/];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("st-") && !ALL.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear-caches") event.waitUntil(Promise.all(ALL.map((name) => caches.delete(name))));
});

// Avisos (Web Push): el servidor manda { title, body, url, tag }; al tocarlo se abre esa pantalla.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Mensaje sin formato: se muestra con el título por defecto.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Super Torneos", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        await client.focus();
        if ("navigate" in client) await client.navigate(url).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || /^\/icon-.*\.png$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC));
  } else if (url.pathname.startsWith("/_next/image")) {
    event.respondWith(cacheFirst(request, IMAGES));
  } else if (url.pathname.startsWith("/api/")) {
    if (API_DENY.some((pattern) => pattern.test(url.pathname))) return;
    event.respondWith(networkFirst(request, API));
  } else if (request.headers.get("RSC") === "1") {
    event.respondWith(networkFirst(request, RSC));
  } else if (isDocument(request)) {
    event.respondWith(networkFirst(request, PAGES, true));
  }
});

// Un documento HTML (también el que pide la app con fetch para dejarlo guardado).
function isDocument(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

function cacheable(response) {
  // Una respuesta con redirección no se puede devolver a una navegación, así que tampoco se guarda.
  return response && response.ok && response.type === "basic" && !response.redirected;
}

function store(cache, name, request, response) {
  // Un fallo al guardar (disco lleno, cabecera Vary: *) no debe afectar a la respuesta que ya se entregó.
  cache.put(request, response.clone()).then(() => trim(cache, name)).catch(() => undefined);
}

async function trim(cache, name) {
  const keys = await cache.keys();
  const extra = keys.length - (LIMITS[name] || 100);
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) store(cache, name, request, response);
  return response;
}

async function networkFirst(request, name, asDocument = false) {
  const cache = await caches.open(name);
  const network = fetch(request).then((response) => {
    if (cacheable(response)) store(cache, name, request, response);
    return response;
  });
  network.catch(() => undefined);
  try {
    return await Promise.race([network, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS))]);
  } catch {
    // Un documento es el mismo caparazón con cualquier «?...»: si no está con esa dirección exacta, sirve el de la misma ruta.
    const hit = (await cache.match(request, { ignoreVary: true })) || (asDocument ? await cache.match(request, { ignoreVary: true, ignoreSearch: true }) : undefined);
    if (hit) return hit;
    try {
      // Nada guardado: esperar la red de verdad (puede tardar) en lugar de fallar de entrada.
      return await network;
    } catch (error) {
      if (asDocument && request.mode === "navigate") return offlinePage();
      throw error;
    }
  }
}

function offlinePage() {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión | Super Torneos</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;text-align:center;padding:24px}
h1{font-size:22px;margin:0 0 8px}p{color:#64748b;margin:0 0 16px}button{border:0;border-radius:10px;background:#16a34a;color:#fff;font-weight:700;padding:12px 20px;font-size:15px}</style></head>
<body><div><h1>Sin conexión</h1><p>Esta pantalla no está guardada en tu dispositivo. Abre el partido con conexión y usa «Guardar para usar sin conexión».</p><button onclick="location.reload()">Reintentar</button></div></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
