import type { AppData, MealEntry, MealSlot, Recipe, Storage } from '../store/types';
import { addDays, DAY_NAMES, diffDays, weekDays, weekdayIndex } from './dates';
import { EFFORT_NOTE, GOOD_RECOVERY, recoveryNeeds, recoveryScore } from './recovery';

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
 * Après une séance de sport (ou de coaching), le repas suivant est choisi pour aider à récupérer.
 * Un plat cuisiné le jour même qui fait plusieurs portions : la portion suivante est mangée dans les 2 jours (restes).
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
  const freshSlots: [number, MealSlot][] = [[3, 'dinner'], [5, 'lunch'], ...(data.saturdayDinner === 'planned' ? [[5, 'dinner'] as [number, MealSlot]] : []), [6, 'lunch'], [6, 'dinner']];

  // Récupération : le repas qui suit une séance doit aider le corps à récupérer.
  const needs = recoveryNeeds(data, days);
  const needAt = (date: string, slot: MealSlot) => needs.find((n) => n.date === date && n.slot === slot);
  const best = (pool: Recipe[], effort: NonNullable<MealEntry['recovery']>) =>
    [...pool].sort((a, b) => recoveryScore(b, effort, data) - recoveryScore(a, effort, data))[0];
  // Au moins une recette du batch doit convenir si des séances tombent sur les jours du batch.
  const batchNeeds = needs.filter((n) => batchSlots.some(([d, s]) => days[d] === n.date && s === n.slot));
  if (batchNeeds.length && batch.length && !batch.some((r) => batchNeeds.some((n) => recoveryScore(r, n.effort, data) >= GOOD_RECOVERY))) {
    const candidate = best(batchPool.filter((r) => !batch.includes(r)), batchNeeds[0].effort);
    if (candidate && recoveryScore(candidate, batchNeeds[0].effort, data) >= GOOD_RECOVERY) batch[batch.length - 1] = candidate;
  }
  const recoveryFields = (recipe: Recipe, date: string, slot: MealSlot): Partial<MealEntry> => {
    const need = needAt(date, slot);
    return need && recoveryScore(recipe, need.effort, data) >= GOOD_RECOVERY ? { recovery: need.effort, note: EFFORT_NOTE[need.effort] } : {};
  };

  batchSlots.forEach(([dayIdx, slot], i) => {
    let recipe = batch[i % Math.max(1, batch.length)];
    if (!recipe) return;
    const date = days[dayIdx];
    const need = needAt(date, slot);
    if (need) {
      const b = best(batch, need.effort);
      if (recoveryScore(b, need.effort, data) > recoveryScore(recipe, need.effort, data)) recipe = b;
    }
    meals.push({ ...base, id: mealId(), date, slot, kind: 'recipe', recipeId: recipe.id, ...storageFor(recipe, monday, date, data.maxFridgeDays), ...recoveryFields(recipe, date, slot) });
  });

  const freshPool = quickPool.length ? quickPool : batchPool;
  const cookedThatDay = new Set<MealEntry>();
  freshSlots.forEach(([dayIdx, slot], i) => {
    let recipe = fresh[i % Math.max(1, fresh.length)];
    if (!recipe) return;
    const date = days[dayIdx];
    const need = needAt(date, slot);
    if (need) {
      // d'abord parmi les recettes rapides de la semaine, sinon parmi toutes les recettes rapides
      const b = best(fresh, need.effort);
      const b2 = recoveryScore(b, need.effort, data) >= GOOD_RECOVERY ? b : best(freshPool, need.effort);
      if (recoveryScore(b2, need.effort, data) > recoveryScore(recipe, need.effort, data)) recipe = b2;
    }
    const meal: MealEntry = { ...base, id: mealId(), date, slot, kind: 'recipe', recipeId: recipe.id, source: 'fresh', ...recoveryFields(recipe, date, slot) };
    meals.push(meal);
    cookedThatDay.add(meal);
  });

  planLeftovers([...cookedThatDay], data);

  const sat = days[5];
  if (data.saturdayDinner !== 'planned') {
    meals.push({ ...base, id: mealId(), date: sat, slot: 'dinner', kind: data.saturdayDinner, source: 'fresh', note: 'Profite de ton repas. Le planning continue normalement demain, sans rien compenser.' });
  }

  const start = data.profile?.startDate;
  return { meals: start ? meals.filter((m) => m.date >= start) : meals, rotation: rot + 1 };
}

const SLOT_RANK: Record<MealSlot, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };
const SLOT_WHEN: Record<MealSlot, string> = { breakfast: 'matin', lunch: 'midi', snack: 'après-midi', dinner: 'soir' };
const byTime = (a: MealEntry, b: MealEntry) => a.date.localeCompare(b.date) || SLOT_RANK[a.slot] - SLOT_RANK[b.slot];

/**
 * Restes : un plat cuisiné le jour même en 2 portions → la 2e remplace un autre repas « à cuisiner »
 * dans les 2 jours (dans la limite de conservation au frigo). Le repas cuisiné passe à 2 portions
 * (courses et quantités à jour). `meals` : les repas cuisinés le jour même (hors batch).
 * Un repas choisi pour récupérer après le sport n'est remplacé que par un plat qui convient aussi.
 */
export function planLeftovers(meals: MealEntry[], data: AppData): void {
  const fresh = meals.filter((m) => m.kind === 'recipe' && m.source === 'fresh' && m.status === 'prévu').sort(byTime);
  for (const cook of fresh) {
    if (cook.source !== 'fresh') continue; // devenu un reste entre-temps
    const r = data.recipes.find((x) => x.id === cook.recipeId);
    if (!r || r.servings < 2) continue;
    const keep = Math.min(2, r.fridgeDays);
    if (keep < 1) continue;
    const last = addDays(cook.date, keep);
    const taken: MealEntry[] = [];
    for (const m of fresh) {
      if (cook.portions + taken.length >= Math.min(2, r.servings)) break;
      if (m === cook || m.source !== 'fresh' || m.portions !== 1 || m.date <= cook.date || m.date > last) continue;
      if (m.recovery && recoveryScore(r, m.recovery, data) < GOOD_RECOVERY) continue;
      taken.push(m);
    }
    if (!taken.length) continue;
    const when = `${DAY_NAMES[weekdayIndex(cook.date)]} ${SLOT_WHEN[cook.slot]}`;
    for (const m of taken) {
      m.recipeId = r.id;
      m.source = 'leftover';
      m.note = [`Restes : la portion gardée du plat cuisiné ${when}.`, m.recovery ? EFFORT_NOTE[m.recovery] : ''].filter(Boolean).join(' ');
    }
    cook.portions += taken.length;
    const list = taken.map((m) => `${DAY_NAMES[weekdayIndex(m.date)]} ${SLOT_WHEN[m.slot]}`).join(' et ');
    cook.note = [cook.note, `Cuisine ${cook.portions} portions : la 2e est prévue ${list} (restes, au frigo).`].filter(Boolean).join(' ');
  }
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
