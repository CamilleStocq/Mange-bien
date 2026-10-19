// Web Push sans dépendance, uniquement avec WebCrypto (fonctionne dans Cloudflare Workers et Node ≥ 20).
// - Authentification VAPID (RFC 8292) : JWT ES256.
// - Chiffrement du contenu « aes128gcm » (RFC 8291 + RFC 8188).

const encoder = new TextEncoder();
const enc = { encode: (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(encoder.encode(s)) };

export function b64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((s, p) => s + p.length, 0)));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export interface VapidKeys {
  /** Clé publique non compressée (65 octets, 0x04‖x‖y), base64url */
  publicKey: string;
  /** Scalaire privé d (32 octets), base64url — SECRET, uniquement côté serveur */
  privateKey: string;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

async function importVapidKey(keys: VapidKeys): Promise<CryptoKey> {
  const pub = fromB64url(keys.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY invalide');
  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), d: keys.privateKey, ext: true };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

export async function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud, exp: nowSec + 12 * 3600, sub: subject })));
  const key = await importVapidKey(keys);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${keys.publicKey}`;
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** Chiffre un message pour un abonnement (RFC 8291). Un seul enregistrement, rs = 4096. */
export async function encryptPayload(payload: Uint8Array<ArrayBuffer>, sub: PushSubscriptionJSON): Promise<Uint8Array<ArrayBuffer>> {
  if (payload.length > 3000) throw new Error('Message trop long');
  const uaPublic = fromB64url(sub.keys.p256dh);
  const authSecret = fromB64url(sub.keys.auth);
  const asKeys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', asKeys.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as unknown as Parameters<SubtleCrypto['deriveBits']>[0], asKeys.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concat(payload, new Uint8Array([2]))));

  const header = new Uint8Array(new ArrayBuffer(16 + 4 + 1 + asPublic.length));
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

export interface SendResult {
  status: number;
  /** L'abonnement n'existe plus (désinstallation, permission retirée) : à supprimer */
  gone: boolean;
  text?: string;
}

export async function sendPush(sub: PushSubscriptionJSON, message: object, keys: VapidKeys, subject: string, ttlSec = 3600): Promise<SendResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, keys, subject),
      TTL: String(ttlSec),
      Urgency: 'normal',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream'
    },
    body
  });
  const gone = res.status === 404 || res.status === 410;
  return { status: res.status, gone, text: res.ok ? undefined : (await res.text()).slice(0, 300) };
}
