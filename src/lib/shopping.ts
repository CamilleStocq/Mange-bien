import type { Aisle, AppData, IngredientLine, MealEntry, Recipe, Unit, WeekMeta, WeighState } from '../store/types';
import { AISLE_ORDER, ingredientKey, lineCost, lineKey, purchaseQty, recipeCost } from './units';
import { isActive, mealsOfWeek } from './planning';

export interface AggLine {
  key: string;
  name: string;
  unit: Unit;
  qty: number;
  states: WeighState[];
  aisle: Aisle;
  usedIn: string[];
}

/** Portions totales par recette pour un ensemble de repas (chaque repas est compté une seule fois). */
export function portionsByRecipe(meals: MealEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of meals) {
    if (m.kind !== 'recipe' || !m.recipeId || !isActive(m)) continue;
    if (m.source === 'stock' || m.source === 'leftover') continue;
    out.set(m.recipeId, (out.get(m.recipeId) ?? 0) + m.portions);
  }
  return out;
}

function addLine(map: Map<string, AggLine>, ing: { name: string; qty: number; unit: Unit; state: WeighState }, factor: number, data: AppData, usedIn: string) {
  const key = lineKey(ing.name, ing.unit);
  const info = data.ingredients[ingredientKey(ing.name)];
  const existing = map.get(key);
  const qty = ing.qty * factor;
  if (existing) {
    existing.qty += qty;
    if (ing.state && !existing.states.includes(ing.state)) existing.states.push(ing.state);
    if (!existing.usedIn.includes(usedIn)) existing.usedIn.push(usedIn);
  } else {
    map.set(key, {
      key,
      name: info?.name ?? ing.name,
      unit: ing.unit,
      qty,
      states: ing.state ? [ing.state] : [],
      aisle: info?.aisle ?? 'autres',
      usedIn: [usedIn]
    });
  }
}

/** Additionne les ingrédients de recettes mises à l'échelle (portions / portions de la recette). */
export function aggregateRecipes(portions: Map<string, number>, recipes: Recipe[], data: AppData, filter?: (i: IngredientLine) => boolean): Map<string, AggLine> {
  const map = new Map<string, AggLine>();
  for (const [recipeId, p] of portions) {
    const r = recipes.find((x) => x.id === recipeId);
    if (!r) continue;
    const factor = p / Math.max(1, r.servings);
    for (const ing of r.ingredients) if (!filter || filter(ing)) addLine(map, ing, factor, data, r.name);
  }
  return map;
}

export interface ShoppingItem extends AggLine {
  needed: number; // après déduction du stock
  owned: number | 'all';
  buy: number; // arrondi pour les pièces
  estCost?: number;
  checked: boolean;
  realPrice?: number;
}

export interface ShoppingList {
  monday: string;
  items: ShoppingItem[];
  byAisle: { aisle: Aisle; items: ShoppingItem[] }[];
  manual: AppData['weeks'][string]['manualItems'];
  estimated: number;
  missingPrices: number;
  realSum: number;
  realTotal?: number;
  budget?: number;
}

export function weekMeta(data: AppData, monday: string): WeekMeta {
  return data.weeks[monday] ?? { batchChecks: {}, shoppingChecks: {}, manualItems: [], realPrices: {}, extraPortions: {} };
}

