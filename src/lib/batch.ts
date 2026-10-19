import type { AppData, MealEntry, MealSlot, Recipe } from '../store/types';
import { addDays, diffDays, formatShort } from './dates';
import { batchDayFor, isActive, mealsOfWeek, SLOT_LABEL } from './planning';
import { aggregateRecipes, type AggLine, weekMeta } from './shopping';
import { formatQty, ingredientKey } from './units';

export interface BatchRecipe {
  recipe: Recipe;
  planned: number;
  extra: number;
  total: number;
  fridge: MealEntry[];
  freezer: MealEntry[];
}

export interface DefrostTask {
  id: string;
  mealDate: string;
  slot: MealSlot;
  label: string;
  /** Jour où sortir la portion (la veille, au frigo) */
  on: string;
}

export interface BatchStep {
  id: string;
  title: string;
  detail?: string;
  minutes: number;
  group: 'setup' | 'prep' | 'cook' | 'accomp' | 'prepOnly' | 'fresh' | 'portion' | 'end';
}

export interface BatchPlan {
  monday: string;
  batchDay: string;
  cookFull: BatchRecipe[];
  prepOnly: { recipe: Recipe; meals: MealEntry[] }[];
  totals: AggLine[];
  accompaniments: (AggLine & { tip: string })[];
  defrost: DefrostTask[];
  freshPrep: { id: string; text: string; mealDate: string }[];
  steps: BatchStep[];
  durationMin: number;
  fridgeCount: number;
  freezerCount: number;
  empty: boolean;
}

export const SAFETY_RULES = [
  'Refroidir vite : répartir les plats dans des boîtes peu profondes et les mettre au frigo dans les 2 heures (1 heure pour le riz).',
  'Frigo à 4 °C maximum. Plats cuisinés : 3 jours maximum ; riz cuit : 24 heures.',
  'Étiqueter chaque boîte : nom du plat + date de préparation.',
  'Décongeler au réfrigérateur (la veille), jamais à température ambiante.',
  'Réchauffer une seule fois, jusqu’à ce que ce soit bien chaud à cœur (fumant).',
  'Ne pas recongeler un plat décongelé.'
];

export function accompanimentTip(name: string): string {
  const k = ingredientKey(name);
  if (k.includes('riz')) return 'Cuire, refroidir en moins d’1 h, frigo 24 h max ; sinon cuire le jour même ou congeler en portions.';
  if (k.includes('pates') || k.includes('semoule')) return 'Plus agréable cuit le jour même (5 à 12 min). Peser la quantité sèche à l’avance.';
  if (k.includes('pommes de terre') || k.includes('lait') || k.includes('beurre')) return 'Purée : se prépare le dimanche, frigo 3 jours, se congèle bien.';
  if (k.includes('salade') || k.includes('laitue')) return 'Laver, bien essorer, boîte fermée avec un essuie-tout : 3 jours au frigo. Assaisonner au moment.';
  if (k.includes('pain')) return 'Congeler en tranches, sortir le matin même.';
  return 'À préparer en même temps que le plat ou le jour même.';
}

