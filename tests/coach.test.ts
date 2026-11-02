import { describe, expect, it } from 'vitest';
import { DRINKS, MIN_KCAL, MOTIVATION, STARCH_TARGET, dayKind, dayTargets, mealAdvice, proposeSportWeek, treatPlan, waterGoal } from '../src/lib/coach';
import { FORBIDDEN_PATTERNS } from '../src/lib/messages';
import { addDays } from '../src/lib/dates';
import { fresh, meal, MONDAY, testRecipe } from './helpers';

let n = 0;
const id = () => `s${n++}`;

describe('mon coach', () => {
  it('repère du jour : léger déficit, jamais sous le minimum, protéines pour garder les muscles', () => {
    const d = fresh();
    expect(dayTargets(d, MONDAY)).toBeUndefined(); // âge et taille manquants
    d.profile.age = 34;
    d.profile.heightCm = 165;
    const t = dayTargets(d, MONDAY)!;
    expect(t.kcal).toBeGreaterThanOrEqual(MIN_KCAL);
    expect(t.kcal).toBeLessThan(t.spend);
    expect(t.protein).toBe(110);
    // Jour de coaching : dépense et repère plus hauts.
    expect(dayTargets(d, addDays(MONDAY, 1))!.kcal).toBeGreaterThan(t.kcal);
  });

  it('féculents réduits les jours calmes, plus généreux les jours de cardio', () => {
    const d = fresh();
    d.recipes.push(testRecipe()); // 80 g de pâtes sèches par portion
    d.meals = [meal(d, { date: MONDAY, recipeId: 'test-recette' })];
    expect(dayKind(d, MONDAY)).toBe('repos');
    expect(mealAdvice(d, MONDAY)[0].reduce).toBe(true);
    expect(mealAdvice(d, MONDAY)[0].text).toContain(`Garde environ ${STARCH_TARGET.repos} g de pâtes (au lieu de 80 g)`);
    d.sport.sessions.push({ id: 'v', date: MONDAY, time: '17:30', activity: 'velo', durationMin: 45, intensity: 'douce', status: 'prévue', notes: '' });
    expect(dayKind(d, MONDAY)).toBe('cardio');
    expect(mealAdvice(d, MONDAY)[0].reduce).toBe(false);
  });

  it('eau : plus les jours de coaching et de sport', () => {
    const d = fresh();
    expect(waterGoal(d, MONDAY)).toBe(1800);
    expect(waterGoal(d, addDays(MONDAY, 1))).toBe(2300);
  });

  it('repas plaisir : le resto du samedi, sinon le soir de la plus grosse séance du week-end', () => {
    const d = fresh();
    d.meals = [meal(d, { date: addDays(MONDAY, 5), kind: 'restaurant' })];
    expect(treatPlan(d, MONDAY).date).toBe(addDays(MONDAY, 5));
    d.meals = [];
    d.sport.sessions.push({ id: 'x', date: addDays(MONDAY, 6), time: '10:00', activity: 'velo', durationMin: 60, intensity: 'douce', status: 'prévue', notes: '' });
    expect(treatPlan(d, MONDAY)).toMatchObject({ date: addDays(MONDAY, 6), slot: 'dinner' });
  });

  it('sport : rien en récupération ; en reprise, le maximum de l’étape hors travail et hors coaching', () => {
    const d = fresh();
    expect(proposeSportWeek(d, MONDAY, id)).toEqual([]);
    d.sport.phase = 'reprise';
    d.sport.currentStage = 3; // 4 séances de 50 min
    d.sport.authorizations.velo.status = 'autorisé';
    d.sport.authorizations.renforcement.status = 'autorisé';
    d.sport.authorizations.marche.status = 'autorisé';
    const s = proposeSportWeek(d, MONDAY, id);
    const coachDays = [1, 2, 4].map((k) => addDays(MONDAY, k));
    expect(s.every((x) => !coachDays.includes(x.date))).toBe(true);
    const main = s.filter((x) => x.activity !== 'marche');
    expect(main).toHaveLength(4);
    expect(main.every((x) => x.durationMin === 50 && x.intensity === 'modérée')).toBe(true);
    expect(new Set(main.map((x) => x.activity))).toEqual(new Set(['velo', 'renforcement']));
    // Lundi et jeudi : après le travail (17 h + 30 min), fini avant le dîner.
    expect(main.find((x) => x.date === MONDAY)?.time).toBe('17:30');
    expect(s.some((x) => x.activity === 'course')).toBe(false); // non autorisée
  });

  it('messages bienveillants', () => {
    for (const t of [...MOTIVATION, ...Object.values(DRINKS)]) for (const p of FORBIDDEN_PATTERNS) expect(t).not.toMatch(p);
  });
});
