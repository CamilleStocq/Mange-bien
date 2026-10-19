import { describe, expect, it, vi, afterEach } from 'vitest';
import { createECDH, createPublicKey, randomBytes, verify } from 'node:crypto';
// @ts-expect-error — bibliothèque de référence (utilisée par le paquet web-push), sans types
import ece from 'http_ece';
import { b64url, encryptPayload, fromB64url, vapidAuthorization } from '../worker/webpush';
import worker, { runDue, type Env } from '../worker/index';

function fakeSubscription() {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = randomBytes(16);
  return { ua, auth, sub: { endpoint: 'https://push.example.test/abc', keys: { p256dh: b64url(ua.getPublicKey()), auth: b64url(auth) } } };
}

async function vapidKeys() {
  const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])) as CryptoKeyPair;
  const raw = new Uint8Array((await crypto.subtle.exportKey('raw', kp.publicKey)) as ArrayBuffer);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { publicKey: b64url(raw), privateKey: jwk.d! };
}

describe('Web Push (RFC 8291 / 8292)', () => {
  it('chiffre un message déchiffrable par l’implémentation de référence http_ece', async () => {
    const { ua, auth, sub } = fakeSubscription();
    const msg = JSON.stringify({ title: 'Ce soir', body: 'Pâtes bolognaise — 80 g de pâtes sèches 🍝' });
    const body = await encryptPayload(new TextEncoder().encode(msg) as Uint8Array<ArrayBuffer>, sub);
    const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ua, authSecret: auth });
    expect(plain.toString('utf8')).toBe(msg);
  });

  it('produit un JWT VAPID ES256 valide pour l’origine du service push', async () => {
    const keys = await vapidKeys();
    const header = await vapidAuthorization('https://web.push.apple.com/QGuQyavXutnMH', keys, 'mailto:test@exemple.be', 1_800_000_000);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!;
    expect(m[4]).toBe(keys.publicKey);
    const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
    expect(claims).toEqual({ aud: 'https://web.push.apple.com', exp: 1_800_000_000 + 12 * 3600, sub: 'mailto:test@exemple.be' });
    const pub = fromB64url(keys.publicKey);
    const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33)) }, format: 'jwk' });
    const ok = verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url'));
    expect(ok).toBe(true);
  });
});

// ---------- Serveur : KV simulé + service push simulé ----------
class MemKV {
  map = new Map<string, string>();
  async get(k: string, type?: string) {
    const v = this.map.get(k);
    return v == null ? null : type === 'json' ? JSON.parse(v) : v;
  }
  async put(k: string, v: string) {
    this.map.set(k, v);
  }
  async delete(k: string) {
    this.map.delete(k);
  }
}

async function makeEnv(): Promise<Env & { KV: MemKV }> {
  const keys = await vapidKeys();
  return { KV: new MemKV() as never, ASSETS: { fetch: async () => new Response('app') } as never, VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'mailto:test@exemple.be', ACCESS_CODE: 'secret-code' } as Env & { KV: MemKV };
}
const DEV = { 'X-Device': '0123456789abcdef', 'X-Token': '0123456789abcdef0123456789abcdef', 'Content-Type': 'application/json' };
const call = (env: Env, path: string, body?: unknown, headers: Record<string, string> = DEV) =>
  worker.fetch(new Request(`https://manges-bien.test${path}`, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }), env);

describe('serveur de rappels', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuse un mauvais code d’accès et un appareil inconnu', async () => {
    const env = await makeEnv();
    const { sub } = fakeSubscription();
    expect((await call(env, '/api/subscribe', { accessCode: 'faux', subscription: sub })).status).toBe(403);
    expect((await call(env, '/api/schedule', { reminders: [] })).status).toBe(404);
    expect((await call(env, '/api/schedule', { reminders: [] }, { ...DEV, 'X-Token': 'x' })).status).toBe(400);
  });

  it('abonne, enregistre les rappels et envoie seulement ceux de la minute écoulée', async () => {
    const env = await makeEnv();
    const { ua, auth, sub } = fakeSubscription();
    expect((await call(env, '/api/subscribe', { accessCode: 'secret-code', subscription: sub })).status).toBe(200);
    // Un autre appareil ne peut pas écraser celui-ci sans son jeton
    expect((await call(env, '/api/schedule', { reminders: [] }, { ...DEV, 'X-Token': 'ffffffffffffffffffffffffffffffff' })).status).toBe(403);

    const T = Date.parse('2030-01-07T17:00:00Z');
    vi.setSystemTime(T - 3600_000);
    const reminders = [
      { id: 'a', at: T - 60_000, title: 'trop tôt', body: 'x', url: '#/aujourdhui' },
      { id: 'b', at: T, title: 'Ce soir', body: 'Chili con carne', url: '#/aujourdhui' },
      { id: 'c', at: T + 60_000, title: 'plus tard', body: 'x', url: '#/aujourdhui' }
    ];
    const res = await call(env, '/api/schedule', { reminders });
    expect(await res.json()).toEqual({ ok: true, count: 3 });
    vi.useRealTimers();

    const sent: { url: string; headers: Headers; body: Uint8Array }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      sent.push({ url, headers: new Headers(init.headers), body: init.body as Uint8Array });
      return new Response(null, { status: 201 });
    });
    const r = await runDue(env, T);
    expect(r).toEqual({ sent: 1, failed: 0 });
    expect(sent[0].url).toBe(sub.endpoint);
    expect(sent[0].headers.get('Content-Encoding')).toBe('aes128gcm');
    expect(sent[0].headers.get('Authorization')).toMatch(/^vapid t=/);
    const payload = JSON.parse(ece.decrypt(Buffer.from(sent[0].body), { version: 'aes128gcm', privateKey: ua, authSecret: auth }).toString());
    expect(payload).toEqual({ title: 'Ce soir', body: 'Chili con carne', url: '#/aujourdhui', tag: 'b' });
  });

  it('supprime l’appareil si le service push répond 410 (abonnement expiré)', async () => {
    const env = await makeEnv();
    const { sub } = fakeSubscription();
    await call(env, '/api/subscribe', { accessCode: 'secret-code', subscription: sub });
    const T = Date.now() + 120_000;
    await call(env, '/api/schedule', { reminders: [{ id: 'x', at: T, title: 't', body: 'b', url: '#/aujourdhui' }] });
    vi.stubGlobal('fetch', async () => new Response('gone', { status: 410 }));
    await runDue(env, T);
    expect(env.KV.map.has('dev:0123456789abcdef')).toBe(false);
    expect(JSON.parse(env.KV.map.get('index')!)).toEqual([]);
  });

  it('expose la clé publique et sert l’application pour les autres chemins', async () => {
    const env = await makeEnv();
    expect(await (await call(env, '/api/vapid-public-key')).json()).toEqual({ key: env.VAPID_PUBLIC_KEY });
    expect(await (await call(env, '/api/health')).json()).toEqual({ ok: true, configured: true });
    expect(await (await call(env, '/')).text()).toBe('app');
  });
});
