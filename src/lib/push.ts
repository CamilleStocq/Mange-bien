// Notifications côté client : permission, abonnement Web Push, synchronisation des rappels
// avec le serveur, et rappels locaux de secours quand l'application est ouverte.
import { getData, mutate, useApp } from '../store/store';
import { buildReminders, type Reminder } from './reminders';
import { addDays, todayISO } from './dates';

export const HORIZON_DAYS = 21;

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export interface Capabilities {
  notifications: boolean;
  serviceWorker: boolean;
  push: boolean;
  permission: NotificationPermission | 'unsupported';
  standalone: boolean;
  ios: boolean;
}

export function capabilities(): Capabilities {
  const notifications = 'Notification' in window;
  return {
    notifications,
    serviceWorker: 'serviceWorker' in navigator,
    push: 'PushManager' in window,
    permission: notifications ? Notification.permission : 'unsupported',
    standalone: isStandalone(),
    ios: isIOS()
  };
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  return (await navigator.serviceWorker.getRegistration()) ?? undefined;
}

/** Notification locale immédiate (via le service worker si possible). */
export async function showLocal(title: string, body: string, url = '#/aujourdhui'): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') throw new Error('Les notifications ne sont pas autorisées.');
  const reg = await registration();
  const opts: NotificationOptions = { body, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { url }, tag: `local-${Date.now()}` };
  if (reg) await reg.showNotification(title, opts);
  else new Notification(title, opts);
}

function b64urlToUint8(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function api(path: string, body: unknown): Promise<Response> {
  const { deviceId, token } = getData().push;
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device': deviceId, 'X-Token': token },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let msg = `Erreur serveur (${res.status})`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {
      /* corps non JSON */
    }
    throw new Error(msg);
  }
  return res;
}

export async function serverAvailable(): Promise<boolean> {
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

/** Abonnement Web Push. Le code d'accès est demandé une seule fois et n'est pas stocké. */
export async function subscribePush(accessCode: string): Promise<void> {
  const perm = await requestPermission();
  if (perm !== 'granted') throw new Error('Permission de notification refusée. Tu peux la réactiver dans Réglages iPhone → Notifications → Manges bien !.');
  const reg = await registration();
  if (!reg || !('pushManager' in reg)) throw new Error('Notifications push indisponibles ici. Sur iPhone : ajoute d’abord l’app à l’écran d’accueil (iOS 16.4 ou plus).');
  const keyRes = await fetch('/api/vapid-public-key');
  if (!keyRes.ok) throw new Error('Serveur de notifications injoignable.');
  const { key } = await keyRes.json();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToUint8(key) });
  await api('subscribe', { accessCode, subscription: sub.toJSON() });
  mutate((d) => {
    d.push.subscribed = true;
    d.push.lastError = undefined;
  });
  await syncReminders();
}

export async function unsubscribePush(): Promise<void> {
  try {
    await api('unsubscribe', {});
  } catch {
    /* le serveur a peut-être déjà oublié l'appareil */
  }
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
  mutate((d) => {
    d.push.subscribed = false;
  });
}

export function upcomingReminders(days = HORIZON_DAYS): Reminder[] {
  return buildReminders(getData(), todayISO(), days);
}

/** Envoie au serveur la liste des rappels des 21 prochains jours (remplace la précédente). */
export async function syncReminders(): Promise<number> {
  const data = getData();
  if (!data.push.subscribed) return 0;
  const reminders = upcomingReminders().map((r) => ({ id: r.id, at: r.at, title: r.title, body: r.body, url: r.url }));
  try {
    await api('schedule', { reminders });
    mutate((d) => {
      d.push.lastSync = new Date().toISOString();
      d.push.syncedUntil = addDays(todayISO(), HORIZON_DAYS - 1);
      d.push.lastError = undefined;
    });
    return reminders.length;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mutate((d) => {
      d.push.lastError = msg;
    });
    throw e;
  }
}

export async function sendServerTest(delaySec: number): Promise<void> {
  await api('test', { delaySec });
}

// Synchronisation automatique après chaque modification (avec délai) et à l'ouverture.
// On ne renvoie la liste au serveur que si les rappels calculés ont réellement changé.
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let lastSent = '';
function signature(): string {
  return JSON.stringify(upcomingReminders().map((r) => [r.id, r.at, r.body]));
}
async function syncIfChanged(force = false) {
  if (!getData().push.subscribed) return;
  const sig = signature();
  if (!force && sig === lastSent) return;
  try {
    await syncReminders();
    lastSent = sig;
  } catch {
    /* erreur affichée dans les réglages */
  }
}
export function startAutoSync() {
  useApp.subscribe((s, prev) => {
    if (s.data === prev.data || !s.data.push.subscribed) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => void syncIfChanged(), 4000);
  });
  void syncIfChanged(true);
  document.addEventListener('visibilitychange', () => {
    // À chaque ouverture : on prolonge l'horizon de 21 jours si nécessaire.
    if (document.visibilityState === 'visible') void syncIfChanged(getData().push.syncedUntil !== addDays(todayISO(), HORIZON_DAYS - 1));
  });
  startLocalFallback();
}

// Rappels locaux : uniquement quand le push n'est pas actif, et seulement pendant que l'app est ouverte.
let localTimers: ReturnType<typeof setTimeout>[] = [];
function startLocalFallback() {
  const schedule = () => {
    localTimers.forEach(clearTimeout);
    localTimers = [];
    const d = getData();
    if (d.push.subscribed || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = Date.now();
    for (const r of buildReminders(d, todayISO(), 2, now)) {
      const delay = r.at - now;
      if (delay > 0 && delay < 36 * 3600_000) localTimers.push(setTimeout(() => void showLocal(r.title, r.body, r.url).catch(() => undefined), delay));
    }
  };
  schedule();
  useApp.subscribe((s, p) => {
    if (s.data !== p.data) schedule();
  });
}
