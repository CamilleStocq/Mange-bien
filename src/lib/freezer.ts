import type { AppData, MealEntry } from '../store/types';
import { weekStart } from './dates';

const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * Inventaire du congélateur tenu à jour tout seul :
 * - fin du batch : les portions prévues au congélateur (et les portions en plus) y entrent ;
 * - « Mangé » sur un repas qui vient du congélateur : une portion en sort (la plus ancienne d'abord) ;
 * - annuler ce « Mangé » : la portion y revient.
 */

/** Repas qui se mange depuis le congélateur (portion du batch congelée ou portion déjà en stock). */
export const fromFreezer = (m: Pick<MealEntry, 'kind' | 'source' | 'storage' | 'recipeId'>) =>
  m.kind === 'recipe' && !!m.recipeId && (m.source === 'stock' || (m.source === 'batch' && m.storage === 'freezer'));

export function addToFreezer(d: AppData, recipeId: string, name: string, portions: number, frozenOn: string): void {
  if (portions <= 0) return;
  const same = d.freezer.find((f) => f.recipeId === recipeId && f.frozenOn === frozenOn);
  if (same) same.portions += portions;
  else d.freezer.push({ id: randomId(), recipeId, name, portions, frozenOn });
}

/** Une portion sort du congélateur (la plus ancienne). Rien ne se passe si elle n'y a jamais été notée. */
export function takeFromFreezer(d: AppData, recipeId: string): boolean {
  const f = d.freezer.filter((x) => x.recipeId === recipeId && x.portions > 0).sort((a, b) => a.frozenOn.localeCompare(b.frozenOn))[0];
  if (!f) return false;
  f.portions -= 1;
  d.freezer = d.freezer.filter((x) => x.portions > 0);
  return true;
}

/** Suit les changements de statut d'un repas : « mangé » retire une portion, l'annuler la remet. */
export function syncFreezerOnStatus(d: AppData, before: MealEntry, after: MealEntry): void {
  if (!fromFreezer(before)) return;
  const wasEaten = before.status === 'mangé';
  const isEaten = after.status === 'mangé';
  if (!wasEaten && isEaten) {
    if (takeFromFreezer(d, before.recipeId!)) after.tookFromFreezer = true;
  } else if (wasEaten && !isEaten && before.tookFromFreezer) {
    const r = d.recipes.find((x) => x.id === before.recipeId);
    addToFreezer(d, before.recipeId!, r?.name ?? '', 1, after.date);
    delete after.tookFromFreezer;
  }
}

/** Portions encore libres d'une recette : en stock, moins celles déjà prévues au planning. */
export function freezerFree(d: AppData, recipeId: string, today: string, except?: MealEntry): number {
  const have = d.freezer.filter((f) => f.recipeId === recipeId).reduce((s, f) => s + f.portions, 0);
  const planned = d.meals.filter(
    (m) => m !== except && m.recipeId === recipeId && m.date >= today && (m.status === 'prévu' || m.status === 'préparé') &&
      (m.source === 'stock' || (m.source === 'batch' && m.storage === 'freezer' && !!d.weeks[weekStart(m.date)]?.batchDone))
  ).length;
  return have - planned;
}

