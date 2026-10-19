import type { AppData, MealEntry, MealSlot, Recipe, Storage } from '../store/types';
import { addDays, diffDays, weekDays, weekdayIndex } from './dates';

let counter = 0;
export function mealId(): string {
  counter = (counter + 1) % 1_000_000;
  return `m${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation (facultative)',
  dinner: 'Dîner'
};
export const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** Le batch cooking d'une semaine (lundi → dimanche) a lieu le dimanche qui précède. */
export function batchDayFor(monday: string): string {
  return addDays(monday, -1);
}

/** Les repas « actifs » comptent pour les courses et le batch (pas remplacés / reportés). */
export function isActive(m: MealEntry): boolean {
  return m.status !== 'remplacé' && m.status !== 'reporté';
}

export function mealsOfWeek(meals: MealEntry[], monday: string): MealEntry[] {
  const end = addDays(monday, 6);
  return meals.filter((m) => m.date >= monday && m.date <= end);
}

export function mealsOfDay(meals: MealEntry[], date: string): MealEntry[] {
  return meals
    .filter((m) => m.date === date)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
}

/** Où stocker une portion cuisinée le dimanche et mangée à `date`. */
export function storageFor(recipe: Recipe, monday: string, date: string, maxFridgeDays: number): { source: 'batch' | 'fresh'; storage?: Storage } {
  const daysAfterBatch = diffDays(date, batchDayFor(monday));
  const fridgeLimit = Math.min(recipe.fridgeDays, maxFridgeDays);
  if (daysAfterBatch <= fridgeLimit) return { source: 'batch', storage: 'fridge' };
  if (recipe.freezable) return { source: 'batch', storage: 'freezer' };
  return { source: 'fresh' };
}

/** Choisit n éléments répartis dans la liste (pas consécutifs) pour varier les semaines. */
function pick<T>(list: T[], rot: number, n: number): T[] {
  if (!list.length) return [];
  const stride = Math.max(1, Math.floor(list.length / n));
  const out: T[] = [];
  for (let k = 0; out.length < Math.min(n, list.length) && k < list.length * 2; k++) {
    const item = list[(rot + k * stride + Math.floor(k / n)) % list.length];
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

export interface GenerateResult {
  meals: MealEntry[];
  rotation: number;
}

/**
 * Génère une semaine type à partir de TES recettes (aucune recette inventée) :
 * - petit-déjeuner habituel chaque jour ;
 * - 3 recettes « batch » cuisinées le dimanche pour les déjeuners du lundi au vendredi
 *   et les dîners des soirs chargés (lundi, mardi, mercredi, vendredi) ;
 * - recettes rapides fraîches le jeudi soir (soirée libre) et le week-end ;
 * - samedi soir : restaurant / repas libre si configuré.
 * Les portions batch au-delà de la durée de conservation au frigo partent au congélateur.
 */
export function generateWeek(data: AppData, monday: string): GenerateResult {
  const recipes = data.recipes.filter((r) => !r.excludeFromRotation);
  const batchPool = recipes.filter((r) => r.batchMode === 'full' && !r.quick);
  const quickPool = recipes.filter((r) => r.quick);
  const rot = data.rotation;
  const batch = pick(batchPool, rot, 3);
  const fresh = pick(quickPool.length ? quickPool : batchPool, rot, 4);
  const days = weekDays(monday);
  const meals: MealEntry[] = [];
  const base = { portions: 1, status: 'prévu' as const };

  for (const date of days) {
    meals.push({ ...base, id: mealId(), date, slot: 'breakfast', kind: 'breakfast', source: 'fresh' });
    const sched = data.schedule[weekdayIndex(date)];
    if (sched?.snack) {
      meals.push({ ...base, id: mealId(), date, slot: 'snack', kind: 'custom', customName: 'Collation facultative avant le coaching', source: 'fresh', note: 'Selon ta faim : un fruit + un yaourt, ou une tartine, ou une poignée de noix.' });
    }
  }

  // Créneaux batch dans l'ordre chronologique, recettes en alternance pour varier.
  const batchSlots: [number, MealSlot][] = [
    [0, 'lunch'], [0, 'dinner'], [1, 'lunch'], [1, 'dinner'], [2, 'lunch'], [2, 'dinner'], [3, 'lunch'], [4, 'lunch'], [4, 'dinner']
  ];
  batchSlots.forEach(([dayIdx, slot], i) => {
    const recipe = batch[i % Math.max(1, batch.length)];
    if (!recipe) return;
    const date = days[dayIdx];
    meals.push({ ...base, id: mealId(), date, slot, kind: 'recipe', recipeId: recipe.id, ...storageFor(recipe, monday, date, data.maxFridgeDays) });
  });

  const freshSlots: [number, MealSlot][] = [[3, 'dinner'], [5, 'lunch'], [6, 'lunch'], [6, 'dinner']];
  freshSlots.forEach(([dayIdx, slot], i) => {
    const recipe = fresh[i % Math.max(1, fresh.length)];
    if (!recipe) return;
    meals.push({ ...base, id: mealId(), date: days[dayIdx], slot, kind: 'recipe', recipeId: recipe.id, source: 'fresh' });
  });

  const sat = days[5];
  if (data.saturdayDinner === 'planned') {
    const recipe = fresh[1 % Math.max(1, fresh.length)] ?? batch[0];
    if (recipe) meals.push({ ...base, id: mealId(), date: sat, slot: 'dinner', kind: 'recipe', recipeId: recipe.id, source: 'fresh' });
  } else {
    meals.push({ ...base, id: mealId(), date: sat, slot: 'dinner', kind: data.saturdayDinner, source: 'fresh', note: 'Profite de ton repas. Le planning continue normalement demain, sans rien compenser.' });
  }

  const start = data.profile?.startDate;
  return { meals: start ? meals.filter((m) => m.date >= start) : meals, rotation: rot + 1 };
}

/** Premier jour à planifier : aujourd'hui, ou la date de début du programme si elle est à venir. */
export function planningFrom(data: AppData, today: string): string {
  const start = data.profile?.startDate;
  return start && start > today ? start : today;
}

/** Vrai tant que le programme n'a pas commencé. */
export function beforeStart(data: AppData, date: string): boolean {
  const start = data.profile?.startDate;
  return !!start && date < start;
}

/** Recalcule frigo / congélateur d'un repas batch après un déplacement ou un changement de recette. */
export function refreshStorage(meal: MealEntry, recipe: Recipe | undefined, maxFridgeDays: number): MealEntry {
  if (meal.kind !== 'recipe' || !recipe || meal.source !== 'batch') return { ...meal, storage: undefined };
  const monday = addDays(meal.date, -weekdayIndex(meal.date));
  const s = storageFor(recipe, monday, meal.date, maxFridgeDays);
  return { ...meal, source: s.source, storage: s.storage };
}

/** Recettes équivalentes pour remplacer un repas, triées par pertinence. */
export function equivalentRecipes(current: Recipe | undefined, all: Recipe[], ownedKeys: Set<string>, costOf: (r: Recipe) => number): Recipe[] {
  const keyOf = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const score = (r: Recipe) => {
    let s = 0;
    if (current) {
      if (r.batchMode === current.batchMode) s += 2;
      if (r.quick === current.quick) s += 1;
      if (r.categories.some((c) => current.categories.includes(c))) s += 1;
    }
    const owned = r.ingredients.filter((i) => ownedKeys.has(keyOf(i.name))).length;
    s += owned / Math.max(1, r.ingredients.length);
    s -= costOf(r) / 10;
    return s;
  };
  return all.filter((r) => r.id !== current?.id).sort((a, b) => score(b) - score(a));
}
