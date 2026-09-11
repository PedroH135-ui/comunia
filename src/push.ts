import { api, post } from './api';

export type PushState =
  'loading' | 'unsupported' | 'unavailable' | 'denied' | 'disabled' | 'enabled';

type PushConfig = { enabled: boolean; publicKey: string | null };

function supported() {
  return (
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
}

export async function readPushState(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const config = await api<PushConfig>('/push/config');
  if (!config.enabled || !config.publicKey) return 'unavailable';
  if (Notification.permission === 'denied') return 'denied';
  const subscription = await (await registration()).pushManager.getSubscription();
  return subscription ? 'enabled' : 'disabled';
}

export async function enablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const config = await api<PushConfig>('/push/config');
  if (!config.enabled || !config.publicKey) return 'unavailable';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'disabled';
  const worker = await registration();
  const current = await worker.pushManager.getSubscription();
  const subscription =
    current ||
    (await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(config.publicKey),
    }));
  await post('/push/subscriptions', subscription.toJSON());
  return 'enabled';
}

export async function disablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const subscription = await (await registration()).pushManager.getSubscription();
  if (subscription) {
    await api('/push/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }
  return 'disabled';
}
