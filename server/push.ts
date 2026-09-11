import webpush from 'web-push';
import { prisma } from './db.js';

export function pushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
  );
}

export function pushPublicConfig() {
  return { enabled: pushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY || null };
}

function configure() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export async function sendPushToUsers(
  userIds: number[] | undefined,
  notification: { title: string; body: string; url?: string; tag?: string },
) {
  let sent = 0;
  const expired: number[] = [];
  try {
    if (!pushConfigured()) return { sent, removed: 0 };
    configure();
    const subscriptions = await prisma.push_subscriptions.findMany({
      where: userIds ? { user_id: { in: [...new Set(userIds)] } } : undefined,
    });
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify({
              title: notification.title.slice(0, 120),
              body: notification.body.slice(0, 300),
              url: notification.url || '/?v=notifications',
              tag: notification.tag || 'comunia-update',
            }),
            { TTL: 60 * 60 * 24, timeout: 8_000 },
          );
          sent += 1;
        } catch (error: any) {
          if (error?.statusCode === 404 || error?.statusCode === 410) expired.push(subscription.id);
        }
      }),
    );
    if (expired.length)
      await prisma.push_subscriptions.deleteMany({ where: { id: { in: expired } } });
    return { sent, removed: expired.length };
  } catch {
    return { sent, removed: expired.length };
  }
}
