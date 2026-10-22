import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/defaults';
import { generateWeek } from '../src/lib/planning';
import { addDays, todayISO, weekStart } from '../src/lib/dates';
import { fresh } from './helpers';

/** Données d'anciennes versions, avec des formes inattendues : la mise à jour ne doit jamais échouer. */
describe('mise à jour des données : jamais de retour au questionnaire', () => {
  const monday = weekStart(todayISO());
  const base = () => {
    const d = fresh();
    const r = generateWeek(d, monday);
    d.meals.push(...r.meals, ...generateWeek(d, addDays(monday, 7)).meals);
    return d as unknown as Record<string, unknown>;
  };
  const cases: [string, (d: Record<string, any>) => void][] = [
    ['version 1 sans champs récents', (d) => { d.version = 1; delete d.weeks; delete d.freezer; delete d.pantry; }],
    ['sport sans séances', (d) => { d.version = 4; d.sport = { phase: 'recuperation', authorizations: {} }; }],
    ['congélateur sans recette', (d) => { d.version = 4; d.freezer = [{ id: 'f', name: 'Soupe maison', portions: 2, frozenOn: '2026-10-01' }]; }],
    ['repas sans recette ni source', (d) => { d.version = 4; (d.meals as any[]).push({ id: 'x', date: addDays(monday, 2), slot: 'lunch', kind: 'recipe', portions: 1, status: 'prévu' }); }],
    ['recette supprimée encore planifiée', (d) => { d.version = 4; (d.meals as any[]).push({ id: 'y', date: addDays(monday, 3), slot: 'lunch', kind: 'recipe', recipeId: 'disparue', portions: 1, source: 'fresh', status: 'prévu' }); }],
    ['horaires incomplets', (d) => { d.version = 4; (d.schedule as any[])[2] = { day: 2, wake: '07:00', bed: '22:00', note: '' }; }],
    ['séance sans heure', (d) => { d.version = 4; (d.sport as any).sessions = [{ id: 's', date: addDays(monday, 1), activity: 'course', durationMin: 30, status: 'prévue' }]; }]
  ];
  for (const [name, mutate] of cases) {
    it(name, () => {
      const d = base();
      d.onboardingDone = true;
      mutate(d as Record<string, any>);
      const out = migrate(JSON.parse(JSON.stringify(d)));
      expect(out.onboardingDone).toBe(true);
      expect(out.version).toBe(5);
    });
  }
});
