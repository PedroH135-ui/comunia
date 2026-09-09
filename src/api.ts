export type User = { id: number; name: string; email: string; role: 'member' | 'admin' };
export type Event = {
  id: number;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  location: string;
  capacity: number;
  registered: number;
  price_cents: number;
  theme: string;
  published: boolean;
};
export type Registration = {
  id: number;
  event_id: number;
  title: string;
  starts_at: string;
  location: string;
  theme: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  amount_cents: number;
  ticket: string;
  name?: string;
  email?: string;
};
export type Notice = {
  id: number;
  title: string;
  body: string;
  category: string;
  created_at: string;
};
export type Notification = {
  id: number;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};
export type Message = { id: number; role: 'user' | 'assistant'; content: string; intent?: string };
export type Knowledge = { id: number; title: string; keywords: string; answer: string };
export type Overview = {
  stats: {
    members: number;
    events: number;
    registrations: number;
    revenue: number;
    support: number;
  };
  registrations: Registration[];
  support: { id: number; name: string; email: string; message: string; status: string }[];
  messages: (Message & { name: string })[];
  users: User[];
};
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os dados.');
  return result;
}
export const post = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body || {}) });
export const money = (value: number) =>
  value === 0
    ? 'Gratuito'
    : (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const date = (
  value: string,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' },
) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', ...options });
export const time = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
