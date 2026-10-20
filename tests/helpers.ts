import type { AppData, MealEntry, Recipe } from '../src/store/types';
import { createDefaultData } from '../src/data/defaults';
import { refreshStorage } from '../src/lib/planning';

export const MONDAY = '2026-10-19'; // un lundi
export const SUNDAY_BEFORE = '2026-10-18';

/** Données de test fictives (les données de départ de l'app sont volontairement vides). */
export function fresh(): AppData {
  const d = createDefaultData('2026-10-19');
  d.onboardingDone = true;
  const work = { start: '08:30', end: '17:00' };
  const coaching = { start: '18:00', end: '20:00' };
  d.schedule = [
    { day: 0, wake: '06:30', work, lunch: '12:30', dinner: '19:30', bed: '22:30', note: '' },
    { day: 1, wake: '07:00', work, coaching, snack: '17:15', lunch: '12:30', dinner: '20:30', bed: '22:30', note: '' },
    { day: 2, wake: '07:00', work, coaching, snack: '17:15', lunch: '12:30', dinner: '20:30', bed: '22:30', note: '' },
    { day: 3, wake: '07:00', work, lunch: '12:30', dinner: '19:30', bed: '22:30', note: '' },
    { day: 4, wake: '07:00', work, coaching, snack: '17:15', lunch: '12:30', dinner: '20:30', bed: '22:30', note: '' },
    { day: 5, wake: '09:00', lunch: '12:30', dinner: '20:00', bed: '23:00', note: '' },
    { day: 6, wake: '09:30', lunch: '12:30', dinner: '19:00', bed: '22:30', note: '' }
  ];
  d.breakfast = [
    { id: 'yaourt', name: 'yaourt grec', qty: 200, unit: 'g', state: '', hint: '' },
    { id: 'muesli', name: 'muesli ou granola', qty: 30, unit: 'g', state: 'sec', hint: '' }
  ];
  d.saturdayDinner = 'restaurant';
  d.weeklyBudget = 100;
  d.weights = [{ id: 'start', date: '2026-10-19', kg: 70 }];
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
    id: 'test-recette', name: 'Recette test', categories: ['mijote'], servings: 4, prepMin: 10, cookMin: 30,
    ingredients: [
      { name: 'haché de bœuf', qty: 480, unit: 'g', state: 'cru' },
      { name: 'pâtes', qty: 320, unit: 'g', state: 'sec', accomp: true },
      { name: 'œuf', qty: 2, unit: 'pièce', state: '' }
    ],
    steps: ['Cuire.'], substitutions: '', fridgeDays: 3, freezable: true, freezerMonths: 3, storageNotes: '', batchMode: 'full', quick: false, provisional: false,
    ...over
  };
}
