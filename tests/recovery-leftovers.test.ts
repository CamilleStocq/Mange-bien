import { describe, expect, it } from 'vitest';
import { generateWeek } from '../src/lib/planning';
import { GOOD_RECOVERY, recoveryNeeds, recoveryScore } from '../src/lib/recovery';
import { createDefaultData } from '../src/data/defaults';
import { addDays, weekDays } from '../src/lib/dates';
import { MONDAY } from './helpers';
import type { AppData, SportSession } from '../src/store/types';

function data(): AppData {
  const d = createDefaultData();
  d.profile.startDate = MONDAY;
  return d;
}
const session = (date: string, activity: SportSession['activity'], time = '18:00', durationMin = 60): SportSession =>
  ({ id: `s-${date}-${activity}`, date, time, activity, durationMin, intensity: 'modérée', status: 'prévue', notes: '' });

describe('restes : un plat cuisiné en plusieurs portions est fini dans les 2 jours', () => {
  it('la portion gardée remplace un repas à cuisiner dans les 2 jours, et le plat est cuisiné en 2 portions', () => {
    const d = data();
    const { meals } = generateWeek(d, MONDAY);
    const leftovers = meals.filter((m) => m.source === 'leftover');
    expect(leftovers.length).toBeGreaterThan(0);
    for (const l of leftovers) {
      const cook = meals.find((m) => m.source === 'fresh' && m.recipeId === l.recipeId && m.date < l.date && m.portions > 1);
      expect(cook, l.date).toBeTruthy();
      const gap = (Date.parse(l.date) - Date.parse(cook!.date)) / 86400000;
      expect(gap).toBeGreaterThanOrEqual(1);
      expect(gap).toBeLessThanOrEqual(2);
      expect(l.note).toMatch(/Restes/);
      expect(d.recipes.find((r) => r.id === l.recipeId)!.quick, 'reste d’un plat rapide, jamais du batch').toBe(true);
    }
    // 2 portions cuisinées : 1 mangée, 1 gardée ; jamais un plat du batch
    for (const cook of meals.filter((m) => m.source === 'fresh' && m.portions > 1)) {
      const r = d.recipes.find((x) => x.id === cook.recipeId)!;
      expect(cook.portions).toBe(2);
      expect(r.servings).toBeGreaterThanOrEqual(2);
      expect(meals.filter((m) => m.source === 'leftover' && m.recipeId === r.id).length).toBe(cook.portions - 1);
    }
  });

  it('un plat qui ne se garde pas au frigo n’a pas de restes', () => {
    const d = data();
    for (const r of d.recipes) r.fridgeDays = 0;
    expect(generateWeek(d, MONDAY).meals.some((m) => m.source === 'leftover')).toBe(false);
  });
});

describe('récupération après le sport', () => {
  it('le repas après une séance de cardio aide à récupérer (glucides + protéines)', () => {
    const d = data();
    const days = weekDays(MONDAY);
    d.sport.sessions = [session(days[0], 'course'), session(days[3], 'velo', '17:00'), session(days[6], 'natation', '10:00')];
    const { meals } = generateWeek(d, MONDAY);
    for (const [date, slot] of [[days[0], 'dinner'], [days[3], 'dinner'], [days[6], 'lunch']] as const) {
      const m = meals.find((x) => x.date === date && x.slot === slot && x.kind === 'recipe')!;
      const r = d.recipes.find((x) => x.id === m.recipeId)!;
      expect(recoveryScore(r, 'cardio', d), `${date} ${slot} : ${r.name}`).toBeGreaterThanOrEqual(GOOD_RECOVERY);
      expect(m.recovery).toBe('cardio');
      expect(m.note).toMatch(/cardio/);
    }
  });

  it('une séance du matin vise le déjeuner, une séance du soir le dîner', () => {
    const d = data();
    const days = weekDays(MONDAY);
    d.sport.sessions = [session(days[1], 'renforcement', '07:00', 45), session(days[2], 'course', '19:00', 30)];
    const needs = recoveryNeeds(d, days);
    expect(needs).toContainEqual({ date: days[1], slot: 'lunch', effort: 'force' });
    expect(needs).toContainEqual({ date: days[2], slot: 'dinner', effort: 'cardio' });
  });

  it('marche et mobilité, séance annulée : aucun changement', () => {
    const d = data();
    const days = weekDays(MONDAY);
    d.sport.sessions = [session(days[0], 'marche'), session(days[1], 'mobilite'), { ...session(days[2], 'course'), status: 'reportée' }];
    expect(recoveryNeeds(d, days)).toEqual([]);
  });

  it('les soupes légères ne sont pas proposées pour récupérer d’un cardio', () => {
    const d = data();
    const soupe = d.recipes.find((r) => r.id === 'soupe-indienne')!;
    expect(recoveryScore(soupe, 'cardio', d)).toBeLessThan(GOOD_RECOVERY);
    expect(addDays(MONDAY, 0)).toBe(MONDAY);
  });
});