export function buildBatchPlan(data: AppData, monday: string): BatchPlan {
  const batchDay = batchDayFor(monday);
  const meta = weekMeta(data, monday);
  const meals = mealsOfWeek(data.meals, monday).filter(isActive);
  const recipeById = new Map(data.recipes.map((r) => [r.id, r]));
  const byRecipe = new Map<string, MealEntry[]>();
  for (const m of meals) {
    if (m.kind !== 'recipe' || !m.recipeId || m.source !== 'batch') continue;
    if (!byRecipe.has(m.recipeId)) byRecipe.set(m.recipeId, []);
    byRecipe.get(m.recipeId)!.push(m);
  }
  for (const [id, n] of Object.entries(meta.extraPortions ?? {})) if (n > 0 && !byRecipe.has(id)) byRecipe.set(id, []);

  const cookFull: BatchRecipe[] = [];
  const prepOnly: { recipe: Recipe; meals: MealEntry[] }[] = [];
  for (const [id, ms] of byRecipe) {
    const recipe = recipeById.get(id);
    if (!recipe) continue;
    const sorted = [...ms].sort((a, b) => a.date.localeCompare(b.date));
    if (recipe.batchMode === 'prep') {
      prepOnly.push({ recipe, meals: sorted });
      continue;
    }
    const planned = sorted.reduce((s, m) => s + m.portions, 0);
    const extra = meta.extraPortions?.[id] ?? 0;
    cookFull.push({
      recipe,
      planned,
      extra,
      total: planned + extra,
      fridge: sorted.filter((m) => m.storage !== 'freezer'),
      freezer: sorted.filter((m) => m.storage === 'freezer')
    });
  }
  cookFull.sort((a, b) => b.recipe.cookMin - a.recipe.cookMin);

  const portions = new Map(cookFull.map((c) => [c.recipe.id, c.total] as [string, number]));
  for (const p of prepOnly) portions.set(p.recipe.id, p.meals.reduce((s, m) => s + m.portions, 0));
  const totals = [...aggregateRecipes(portions, data.recipes, data, (i) => !i.accomp).values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const accompaniments = [...aggregateRecipes(new Map(cookFull.map((c) => [c.recipe.id, c.total])), data.recipes, data, (i) => !!i.accomp).values()].map((a) => ({
    ...a,
    tip: accompanimentTip(a.name)
  }));

  const defrost: DefrostTask[] = [];
  for (const c of cookFull) {
    for (const m of c.freezer) {
      defrost.push({ id: `defrost:${m.id}`, mealDate: m.date, slot: m.slot, label: c.recipe.name, on: addDays(m.date, -1) });
    }
  }

  // Repas frais de fin de semaine : congeler la viande / le poisson cru achetés le week-end.
  const freshPrep: { id: string; text: string; mealDate: string }[] = [];
  for (const m of meals) {
    if (m.kind !== 'recipe' || m.source !== 'fresh' || !m.recipeId) continue;
    const r = recipeById.get(m.recipeId);
    if (!r || diffDays(m.date, batchDay) < 3) continue;
    const factor = m.portions / Math.max(1, r.servings);
    for (const ing of r.ingredients) {
      const info = data.ingredients[ingredientKey(ing.name)];
      if (info?.aisle === 'proteines' && ing.state === 'cru') {
        freshPrep.push({
          id: `fresh:${m.id}:${ingredientKey(ing.name)}`,
          mealDate: m.date,
          text: `Portionner et congeler ${formatQty(ing.qty * factor, ing.unit)} de ${ing.name} (cru) pour « ${r.name} » — ${formatShort(m.date)}.`
        });
        defrost.push({ id: `defrost:${m.id}:${ingredientKey(ing.name)}`, mealDate: m.date, slot: m.slot, label: `${ing.name} (cru) pour ${r.name}`, on: addDays(m.date, -1) });
      }
    }
  }
  defrost.sort((a, b) => a.on.localeCompare(b.on));

  // Ordre conseillé
  const steps: BatchStep[] = [];
  const scale = (c: BatchRecipe) => c.total / Math.max(1, c.recipe.servings);
  const hasOven = cookFull.some((c) => /four|gratin|°C/i.test(c.recipe.steps.join(' ')));
  steps.push({ id: 'setup', group: 'setup', minutes: 10, title: 'Installer la cuisine', detail: `Sortir boîtes et étiquettes, faire de la place au frigo et au congélateur${hasOven ? ', préchauffer le four' : ''}.` });
  const veg = totals.filter((t) => t.aisle === 'fruits-legumes');
  if (veg.length) {
    const vegMin = Math.round(Math.min(45, 5 + veg.length * 3));
    steps.push({ id: 'veg', group: 'prep', minutes: vegMin, title: 'Laver, éplucher et couper tous les légumes en une fois', detail: veg.map((v) => `${v.name} : ${formatQty(v.qty, v.unit)}`).join(' · ') });
  }
  let handsOn = 0;
  for (const c of cookFull) {
    const min = Math.round(c.recipe.prepMin * (0.6 + 0.2 * Math.max(0, scale(c) - 1)));
    handsOn += min;
    steps.push({
      id: `cook:${c.recipe.id}`,
      group: 'cook',
      minutes: min,
      title: `Lancer « ${c.recipe.name} » — ${c.total} portion${c.total > 1 ? 's' : ''}`,
      detail: `Cuisson ~${c.recipe.cookMin} min. ${c.recipe.steps[0] ?? ''}`
    });
  }
  if (accompaniments.length) {
    steps.push({ id: 'accomp', group: 'accomp', minutes: 15, title: 'Pendant les cuissons : accompagnements', detail: accompaniments.map((a) => `${a.name} ${formatQty(a.qty, a.unit)}`).join(' · ') });
  }
  for (const p of prepOnly) {
    steps.push({ id: `prep:${p.recipe.id}`, group: 'prepOnly', minutes: Math.round(p.recipe.prepMin * 0.5), title: `Préparer seulement : ${p.recipe.name}`, detail: `Laver / couper / préportionner, cuisson le jour même. ${p.recipe.storageNotes}` });
  }
  for (const f of freshPrep) steps.push({ id: f.id, group: 'fresh', minutes: 3, title: f.text });
  steps.push({ id: 'cool', group: 'portion', minutes: 10, title: 'Refroidir rapidement', detail: 'Boîtes peu profondes, couvercle entrouvert, au frigo dans les 2 h (1 h pour le riz).' });
  for (const c of cookFull) {
    const fr = c.fridge.reduce((s, m) => s + m.portions, 0);
    const fz = c.freezer.reduce((s, m) => s + m.portions, 0) + c.extra;
    steps.push({
      id: `portion:${c.recipe.id}`,
      group: 'portion',
      minutes: 5,
      title: `Portionner « ${c.recipe.name} »`,
      detail: [fr ? `${fr} au frigo` : '', fz ? `${fz} au congélateur${c.extra ? ` (dont ${c.extra} en plus pour le stock)` : ''}` : ''].filter(Boolean).join(' · ') + ' — étiqueter nom + date.'
    });
  }
  steps.push({ id: 'end', group: 'end', minutes: 10, title: 'Ranger, nettoyer et vérifier le frigo', detail: 'Coche ce qui est prêt : les repas de la semaine passeront à « préparé ».' });

  const maxCook = Math.max(0, ...cookFull.map((c) => c.recipe.cookMin));
  const prepTotal = steps.filter((s) => s.group !== 'cook').reduce((s, x) => s + x.minutes, 0);
  const durationMin = cookFull.length || prepOnly.length || freshPrep.length ? Math.round(prepTotal + handsOn + Math.max(0, maxCook - handsOn * 0.5)) : 0;

  const fridgeCount = cookFull.reduce((s, c) => s + c.fridge.reduce((a, m) => a + m.portions, 0), 0);
  const freezerCount = cookFull.reduce((s, c) => s + c.freezer.reduce((a, m) => a + m.portions, 0) + c.extra, 0);

  return {
    monday,
    batchDay,
    cookFull,
    prepOnly,
    totals,
    accompaniments,
    defrost,
    freshPrep,
    steps,
    durationMin,
    fridgeCount,
    freezerCount,
    empty: !cookFull.length && !prepOnly.length && !freshPrep.length
  };
}

export function slotWhen(m: MealEntry): string {
  return `${formatShort(m.date)} · ${SLOT_LABEL[m.slot].toLowerCase()}`;
}
