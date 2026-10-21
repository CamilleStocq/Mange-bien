import { describe, expect, it } from 'vitest';
import { generateWeek, rebalanceWeek } from '../src/lib/planning';
import { GOOD_RECOVERY, recoveryScore } from '../src/lib/recovery';
import { addDays } from '../src/lib/dates';
import { fresh, MONDAY } from './helpers';
import type { AppData, SportSession } from '../src/store/types';

const TODAY = '2026-10-17'; // avant le batch du dimanche 18
function week(): AppData {
  const d = fresh(); // coaching mar, mer, ven ; on cuisine lun, jeu, dim
  const r = generateWeek(d, MONDAY);
  d.meals.push(...r.meals);
  d.rotation = r.rotation;
  return d;
}
const at = (d: AppData, i: number, slot: string) => d.meals.find((m) => m.date === addDays(MONDAY, i) && m.slot === slot && m.status === 'prévu')!;
const run = (d: AppData) => rebalanceWeek(d, MONDAY, TODAY);

describe('recalcul après un changement', () => {
  it('un midi de semaine « à cuisiner » (ancienne semaine) redevient une portion prête', () => {
    const d = week();
    const wed = at(d, 2, 'lunch');
    Object.assign(wed, { source: 'fresh', recipeId: 'colin-gratin', storage: undefined, leftoverOf: undefined });
    run(d);
    expect(wed.source).toBe('batch');
    expect(wed.storage).toBeTruthy();
  });

  it('sans changement, le recalcul ne modifie rien', () => {
    const d = week();
    const before = JSON.stringify(d.meals);
    run(d);
    expect(JSON.stringify(d.meals)).toBe(before);
  });

  it('le plat du soir change → la portion gardée du lendemain midi suit', () => {
    const d = week();
    const dinner = at(d, 0, 'dinner');
    const lunch = d.meals.find((m) => m.leftoverOf === dinner.id)!;
    const other = d.recipes.find((r) => r.quick && r.servings >= 2 && r.fridgeDays >= 1 && r.id !== dinner.recipeId)!;
    dinner.recipeId = other.id;
    run(d);
    expect(lunch.recipeId).toBe(other.id);
    expect(lunch.source).toBe('leftover');
    expect(dinner.portions).toBe(2);
  });

  it('le dîner est annulé → le midi reçoit une portion du batch (toujours un repas prêt)', () => {
    const d = week();
    const dinner = at(d, 0, 'dinner');
    const lunch = d.meals.find((m) => m.leftoverOf === dinner.id)!;
    dinner.status = 'remplacé';
    run(d);
    expect(lunch.source).toBe('batch');
    expect(lunch.leftoverOf).toBeUndefined();
  });

  it('les restes choisis à la main sont détachés : le dîner repasse à 1 portion', () => {
    const d = week();
    const dinner = at(d, 0, 'dinner');
    const lunch = d.meals.find((m) => m.leftoverOf === dinner.id)!;
    Object.assign(lunch, { recipeId: 'salade-cesar', source: 'fresh', pinned: true, leftoverOf: undefined });
    run(d);
    expect(dinner.portions).toBe(1);
    expect(dinner.note ?? '').not.toMatch(/2 portions/);
    expect(lunch.recipeId).toBe('salade-cesar');
  });

  it('une séance de cardio ajoutée → le dîner devient un repas de récup, et l’inverse', () => {
    const d = week();
    const session: SportSession = { id: 's1', date: addDays(MONDAY, 3), time: '18:00', activity: 'course', durationMin: 60, intensity: 'modérée', status: 'prévue', notes: '' };
    d.sport.sessions.push(session);
    run(d);
    const dinner = at(d, 3, 'dinner');
    expect(recoveryScore(d.recipes.find((r) => r.id === dinner.recipeId)!, 'cardio', d)).toBeGreaterThanOrEqual(GOOD_RECOVERY);
    expect(dinner.recovery).toBe('cardio');
    expect(dinner.note).toMatch(/cardio/);
    session.status = 'reportée';
    run(d);
    expect(dinner.recovery).toBeUndefined();
    expect(dinner.note ?? '').not.toMatch(/cardio/);
  });

  it('un repas choisi à la main n’est jamais remplacé', () => {
    const d = week();
    const dinner = at(d, 3, 'dinner');
    Object.assign(dinner, { recipeId: 'risotto-courgettes', pinned: true });
    d.sport.sessions.push({ id: 's2', date: addDays(MONDAY, 3), time: '18:00', activity: 'course', durationMin: 60, intensity: 'modérée', status: 'prévue', notes: '' });
    run(d);
    expect(dinner.recipeId).toBe('risotto-courgettes');
  });

  it('un dîner ajouté fournit le midi suivant tant que le batch n’est pas cuisiné', () => {
    const d = week();
    const tueLunch = at(d, 1, 'lunch');
    // le dîner du lundi est retiré, puis un autre plat est ajouté à la main
    const dinner = at(d, 0, 'dinner');
    d.meals = d.meals.filter((m) => m !== dinner);
    run(d);
    expect(tueLunch.source).toBe('batch');
    d.meals.push({ id: 'new', date: MONDAY, slot: 'dinner', kind: 'recipe', recipeId: 'carbonara', portions: 1, source: 'fresh', status: 'prévu', unplanned: true });
    run(d);
    expect(tueLunch.source).toBe('leftover');
    expect(tueLunch.recipeId).toBe('carbonara');
    expect(d.meals.find((m) => m.id === 'new')!.portions).toBe(2);
  });
});

describe('mise à jour des semaines déjà planifiées (version 5)', () => {
  it('les midis de semaine « à cuisiner » d’une ancienne planification deviennent des portions prêtes', async () => {
    const { migrate } = await import('../src/data/defaults');
    const { todayISO, weekStart } = await import('../src/lib/dates');
    const next = addDays(weekStart(todayISO()), 7);
    const d = fresh();
    const r = generateWeek(d, next);
    d.meals.push(...r.meals);
    const wed = d.meals.find((m) => m.date === addDays(next, 2) && m.slot === 'lunch')!;
    Object.assign(wed, { source: 'fresh', recipeId: 'colin-gratin', storage: undefined, leftoverOf: undefined });
    const out = migrate({ ...d, version: 4 });
    const after = out.meals.find((m) => m.id === wed.id)!;
    expect(after.source).toBe('batch');
    for (const m of out.meals.filter((x) => x.slot === 'lunch' && x.date >= next && new Date(x.date).getUTCDay() >= 1 && new Date(x.date).getUTCDay() <= 5)) {
      expect(m.source).not.toBe('fresh');
    }
  });
});
