import type { Aisle, IngredientInfo, Recipe, Unit, WeighState } from '../store/types';

/** Clé de regroupement d'un ingrédient : minuscules, sans accents ni espaces superflus. */
export function ingredientKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clé de ligne de courses : un même ingrédient peut exister en g et en pièces, on ne les additionne pas. */
export function lineKey(name: string, unit: Unit): string {
  return `${ingredientKey(name)}|${unit}`;
}

export const STATE_LABEL: Record<WeighState, string> = {
  '': '',
  cru: 'poids cru',
  sec: 'poids sec',
  cuit: 'poids cuit',
  'égoutté': 'poids égoutté',
  comestible: 'partie comestible'
};

export const AISLE_LABEL: Record<Aisle, string> = {
  'fruits-legumes': 'Fruits & légumes frais',
  feculents: 'Féculents',
  proteines: 'Protéines (viande, poisson, œufs)',
  laitiers: 'Produits laitiers',
  conserves: 'Conserves & bocaux',
  surgeles: 'Surgelés',
  epicerie: 'Épicerie & condiments',
  autres: 'Autres produits'
};

export const AISLE_ORDER: Aisle[] = ['fruits-legumes', 'proteines', 'laitiers', 'feculents', 'conserves', 'surgeles', 'epicerie', 'autres'];

function roundSmart(q: number): number {
  if (q < 10) return Math.round(q * 2) / 2;
  if (q < 100) return Math.round(q);
  return Math.round(q / 5) * 5;
}

const nf1 = new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 2 });

export function formatNumber(n: number, digits = 1): string {
  return (digits === 2 ? nf2 : nf1).format(n);
}

function formatPieces(q: number): string {
  const whole = Math.floor(q + 1e-9);
  const frac = q - whole;
  const fracStr = Math.abs(frac - 0.25) < 0.07 ? '¼' : Math.abs(frac - 0.5) < 0.07 ? '½' : Math.abs(frac - 0.75) < 0.07 ? '¾' : '';
  if (frac < 0.07) return String(whole);
  if (fracStr) return whole ? `${whole} ${fracStr}` : fracStr;
  return nf1.format(q);
}

export function formatQty(qty: number, unit: Unit, liquid: 'ml' | 'auto' = 'auto'): string {
  if (unit === 'pièce') {
    const s = formatPieces(qty);
    return `${s} pièce${qty > 1 ? 's' : ''}`;
  }
  const r = roundSmart(qty);
  if (unit === 'g') return r >= 2000 ? `${nf2.format(r / 1000)} kg` : `${nf1.format(r)} g`;
  if (liquid === 'auto' && r >= 1000) return `${nf2.format(r / 1000)} L`;
  return `${nf1.format(r)} ml`;
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(n);
}

/** Quantité à acheter : on arrondit les pièces à l'unité supérieure. */
export function purchaseQty(qty: number, unit: Unit): number {
  return unit === 'pièce' ? Math.ceil(qty - 1e-9) : qty;
}

/** Coût estimé, proportionnel à la quantité utilisée. undefined si aucun prix connu. */
export function lineCost(info: IngredientInfo | undefined, qty: number, unit: Unit): number | undefined {
  if (!info || info.price == null) return undefined;
  return unit === 'pièce' ? info.price * qty : (info.price * qty) / 1000;
}

export function priceUnitLabel(unit: Unit): string {
  return unit === 'g' ? '€/kg' : unit === 'ml' ? '€/L' : '€/pièce';
}

export interface RecipeCost {
  total: number;
  perPortion: number;
  missing: string[];
  manual: boolean;
}

export function recipeCost(recipe: Recipe, catalog: Record<string, IngredientInfo>): RecipeCost {
  if (recipe.manualCost != null && recipe.manualCost > 0) {
    return { total: recipe.manualCost, perPortion: recipe.manualCost / Math.max(1, recipe.servings), missing: [], manual: true };
  }
  let total = 0;
  const missing: string[] = [];
  for (const ing of recipe.ingredients) {
    const c = lineCost(catalog[ingredientKey(ing.name)], ing.qty, ing.unit);
    if (c == null) missing.push(ing.name);
    else total += c;
  }
  return { total, perPortion: total / Math.max(1, recipe.servings), missing, manual: false };
}

export interface NutritionEstimate {
  kcal: number;
  protein: number;
  complete: boolean;
  manual: boolean;
}

/** Repères nutritionnels approximatifs par portion. */
export function recipeNutrition(recipe: Recipe, catalog: Record<string, IngredientInfo>): NutritionEstimate {
  if (recipe.nutrition?.kcal) {
    return { kcal: recipe.nutrition.kcal, protein: recipe.nutrition.protein ?? 0, complete: true, manual: true };
  }
  let kcal = 0;
  let protein = 0;
  let complete = true;
  for (const ing of recipe.ingredients) {
    const info = catalog[ingredientKey(ing.name)];
    if (!info || info.kcal == null) {
      complete = false;
      continue;
    }
    const factor = ing.unit === 'pièce' ? ing.qty : ing.qty / 100;
    kcal += info.kcal * factor;
    protein += (info.protein ?? 0) * factor;
  }
  const s = Math.max(1, recipe.servings);
  return { kcal: kcal / s, protein: protein / s, complete, manual: false };
}
