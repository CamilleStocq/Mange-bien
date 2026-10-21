import { describe, expect, it } from 'vitest';
import { cookingIssues, generateWeek, rebalanceWeek } from '../src/lib/planning';
import { addDays } from '../src/lib/dates';
import { fresh, MONDAY } from './helpers';
import type { ActivityKey, AppData } from '../src/store/types';

/** Petit générateur pseudo-aléatoire reproductible */
function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

function scenario(seed: number): AppData {
  const rand = rng(seed);
  const d = fresh();
  // coaching sur des soirs tirés au hasard, samedi soir variable
  for (let i = 0; i < 7; i++) d.schedule[i].coaching = rand() < 0.4 ? { start: '18:00', end: '20:00' } : undefined;
  d.saturdayDinner = (['planned', 'restaurant', 'free'] as const)[Math.floor(rand() * 3)];
  const acts: ActivityKey[] = ['course', 'velo', 'natation', 'renforcement', 'marche'];
  for (let w = 0; w < 6; w++) {
    for (let i = 0; i < 7; i++) {
      if (rand() < 0.3) d.sport.sessions.push({ id: `s${w}${i}`, date: addDays(MONDAY, 7 * w + i), time: rand() < 0.3 ? '07:00' : '18:00', activity: acts[Math.floor(rand() * acts.length)], durationMin: 45, intensity: 'modérée', status: 'prévue', notes: '' });
    }
    const r = generateWeek(d, addDays(MONDAY, 7 * w));
    d.meals.push(...r.meals);
    d.rotation = r.rotation;
  }
  return d;
}

describe('chaque repas est cuisiné à un moment précis', () => {
  it('semaines générées : aucun repas sans moment de cuisine (40 scénarios × 6 semaines)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const d = scenario(seed);
      for (let w = 0; w < 6; w++) expect(cookingIssues(d, addDays(MONDAY, 7 * w)), `scénario ${seed}, semaine ${w}`).toEqual([]);
    }
  });

  it('après des changements (dîner remplacé, annulé, séance ajoutée) : toujours cohérent', () => {
    const today = '2026-10-17';
    for (let seed = 1; seed <= 40; seed++) {
      const rand = rng(seed * 7);
      const d = scenario(seed);
      for (let k = 0; k < 6; k++) {
        const dinners = d.meals.filter((m) => m.slot === 'dinner' && m.kind === 'recipe' && m.status === 'prévu');
        const m = dinners[Math.floor(rand() * dinners.length)];
        const roll = rand();
        if (roll < 0.4) m.status = 'remplacé';
        else if (roll < 0.7 && m.source === 'fresh') m.recipeId = d.recipes.filter((r) => r.quick)[Math.floor(rand() * 10)].id;
        else d.sport.sessions.push({ id: `x${seed}${k}`, date: m.date, time: '17:00', activity: 'course', durationMin: 60, intensity: 'modérée', status: 'prévue', notes: '' });
        const monday = addDays(m.date, -((new Date(m.date).getUTCDay() + 6) % 7));
        rebalanceWeek(d, monday, today);
        rebalanceWeek(d, addDays(monday, 7), today);
      }
      for (let w = 0; w < 6; w++) expect(cookingIssues(d, addDays(MONDAY, 7 * w)), `scénario ${seed}, semaine ${w}`).toEqual([]);
    }
  });
});

describe('batch déjà cuisiné', () => {
  it('après le dimanche, les changements ne demandent jamais de portion du batch en plus', () => {
    const today = addDays(MONDAY, 1); // mardi : le batch du dimanche 18 est fait
    for (let seed = 1; seed <= 30; seed++) {
      const d = scenario(seed);
      const count = () => {
        const c = new Map<string, number>();
        for (const m of d.meals) if (m.source === 'batch' && m.date >= MONDAY && m.date <= addDays(MONDAY, 6) && m.status !== 'remplacé' && m.status !== 'reporté') c.set(m.recipeId!, (c.get(m.recipeId!) ?? 0) + m.portions);
        return c;
      };
      const before = count();
      for (const m of d.meals.filter((x) => x.date >= today && x.date <= addDays(MONDAY, 6) && x.slot === 'dinner' && x.source === 'fresh' && x.kind === 'recipe')) m.status = 'remplacé';
      d.sport.sessions.push({ id: 'z', date: addDays(MONDAY, 2), time: '07:00', activity: 'course', durationMin: 60, intensity: 'modérée', status: 'prévue', notes: '' });
      rebalanceWeek(d, MONDAY, today);
      for (const [id, n] of count()) expect(n, `scénario ${seed} : ${id}`).toBeLessThanOrEqual(before.get(id) ?? 0);
      expect(cookingIssues(d, MONDAY), `scénario ${seed}`).toEqual([]);
    }
  });
});

describe('semaine en cours planifiée avec l’ancienne logique (cas réel du 21 octobre)', () => {
  it('midis de mercredi et vendredi « à cuisiner » : réparés sans demander de portion au batch déjà cuisiné', () => {
    const d = fresh();
    for (let i = 0; i < 7; i++) d.schedule[i].coaching = [1, 2, 4].includes(i) ? { start: '18:00', end: '20:00' } : undefined;
    d.saturdayDinner = 'planned';
    const m = (date: string, slot: 'lunch' | 'dinner', recipeId: string, source: 'batch' | 'fresh', storage?: 'fridge' | 'freezer', portions = 1) =>
      ({ id: `${date}-${slot}`, date, slot, kind: 'recipe' as const, recipeId, source, storage, portions, status: 'prévu' as const });
    d.meals = [
      m('2026-10-20', 'lunch', 'soupe-repas', 'batch', 'fridge'), m('2026-10-20', 'dinner', 'couscous', 'batch', 'fridge'),
      m('2026-10-21', 'lunch', 'colin-gratin', 'fresh'), m('2026-10-21', 'dinner', 'soupe-repas', 'batch', 'fridge'),
      m('2026-10-22', 'lunch', 'couscous', 'batch', 'freezer'), m('2026-10-22', 'dinner', 'fish-and-chips', 'fresh'),
      m('2026-10-23', 'lunch', 'colin-gratin', 'fresh'), m('2026-10-23', 'dinner', 'soupe-repas', 'batch', 'freezer'),
      m('2026-10-24', 'lunch', 'pates-saumon-epinards', 'fresh'), m('2026-10-24', 'dinner', 'pates-saumon-epinards', 'fresh'),
      m('2026-10-25', 'lunch', 'pad-thai', 'fresh'), m('2026-10-25', 'dinner', 'shakshuka', 'fresh')
    ];
    const batchBefore = d.meals.filter((x) => x.source === 'batch').map((x) => x.recipeId).sort();
    rebalanceWeek(d, MONDAY, '2026-10-21');
    // le batch du 18 est fait : aucune portion du batch en plus
    expect(d.meals.filter((x) => x.source === 'batch').map((x) => x.recipeId).sort()).toEqual(batchBefore);
    // vendredi midi : restes du fish and chips de jeudi soir (cuisiné en 2 portions)
    const fri = d.meals.find((x) => x.id === '2026-10-23-lunch')!;
    expect(fri.source).toBe('leftover');
    expect(fri.recipeId).toBe('fish-and-chips');
    expect(d.meals.find((x) => x.id === '2026-10-22-dinner')!.portions).toBe(2);
    // mercredi midi (aujourd'hui) : rien à cuisiner le midi même
    const wed = d.meals.find((x) => x.id === '2026-10-21-lunch')!;
    expect(wed.source === 'fresh' && !wed.cookEve).toBe(false);
    expect(cookingIssues(d, MONDAY)).toEqual([]);
  });
});