/** Liste de courses d'une semaine : repas prévus (y compris batch) + petits-déjeuners, moins le stock. */
export function buildShoppingList(data: AppData, monday: string): ShoppingList {
  const meals = mealsOfWeek(data.meals, monday).filter(isActive);
  const meta = weekMeta(data, monday);
  const portions = portionsByRecipe(meals);
  for (const [id, n] of Object.entries(meta.extraPortions ?? {})) if (n > 0) portions.set(id, (portions.get(id) ?? 0) + n);
  const map = aggregateRecipes(portions, data.recipes, data);
  const breakfasts = meals.filter((m) => m.kind === 'breakfast').reduce((s, m) => s + m.portions, 0);
  if (breakfasts) for (const b of data.breakfast) addLine(map, b, breakfasts, data, 'Petit-déjeuner');

  const items: ShoppingItem[] = [];
  let estimated = 0;
  let missingPrices = 0;
  for (const line of map.values()) {
    const pantry = data.pantry[ingredientKey(line.name)];
    const owned: number | 'all' = pantry?.all ? 'all' : pantry?.qty ?? 0;
    const needed = owned === 'all' ? 0 : Math.max(0, line.qty - owned);
    const buy = needed > 0 ? purchaseQty(needed, line.unit) : 0;
    const estCost = needed > 0 ? lineCost(data.ingredients[ingredientKey(line.name)], needed, line.unit) : 0;
    if (needed > 0) {
      if (estCost == null) missingPrices++;
      else estimated += estCost;
    }
    items.push({ ...line, needed, owned, buy, estCost, checked: !!meta.shoppingChecks[line.key], realPrice: meta.realPrices[line.key] });
  }
  for (const m of meta.manualItems) if (m.price) estimated += m.price;
  items.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const byAisle = AISLE_ORDER.map((aisle) => ({ aisle, items: items.filter((i) => i.aisle === aisle) })).filter((g) => g.items.length);
  const realSum = items.reduce((s, i) => s + (i.realPrice ?? 0), 0);
  return { monday, items, byAisle, manual: meta.manualItems, estimated, missingPrices, realSum, realTotal: meta.realTotal, budget: data.weeklyBudget };
}

export interface BudgetSuggestion {
  kind: 'swap' | 'freezer' | 'common' | 'info';
  text: string;
  saving?: number;
  from?: string;
  to?: string;
}

/**
 * Pistes si l'estimation dépasse le budget. On ne réduit JAMAIS les portions :
 * on propose des recettes équivalentes moins chères, le stock du congélateur et les ingrédients communs.
 */
export function budgetSuggestions(data: AppData, list: ShoppingList): BudgetSuggestion[] {
  if (!list.budget) return [];
  const over = list.estimated - list.budget;
  if (over <= 0) return [];
  const out: BudgetSuggestion[] = [];
  const meals = mealsOfWeek(data.meals, list.monday).filter(isActive);
  const portions = portionsByRecipe(meals);
  const cost = (r: Recipe) => recipeCost(r, data.ingredients).perPortion;
  const planned = [...portions.entries()]
    .map(([id, p]) => ({ r: data.recipes.find((x) => x.id === id)!, p }))
    .filter((x) => x.r)
    .sort((a, b) => cost(b.r) * b.p - cost(a.r) * a.p);
  const usedIds = new Set(portions.keys());
  for (const { r, p } of planned.slice(0, 3)) {
    const alt = data.recipes
      .filter((x) => !usedIds.has(x.id) && x.batchMode === r.batchMode && cost(x) < cost(r) * 0.85)
      .sort((a, b) => cost(a) - cost(b))[0];
    if (alt) {
      out.push({ kind: 'swap', from: r.id, to: alt.id, saving: (cost(r) - cost(alt)) * p, text: `Remplacer « ${r.name} » par « ${alt.name} » (une de tes recettes).` });
    }
  }
  const stock = data.freezer.filter((f) => f.portions > 0);
  if (stock.length) {
    out.push({ kind: 'freezer', text: `Tu as ${stock.reduce((s, f) => s + f.portions, 0)} portion(s) au congélateur : en utiliser une ou deux à la place d’un repas prévu évite de racheter ces ingrédients.` });
  } else {
    out.push({ kind: 'freezer', text: 'Quand une recette de batch est économique, cuisine 2 portions de plus et congèle-les : elles remplaceront un repas plus cher une prochaine semaine.' });
  }
  const single = list.items.filter((i) => i.needed > 0 && i.usedIn.length === 1 && (i.estCost ?? 0) > 3);
  if (single.length) {
    out.push({ kind: 'common', text: `Ingrédients achetés pour une seule recette : ${single.slice(0, 4).map((i) => i.name).join(', ')}. Choisir des recettes qui les partagent limite les achats.` });
  }
  out.push({ kind: 'info', text: 'Les portions ne sont pas réduites pour tenir le budget : tes besoins passent avant.' });
  return out;
}
