self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = {};
  }
  event.waitUntil(
    self.registration.showNotification(message.title || 'ComunIA', {
      body: message.body || 'Há uma novidade na comunidade.',
      tag: message.tag || 'comunia-update',
      data: { url: message.url || '/?v=notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/?v=notifications', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => client.url.startsWith(self.location.origin));
      if (open) {
        open.navigate(target);
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
