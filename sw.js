const V = '20261011030716';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(V);
  await c.addAll(SHELL.concat(['data/index.json']));
  try {
    const idx = await (await c.match('data/index.json')).json();
    const files = idx.asignaturas.flatMap(s => s.temas.map(t => t.file));
    await c.addAll(files);
    try { await c.add('data/examenes.json'); } catch (_) {}
  } catch (_) {}
  self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
  self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const c = await caches.open(V);
    try {
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    } catch (_) {
      return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('index.html'));
    }
  })());
});
