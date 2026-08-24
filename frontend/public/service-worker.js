// Service worker mínimo, sin caché: solo existe para que el navegador
// considere la app "instalable" (Agregar a inicio). No implementa modo sin
// conexión — cada request sigue yendo a la red, igual que sin esto.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
