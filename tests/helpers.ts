import type { AppData, MealEntry, Recipe } from '../src/store/types';
import { createDefaultData } from '../src/data/defaults';
import { refreshStorage } from '../src/lib/planning';

export const MONDAY = '2026-10-19'; // un lundi
export const SUNDAY_BEFORE = '2026-10-18';

export function fresh(): AppData {
  const d = createDefaultData('2026-10-19');
  d.onboardingDone = true;
  return d;
}

let n = 0;
export function meal(d: AppData, p: Partial<MealEntry> & { date: string }): MealEntry {
  const m: MealEntry = { id: `t${n++}`, slot: 'dinner', kind: 'recipe', portions: 1, source: 'batch', status: 'prévu', ...p };
  return refreshStorage(m, d.recipes.find((r) => r.id === m.recipeId), d.maxFridgeDays);
}

/** Recette de test simple : 120 g de viande crue et 80 g de pâtes sèches par portion. */
export function testRecipe(over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'test-recette', name: 'Recette test', categories: ['plat'], servings: 4, prepMin: 10, cookMin: 30,
    ingredients: [
      { name: 'haché de bœuf', qty: 480, unit: 'g', state: 'cru' },
      { name: 'pâtes', qty: 320, unit: 'g', state: 'sec', accomp: true },
      { name: 'œuf', qty: 2, unit: 'pièce', state: '' }
    ],
    steps: ['Cuire.'], substitutions: '', fridgeDays: 3, freezable: true, freezerMonths: 3, storageNotes: '', batchMode: 'full', quick: false, provisional: false,
    ...over
  };
}
