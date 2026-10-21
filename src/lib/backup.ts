import { get, set } from 'idb-keyval';
import type { AppData } from '../store/types';
import { getData, useApp } from '../store/store';
import { migrate } from '../data/defaults';

/**
 * Sauvegarde automatique, chiffrée sur ton téléphone avant l'envoi :
 * - le serveur (ton Cloudflare) ne reçoit qu'un bloc illisible sans ton code de sauvegarde ;
 * - l'emplacement de la sauvegarde est dérivé du code : le même code retrouve la sauvegarde sur un autre téléphone ;
 * - le code d'accès du serveur (celui des rappels) empêche quiconque d'autre d'écrire ou de lire ;
 * - les photos de recettes restent sur l'appareil (trop lourdes).
 */

const CONF_KEY = 'mangebien:backup';
const SALT = new TextEncoder().encode('mange-bien:backup:v1');
const MIN_GAP_MS = 10 * 60_000;

export interface BackupConf {
  code: string;
  accessCode: string;
  lastAt?: number;
  lastError?: string;
}

export const getBackupConf = () => get<BackupConf>(CONF_KEY);
const saveConf = (c: BackupConf) => set(CONF_KEY, c);

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const backupId = (code: string) => sha256hex(`mange-bien:backup-id:${code.trim()}`);

async function keyFor(code: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code.trim()), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: SALT, iterations: 210_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const toB64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function encryptData(data: unknown, code: string): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(code), packed as BufferSource));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return toB64(out);
}

export async function decryptData(blob: string, code: string): Promise<unknown> {
  const bytes = fromB64(blob);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, await keyFor(code), bytes.subarray(12));
  } catch {
    throw new Error('Code de sauvegarde incorrect.');
  }
  const json = await pipe(new Uint8Array(plain), new DecompressionStream('gzip'));
  return JSON.parse(new TextDecoder().decode(json));
}

async function call(path: 'backup' | 'restore', body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j: Record<string, unknown> = {};
  try {
    j = await res.json();
  } catch {
    /* corps non JSON */
  }
  if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Le serveur de sauvegarde n’a pas répondu. Réessaie dans un moment.');
  return j;
}

/** Données sauvegardées : tout, sauf l'identité de l'appareil pour les rappels (propre à chaque téléphone). */
function snapshot(d: AppData) {
  const { push: _push, ...rest } = d;
  return rest;
}

export async function backupNow(conf?: BackupConf): Promise<number> {
  const c = conf ?? (await getBackupConf());
  if (!c) throw new Error('Sauvegarde automatique non activée.');
  try {
    await call('backup', { accessCode: c.accessCode, id: await backupId(c.code), blob: await encryptData(snapshot(getData()), c.code) });
    const lastAt = Date.now();
    await saveConf({ ...c, lastAt, lastError: undefined });
    return lastAt;
  } catch (e) {
    await saveConf({ ...c, lastError: (e as Error).message });
    throw e;
  }
}

export async function enableBackup(code: string, accessCode: string): Promise<number> {
  if (code.trim().length < 8) throw new Error('Choisis un code de sauvegarde d’au moins 8 caractères.');
  return backupNow({ code: code.trim(), accessCode: accessCode.trim() });
}

/** Restaure la dernière sauvegarde : remplace les données de cet appareil (les rappels de ce téléphone sont gardés). */
export async function restoreBackup(code: string, accessCode: string): Promise<{ savedAt: number }> {
  const r = await call('restore', { accessCode: accessCode.trim(), id: await backupId(code) });
  const raw = (await decryptData(String(r.blob), code)) as Partial<AppData>;
  const current = getData();
  const restored = migrate({ ...raw, push: current.push });
  useApp.getState().replaceAll(restored);
  await saveConf({ code: code.trim(), accessCode: accessCode.trim(), lastAt: Number(r.savedAt) || Date.now() });
  return { savedAt: Number(r.savedAt) || 0 };
}

/** Sauvegarde automatique : après un changement (au plus toutes les 10 min) et quand l'app passe en arrière-plan. */
export function startAutoBackup(): void {
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async (force = false) => {
    const c = await getBackupConf();
    if (!c || !dirty || !navigator.onLine) return;
    if (!force && c.lastAt && Date.now() - c.lastAt < MIN_GAP_MS) return;
    dirty = false;
    try {
      await backupNow(c);
    } catch {
      dirty = true; // nouvel essai plus tard
    }
  };
  useApp.subscribe((s, prev) => {
    if (s.data === prev.data || !s.hydrated) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), 60_000);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void run(true);
  });
}
