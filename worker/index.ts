// Serveur Manges bien ! (Cloudflare Worker) :
// - sert l'application (fichiers statiques de dist/) ;
// - API /api/* pour enregistrer l'abonnement push et la liste des rappels ;
// - tâche planifiée chaque minute qui envoie les rappels arrivés à échéance.
//
// Données stockées (Workers KV) par appareil : l'abonnement push (adresse technique fournie par
// Apple / le navigateur), une empreinte SHA-256 du jeton de l'appareil et la liste des rappels
// (heure + titre + texte) des 21 prochains jours. Aucune donnée de poids, de santé ou de recette complète.
import { sendPush, type PushSubscriptionJSON, type VapidKeys } from './webpush';

export interface Env {
  KV: KVNamespace;
  ASSETS: Fetcher;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  ACCESS_CODE: string;
}

interface StoredReminder {
  id: string;
  at: number;
  title: string;
  body: string;
  url: string;
}

interface Device {
  tokenHash: string;
  subscription: PushSubscriptionJSON;
  reminders: StoredReminder[];
  updatedAt: number;
}

const INDEX = 'index';
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const err = (error: string, status: number) => json({ error }, status);

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const keysOf = (env: Env): VapidKeys => ({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY });

async function readIndex(env: Env): Promise<string[]> {
  return (await env.KV.get<string[]>(INDEX, 'json')) ?? [];
}
async function writeIndex(env: Env, ids: string[]) {
  await env.KV.put(INDEX, JSON.stringify([...new Set(ids)]));
}

function validSubscription(s: unknown): s is PushSubscriptionJSON {
  const x = s as PushSubscriptionJSON;
  return !!x && typeof x.endpoint === 'string' && x.endpoint.startsWith('https://') && typeof x.keys?.p256dh === 'string' && typeof x.keys?.auth === 'string';
}

