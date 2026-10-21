import type { AppData, ISODate, MealEntry, MealSlot, Recipe } from '../store/types';
import { weekdayIndex } from './dates';
import { ingredientKey, recipeNutrition } from './units';

/**
 * Récupération après le sport : le repas qui suit une séance est choisi pour aider le corps à récupérer.
 * - cardio (course, vélo, natation) : glucides pour refaire le plein d'énergie + protéines ;
 * - renforcement : protéines d'abord, avec un peu de glucides ;
 * Le coaching (horaire habituel) est ton travail : tu encadres, il ne compte pas comme une séance.
 * Marche et mobilité ne changent rien. Repères généraux, pas une prescription.
 */
export type Effort = NonNullable<MealEntry['recovery']>;

export interface RecoveryNeed {
  date: ISODate;
  slot: MealSlot;
  effort: Effort;
}

const CARDIO = new Set(['course', 'velo', 'natation']);

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Repas à adapter dans la semaine : celui qui suit chaque séance prévue ou faite. */
export function recoveryNeeds(data: AppData, days: ISODate[]): RecoveryNeed[] {
  const out = new Map<string, RecoveryNeed>();
  const rank: Record<Effort, number> = { coaching: 1, force: 2, cardio: 3 };
  const add = (date: ISODate, endMin: number, effort: Effort) => {
    const sched = data.schedule[weekdayIndex(date)];
    const slot: MealSlot = sched && endMin <= toMin(sched.lunch) ? 'lunch' : 'dinner';
    const k = `${date}|${slot}`;
    const prev = out.get(k);
    if (!prev || rank[effort] > rank[prev.effort]) out.set(k, { date, slot, effort });
  };
  for (const date of days) {
    for (const s of data.sport?.sessions ?? []) {
      if (s.date !== date || (s.status !== 'prévue' && s.status !== 'faite')) continue;
      const effort: Effort | undefined = CARDIO.has(s.activity) ? 'cardio' : s.activity === 'renforcement' ? 'force' : undefined;
      if (effort) add(date, toMin(s.time) + s.durationMin, effort);
    }
  }
  return [...out.values()];
}

/** Glucides « féculents » par portion (g de pâtes, riz, pommes de terre, pain, légumineuses… poids sec ou cru). */
function starchPerPortion(r: Recipe, data: AppData): number {
  let g = 0;
  for (const i of r.ingredients) {
    if (i.unit !== 'g') continue;
    const k = ingredientKey(i.name);
    if (data.ingredients[k]?.aisle === 'feculents' || k.includes('pommes de terre') || k === 'pois chiches') g += i.qty;
  }
  return g / Math.max(1, r.servings);
}

/** Note de 0 à 5 : à quel point la recette aide à récupérer après ce type d'effort. */
export function recoveryScore(r: Recipe, effort: Effort, data: AppData): number {
  const p = recipeNutrition(r, data.ingredients).protein;
  const s = starchPerPortion(r, data);
  const prot = p >= 30 ? 3 : p >= 22 ? 2 : p >= 15 ? 1 : 0;
  const carbs = s >= 70 ? 2 : s >= 40 ? 1 : 0;
  if (effort === 'cardio') return Math.min(5, carbs * 1.5 + prot);
  if (effort === 'force') return Math.min(5, prot * 1.5 + carbs * 0.5);
  return Math.min(5, prot + carbs);
}

/** Une recette convient à la récupération si elle obtient au moins 3 sur 5. */
export const GOOD_RECOVERY = 3;

export const EFFORT_NOTE: Record<Effort, string> = {
  cardio: 'Jour de cardio : un plat avec des glucides et des protéines, pour refaire le plein d’énergie et bien récupérer.',
  force: 'Jour de renforcement : un plat riche en protéines, pour aider tes muscles à récupérer.',
  coaching: 'Jour de coaching : un plat avec protéines et glucides, pour bien récupérer après la séance.'
};

export const EFFORT_LABEL: Record<Effort, string> = { cardio: 'récup cardio', force: 'récup muscles', coaching: 'récup coaching' };
