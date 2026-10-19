/// <reference lib="webworker" />
// Service worker : cache hors ligne de l'application + réception des notifications push.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// Toute navigation renvoie l'application en cache (fonctionnement hors ligne).
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }));

self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  let p: PushPayload = {};
  try {
    p = event.data?.json() ?? {};
  } catch {
    p = { body: event.data?.text() };
  }
  // iOS exige qu'une notification soit toujours affichée pour chaque push reçu.
  event.waitUntil(
    self.registration.showNotification(p.title || 'Manges bien !', {
      body: p.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/badge-96.png',
      tag: p.tag,
      data: { url: p.url || '#/aujourdhui' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hash = (event.notification.data?.url as string) || '#/aujourdhui';
  const target = new URL(self.registration.scope);
  target.hash = hash.replace(/^#/, '');
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          await (c as WindowClient).focus();
          await (c as WindowClient).navigate(target.href).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })()
  );
});