function cleanReminders(list: unknown, now: number): StoredReminder[] | null {
  if (!Array.isArray(list) || list.length > 2000) return null;
  const out: StoredReminder[] = [];
  for (const r of list) {
    if (!r || typeof r.at !== 'number' || typeof r.title !== 'string' || typeof r.body !== 'string') return null;
    if (r.at < now - 60_000) continue;
    out.push({
      id: String(r.id ?? '').slice(0, 80),
      at: r.at,
      title: r.title.slice(0, 100),
      body: r.body.slice(0, 400),
      url: typeof r.url === 'string' && r.url.startsWith('#/') ? r.url.slice(0, 120) : '#/aujourdhui'
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

async function authDevice(req: Request, env: Env): Promise<{ id: string; device: Device | null; tokenHash: string } | Response> {
  const id = req.headers.get('X-Device') ?? '';
  const token = req.headers.get('X-Token') ?? '';
  if (!/^[a-f0-9]{16}$/.test(id) || !/^[a-f0-9]{32}$/.test(token)) return err('Identifiant d’appareil invalide.', 400);
  const tokenHash = await sha256(token);
  const device = await env.KV.get<Device>(`dev:${id}`, 'json');
  if (device && !safeEqual(device.tokenHash, tokenHash)) return err('Appareil non reconnu.', 403);
  return { id, device, tokenHash };
}

async function handleApi(req: Request, env: Env, path: string): Promise<Response> {
  if (path === '/api/health') return json({ ok: true, configured: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.ACCESS_CODE && env.VAPID_SUBJECT) });
  if (path === '/api/vapid-public-key') {
    if (!env.VAPID_PUBLIC_KEY) return err('Serveur non configuré (clé VAPID manquante).', 500);
    return json({ key: env.VAPID_PUBLIC_KEY });
  }
  if (req.method !== 'POST') return err('Méthode non autorisée', 405);
  if (Number(req.headers.get('Content-Length') ?? 0) > 512_000) return err('Requête trop volumineuse', 413);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err('JSON invalide', 400);
  }
  const auth = await authDevice(req, env);
  if (auth instanceof Response) return auth;
  const { id, tokenHash } = auth;
  let device = auth.device;
  const now = Date.now();

  switch (path) {
    case '/api/subscribe': {
      if (!env.ACCESS_CODE) return err('Serveur non configuré (ACCESS_CODE manquant).', 500);
      if (typeof body.accessCode !== 'string' || !safeEqual(body.accessCode, env.ACCESS_CODE)) return err('Code d’accès incorrect.', 403);
      if (!validSubscription(body.subscription)) return err('Abonnement push invalide.', 400);
      device = { tokenHash, subscription: body.subscription, reminders: device?.reminders ?? [], updatedAt: now };
      await env.KV.put(`dev:${id}`, JSON.stringify(device));
      await writeIndex(env, [...(await readIndex(env)), id]);
      return json({ ok: true });
    }
    case '/api/schedule': {
      if (!device) return err('Appareil non abonné.', 404);
      const reminders = cleanReminders(body.reminders, now);
      if (!reminders) return err('Liste de rappels invalide.', 400);
      // On conserve les tests programmés en attente.
      const tests = device.reminders.filter((r) => r.id.startsWith('test:') && r.at > now);
      device.reminders = [...reminders, ...tests].sort((a, b) => a.at - b.at);
      device.updatedAt = now;
      await env.KV.put(`dev:${id}`, JSON.stringify(device));
      return json({ ok: true, count: reminders.length });
    }
    case '/api/test': {
      if (!device) return err('Appareil non abonné.', 404);
      const delay = Math.min(600, Math.max(0, Number(body.delaySec) || 0));
      const msg = { title: 'Manges bien ! — test', body: delay ? `Notification programmée ${Math.round(delay / 60)} min plus tôt : le serveur fonctionne même app fermée.` : 'Les notifications fonctionnent 🎉', url: '#/reglages/notifications', tag: 'test' };
      if (!delay) {
        const r = await sendPush(device.subscription, msg, keysOf(env), env.VAPID_SUBJECT);
        if (r.gone) {
          await removeDevice(env, id);
          return err('Abonnement expiré : réactive les notifications.', 410);
        }
        if (r.status >= 300) return err(`Le service push a refusé l’envoi (${r.status}). ${r.text ?? ''}`, 502);
        return json({ ok: true, status: r.status });
      }
      device.reminders.push({ id: `test:${now}`, at: now + delay * 1000, title: msg.title, body: msg.body, url: msg.url });
      device.reminders.sort((a, b) => a.at - b.at);
      await env.KV.put(`dev:${id}`, JSON.stringify(device));
      return json({ ok: true, at: now + delay * 1000 });
    }
    case '/api/unsubscribe': {
      await removeDevice(env, id);
      return json({ ok: true });
    }
  }
  return err('Introuvable', 404);
}

async function removeDevice(env: Env, id: string) {
  await env.KV.delete(`dev:${id}`);
  await writeIndex(env, (await readIndex(env)).filter((x) => x !== id));
}

/** Envoie les rappels dont l'heure tombe dans la minute écoulée ]t-60 s ; t]. Aucune écriture KV en temps normal. */
export async function runDue(env: Env, scheduledTime: number): Promise<{ sent: number; failed: number }> {
  const windowStart = scheduledTime - 60_000;
  let sent = 0;
  let failed = 0;
  for (const id of await readIndex(env)) {
    const device = await env.KV.get<Device>(`dev:${id}`, 'json');
    if (!device) continue;
    const due = device.reminders.filter((r) => r.at > windowStart && r.at <= scheduledTime);
    for (const r of due) {
      try {
        const res = await sendPush(device.subscription, { title: r.title, body: r.body, url: r.url, tag: r.id }, keysOf(env), env.VAPID_SUBJECT);
        if (res.gone) {
          await removeDevice(env, id);
          break;
        }
        if (res.status >= 300) {
          failed++;
          console.warn('push refusé', res.status, res.text);
        } else sent++;
      } catch (e) {
        failed++;
        console.error('push erreur', e);
      }
    }
  }
  return { sent, failed };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(req, env, url.pathname);
      } catch (e) {
        console.error(e);
        return err('Erreur interne du serveur.', 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDue(env, event.scheduledTime).then((r) => (r.sent || r.failed ? console.log('rappels', r) : undefined)));
  }
} satisfies ExportedHandler<Env>;
