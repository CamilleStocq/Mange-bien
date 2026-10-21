import { describe, expect, it } from 'vitest';
import { generateWeek } from '../src/lib/planning';
import { addDays } from '../src/lib/dates';
import { fresh, MONDAY } from './helpers';

describe('midis prêts, cuisine les soirs sans coaching', () => {
  const d = fresh(); // coaching mardi, mercredi, vendredi ; samedi soir restaurant
  const { meals } = generateWeek(d, MONDAY);
  const at = (i: number, slot: string) => meals.find((m) => m.date === addDays(MONDAY, i) && m.slot === slot)!;

  it('aucun midi de semaine n’est à cuisiner : batch (frigo / congélateur) ou restes', () => {
    for (let i = 0; i < 5; i++) {
      const l = at(i, 'lunch');
      expect(l.kind).toBe('recipe');
      expect(['batch', 'leftover'], `midi ${addDays(MONDAY, i)}`).toContain(l.source);
    }
  });

  it('soirs de coaching : une portion du batch, prête à réchauffer', () => {
    for (const i of [1, 2, 4]) expect(at(i, 'dinner').source).toBe('batch');
  });

  it('soirs sans coaching : on cuisine 2 portions, la 2e devient un midi des 2 jours suivants', () => {
    for (const i of [0, 3, 6]) {
      const dinner = at(i, 'dinner');
      expect(dinner.source).toBe('fresh');
      if (i === 6) continue; // dimanche : la 2e portion ira au lundi suivant
      expect(dinner.portions).toBe(2);
      const lunch = [at(i + 1, 'lunch'), at(i + 2, 'lunch')].find((l) => l.source === 'leftover' && l.recipeId === dinner.recipeId);
      expect(lunch, `restes du dîner du jour ${i}`).toBeTruthy();
      expect(dinner.note).toMatch(/boîte au frigo/);
    }
  });

  it('on cuisine seulement les soirs sans coaching et le week-end', () => {
    const cookedAt = meals.filter((m) => m.kind === 'recipe' && m.source === 'fresh').map((m) => [new Date(m.date).getUTCDay(), m.slot]);
    for (const [wd, slot] of cookedAt) {
      const idx = (Number(wd) + 6) % 7; // 0 = lundi
      const weekend = idx >= 5;
      expect(weekend || (slot === 'dinner' && !d.schedule[idx].coaching), `jour ${idx} ${slot}`).toBe(true);
    }
  });

  it('jamais de plat du batch « à cuisiner le jour même »', () => {
    for (const m of meals.filter((x) => x.slot === 'dinner' && x.kind === 'recipe' && x.source === 'fresh')) {
      expect(d.recipes.find((r) => r.id === m.recipeId)!.quick).toBe(true);
    }
  });

  it('le dîner du dimanche fournit le déjeuner du lundi suivant', () => {
    const d2 = fresh();
    const w1 = generateWeek(d2, MONDAY);
    d2.meals.push(...w1.meals);
    d2.rotation = w1.rotation;
    const sunday = d2.meals.find((m) => m.date === addDays(MONDAY, 6) && m.slot === 'dinner')!;
    const w2 = generateWeek(d2, addDays(MONDAY, 7));
    const mondayLunch = w2.meals.find((m) => m.date === addDays(MONDAY, 7) && m.slot === 'lunch')!;
    expect(mondayLunch.source).toBe('leftover');
    expect(mondayLunch.recipeId).toBe(sunday.recipeId);
    expect(sunday.portions).toBe(2);
  });
});

describe('jamais le même plat cuisiné deux fois sur 3 semaines', () => {
  it('sur 6 semaines, aucun plat cuisiné ne revient dans les 2 semaines suivantes ni dans la même semaine', () => {
    const d = fresh();
    d.sport.sessions = [{ id: 's', date: addDays(MONDAY, 3), time: '18:00', activity: 'course', durationMin: 60, intensity: 'modérée', status: 'prévue', notes: '' }];
    const weeks: Set<string>[] = [];
    for (let w = 0; w < 6; w++) {
      const r = generateWeek(d, addDays(MONDAY, 7 * w));
      d.meals.push(...r.meals);
      d.rotation = r.rotation;
      const cookedList = r.meals.filter((m) => m.kind === 'recipe' && (m.source === 'fresh' || m.source === 'batch')).map((m) => `${m.source}:${m.recipeId}`);
      const freshIds = cookedList.filter((x) => x.startsWith('fresh:'));
      expect(new Set(freshIds).size, `semaine ${w} : plats du soir distincts`).toBe(freshIds.length);
      weeks.push(new Set(cookedList.map((x) => x.split(':')[1])));
    }
    for (let w = 1; w < weeks.length; w++) {
      const repeated = [...weeks[w]].filter((id) => weeks[w - 1].has(id) || (w >= 2 && weeks[w - 2].has(id)));
      expect(repeated, `semaine ${w}`).toEqual([]);
    }
  });
});
