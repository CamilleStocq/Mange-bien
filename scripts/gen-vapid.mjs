// Génère une paire de clés VAPID (P-256) pour les notifications push.
// Usage : npm run vapid
import { webcrypto as crypto } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
const jwk = await crypto.subtle.exportKey('jwk', privateKey);

console.log('Clés VAPID générées. La clé privée est SECRÈTE : ne la mets jamais dans le code de l’application.\n');
console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
