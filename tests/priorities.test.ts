import { describe, expect, it } from 'vitest';
import worker, { type Env } from '../worker/index';
import { backupId, decryptData, encryptData } from '../src/lib/backup';
import { addToFreezer, freezerFree, syncFreezerOnStatus } from '../src/lib/freezer';
import { generateWeek, rebalanceWeek } from '../src/lib/planning';
import { recoveryNeeds } from '../src/lib/recovery';
import { addDays, weekDays } from '../src/lib/dates';
import { fresh, MONDAY } from './helpers';
import type { AppData, MealEntry } from '../src/store/types';

describe('sport', () => {
  it('le coaching est ton travail : pas de repas de récupération après', () => {
    const d = fresh(); // coaching mardi, mercredi, vendredi
    expect(recoveryNeeds(d, weekDays(MONDAY))).toEqual([]);
  });

  it('« J’ai fait du sport aujourd’hui » : le dîner devient un repas de récup', () => {
    const d = fresh();
    const r = generateWeek(d, MONDAY);
    d.meals.push(...r.meals);
    const thu = addDays(MONDAY, 3);
    d.sport.sessions.push({ id: 'log', date: thu, time: '16:30', activity: 'velo', durationMin: 60, intensity: 'douce', status: 'faite', notes: 'Notée après coup' });
    rebalanceWeek(d, MONDAY, thu);
    const dinner = d.meals.find((m) => m.date === thu && m.slot === 'dinner')!;
    expect(dinner.recovery).toBe('cardio');
  });
});

describe('congélateur tenu à jour', () => {
  const meal = (p: Partial<MealEntry>): MealEntry => ({ id: 'm', date: '2026-10-22', slot: 'lunch', kind: 'recipe', recipeId: 'chili', portions: 1, source: 'batch', storage: 'freezer', status: 'prévu', ...p });

  it('« mangé » retire une portion, l’annuler la remet', () => {
    const d: AppData = fresh();
    addToFreezer(d, 'chili', 'Chili con carne', 2, '2026-10-18');
    const before = meal({});
    const eaten = { ...before, status: 'mangé' as const };
    syncFreezerOnStatus(d, before, eaten);
    expect(d.freezer[0].portions).toBe(1);
    expect(eaten.tookFromFreezer).toBe(true);
    const back = { ...eaten, status: 'prévu' as const };
    syncFreezerOnStatus(d, eaten, back);
    expect(d.freezer.reduce((s, f) => s + f.portions, 0)).toBe(2);
  });

  it('un repas du frigo ne touche pas au congélateur', () => {
    const d = fresh();
    addToFreezer(d, 'chili', 'Chili con carne', 1, '2026-10-18');
    const before = meal({ storage: 'fridge' });
    syncFreezerOnStatus(d, before, { ...before, status: 'mangé' });
    expect(d.freezer[0].portions).toBe(1);
  });

  it('portions libres = en stock moins celles déjà prévues', () => {
    const d = fresh();
    addToFreezer(d, 'chili', 'Chili con carne', 3, '2026-10-18');
    d.meals = [meal({ source: 'stock', storage: undefined })];
    expect(freezerFree(d, 'chili', '2026-10-21')).toBe(2);
  });
});

describe('sauvegarde chiffrée', () => {
  it('chiffrement : illisible sans le code, identique avec le bon code', async () => {
    const data = { recipes: [{ id: 'x', name: 'Moussaka' }], weights: [{ kg: 70 }] };
    const blob = await encryptData(data, 'mon-code-secret');
    expect(blob).not.toContain('Moussaka');
    expect(await decryptData(blob, 'mon-code-secret')).toEqual(data);
    await expect(decryptData(blob, 'mauvais-code')).rejects.toThrow('Code de sauvegarde incorrect');
    expect(await backupId('mon-code-secret')).toMatch(/^[a-f0-9]{64}$/);
    expect(await backupId('mon-code-secret')).not.toBe(await backupId('autre-code-x'));
  });

  it('serveur : écrire puis relire, code d’accès obligatoire, version précédente gardée', async () => {
    const map = new Map<string, string>();
    const KV = { get: async (k: string, t?: string) => (map.has(k) ? (t === 'json' ? JSON.parse(map.get(k)!) : map.get(k)) : null), put: async (k: string, v: string) => void map.set(k, v), delete: async (k: string) => void map.delete(k) };
    const env = { KV, ASSETS: { fetch: async () => new Response('app') }, ACCESS_CODE: 'secret-code' } as unknown as Env;
    const call = (path: string, body: unknown) => worker.fetch(new Request(`https://x/api/${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }), env);
    const id = await backupId('mon-code-secret');
    expect((await call('backup', { accessCode: 'faux', id, blob: 'QUJD' })).status).toBe(403);
    expect((await call('backup', { accessCode: 'secret-code', id: 'pas-un-id', blob: 'QUJD' })).status).toBe(400);
    expect((await call('restore', { accessCode: 'secret-code', id })).status).toBe(404);
    expect((await call('backup', { accessCode: 'secret-code', id, blob: 'QUJD' })).status).toBe(200);
    expect((await call('backup', { accessCode: 'secret-code', id, blob: 'REVG' })).status).toBe(200);
    const r = await call('restore', { accessCode: 'secret-code', id });
    expect((await r.json()).blob).toBe('REVG');
    expect(JSON.parse(map.get(`bak:${id}:prev`)!).blob).toBe('QUJD');
  });
});
