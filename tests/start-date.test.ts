import { describe, expect, it } from 'vitest';
import { beforeStart, generateWeek, planningFrom } from '../src/lib/planning';
import { buildReminders } from '../src/lib/reminders';
import { addDays } from '../src/lib/dates';
import { fresh, MONDAY } from './helpers';

describe('date de début du programme', () => {
  it('aucun repas n’est généré avant la date de début', () => {
    const d = fresh();
    const start = addDays(MONDAY, 2); // mercredi
    d.profile.startDate = start;
    const { meals } = generateWeek(d, MONDAY);
    expect(meals.length).toBeGreaterThan(0);
    expect(meals.every((m) => m.date >= start)).toBe(true);
    expect(meals.some((m) => m.date === start)).toBe(true);
  });

  it('la planification démarre à la date de début si elle est à venir', () => {
    const d = fresh();
    d.profile.startDate = addDays(MONDAY, 14);
    expect(planningFrom(d, MONDAY)).toBe(addDays(MONDAY, 14));
    expect(beforeStart(d, MONDAY)).toBe(true);
    d.profile.startDate = addDays(MONDAY, -3);
    expect(planningFrom(d, MONDAY)).toBe(MONDAY);
    expect(beforeStart(d, MONDAY)).toBe(false);
  });

  it('avant le début, seuls les rappels de préparation restent', () => {
    const d = fresh();
    d.profile.startDate = addDays(MONDAY, 7);
    d.weighReminders = true;
    const before = buildReminders(d, MONDAY, 7, 0);
    const allowed = new Set(['defrost', 'prepEve', 'batch', 'batchRemaining', 'shopping']);
    expect(before.every((r) => allowed.has(r.category))).toBe(true);
    const after = buildReminders(d, addDays(MONDAY, 7), 1, 0);
    expect(after.some((r) => r.category === 'morning' || r.category === 'pain')).toBe(true);
  });
});
