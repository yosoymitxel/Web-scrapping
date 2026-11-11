// Avisos push del panel: muestra la notificación y abre la pestaña que corresponde.
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'Panel', {
    body: d.body || '', tag: d.tag, data: { url: d.url || './' }, icon: 'icon.svg', badge: 'icon.svg',
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(ws => {
    const w = ws.find(w => w.url.startsWith(self.registration.scope));
    return w ? w.navigate(url).then(w => w.focus()) : clients.openWindow(url);
  }));
});
