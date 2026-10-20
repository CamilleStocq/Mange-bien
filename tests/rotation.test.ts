import { describe, expect, it } from 'vitest';
import { generateWeek } from '../src/lib/planning';
import { addDays } from '../src/lib/dates';
import { fresh, MONDAY } from './helpers';

describe('rotation', () => {
  it('3 recettes batch différentes par semaine, toutes utilisées en quelques semaines', () => {
    const d = fresh();
    const pool = d.recipes.filter((r) => r.batchMode === 'full' && !r.quick).length;
    const seen = new Set<string>();
    for (let w = 0; w < Math.ceil(pool / 3) + 1; w++) {
      const r = generateWeek(d, addDays(MONDAY, 7 * w));
      const ids = [...new Set(r.meals.filter((m) => m.source === 'batch' || m.storage).map((m) => m.recipeId!))];
      expect(ids.length).toBe(3);
      ids.forEach((i) => seen.add(i));
      d.rotation = r.rotation;
    }
    expect(seen.size).toBe(pool);
  });
});
