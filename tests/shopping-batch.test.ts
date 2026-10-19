import { beforeEach, describe, expect, it } from 'vitest';
import type { AppData } from '../src/store/types';
import { budgetSuggestions, buildShoppingList } from '../src/lib/shopping';
import { buildBatchPlan } from '../src/lib/batch';
import { lineKey } from '../src/lib/units';
import { addDays } from '../src/lib/dates';
import { fresh, meal, MONDAY, testRecipe } from './helpers';

let d: AppData;
const item = (key: string) => buildShoppingList(d, MONDAY).items.find((i) => i.key === key);
const BEEF = lineKey('haché de bœuf', 'g');

beforeEach(() => {
  d = fresh();
  d.recipes.push(testRecipe());
  d.breakfast = [];
});

describe('liste de courses', () => {
  it('recette prévue 3 fois à 120 g/portion → 360 g, une seule ligne', () => {
    for (let i = 0; i < 3; i++) d.meals.push(meal(d, { date: addDays(MONDAY, i), recipeId: 'test-recette' }));
    const lines = buildShoppingList(d, MONDAY).items.filter((i) => i.key === BEEF);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBeCloseTo(360);
  });

  it('additionne un même ingrédient venant de recettes différentes (casse, accents, œ/oe)', () => {
    d.recipes.push(testRecipe({ id: 'autre', name: 'Autre', ingredients: [{ name: 'HACHE de boeuf', qty: 200, unit: 'g', state: 'cru' }], servings: 2 }));
    d.meals.push(meal(d, { date: MONDAY, recipeId: 'test-recette' }));
    d.meals.push(meal(d, { date: MONDAY, slot: 'lunch', recipeId: 'autre' }));
    const lines = buildShoppingList(d, MONDAY).items.filter((i) => i.key === BEEF);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBeCloseTo(120 + 100);
    expect(lines[0].usedIn).toEqual(['Recette test', 'Autre']);
  });

  it('les pièces sont arrondies à l’unité supérieure à l’achat', () => {
    d.meals.push(meal(d, { date: MONDAY, recipeId: 'test-recette' })); // 0,5 œuf
    const eggs = item(lineKey('œuf', 'pièce'))!;
    expect(eggs.qty).toBeCloseTo(0.5);
    expect(eggs.buy).toBe(1);
  });

  it('supprimer un repas retire ses ingrédients sauf ceux encore utilisés ailleurs', () => {
    d.recipes.push(testRecipe({ id: 'b', name: 'B', ingredients: [{ name: 'pâtes', qty: 160, unit: 'g', state: 'sec' }], servings: 2 }));
    d.meals.push(meal(d, { id: 'x', date: MONDAY, recipeId: 'test-recette' }));
    d.meals.push(meal(d, { id: 'y', date: MONDAY, slot: 'lunch', recipeId: 'b' }));
    d.meals = d.meals.filter((m) => m.id !== 'x');
    expect(item(BEEF)).toBeUndefined();
    expect(item(lineKey('pâtes', 'g'))!.qty).toBeCloseTo(80);
  });

  it('remplacer un repas recalcule la liste', () => {
    d.recipes.push(testRecipe({ id: 'b', name: 'B', ingredients: [{ name: 'lentilles vertes', qty: 120, unit: 'g', state: 'sec' }], servings: 2 }));
    d.meals.push(meal(d, { id: 'x', date: MONDAY, recipeId: 'test-recette' }));
    d.meals[0].recipeId = 'b';
    expect(item(BEEF)).toBeUndefined();
    expect(item(lineKey('lentilles vertes', 'g'))!.qty).toBeCloseTo(60);
  });

  it('modifier une recette répercute les nouvelles quantités', () => {
    d.meals.push(meal(d, { date: MONDAY, recipeId: 'test-recette' }));
    d.recipes.find((r) => r.id === 'test-recette')!.ingredients[0].qty = 600;
    expect(item(BEEF)!.qty).toBeCloseTo(150);
  });

  it('repas remplacés, reportés, du stock ou des restes : pas de courses', () => {
    d.meals.push(meal(d, { date: MONDAY, recipeId: 'test-recette', status: 'reporté' }));
    d.meals.push(meal(d, { date: MONDAY, recipeId: 'test-recette', status: 'remplacé' }));
    d.meals.push(meal(d, { date: MONDAY, recipeId: 'test-recette', source: 'stock' }));
    d.meals.push(meal(d, { date: MONDAY, recipeId: 'test-recette', source: 'leftover' }));
    expect(item(BEEF)).toBeUndefined();
  });

  it('restaurant et repas libre ne génèrent pas de courses', () => {
    d.meals.push(meal(d, { date: MONDAY, kind: 'restaurant' }));
    expect(buildShoppingList(d, MONDAY).items).toHaveLength(0);
  });

  it('déduit le stock possédé', () => {
    d.meals.push(meal(d, { date: MONDAY, recipeId: 'test-recette', portions: 4 }));
    d.pantry['pates'] = { qty: 100 };
    d.pantry['hache de boeuf'] = { all: true };
    expect(item(lineKey('pâtes', 'g'))!.needed).toBeCloseTo(220);
    expect(item(BEEF)!.needed).toBe(0);
  });

  it('petits-déjeuners × nombre de jours', () => {
    d = fresh();
    for (let i = 0; i < 7; i++) d.meals.push(meal(d, { date: addDays(MONDAY, i), slot: 'breakfast', kind: 'breakfast', source: 'fresh' }));
    expect(item(lineKey('yaourt grec', 'g'))!.qty).toBe(1400);
    expect(item(lineKey('muesli ou granola', 'g'))!.qty).toBe(210);
  });

  it('une semaine type générée reste sous 120 € (prix indicatifs de départ)', async () => {
    const { generateWeek } = await import('../src/lib/planning');
    d = fresh();
    d.meals = generateWeek(d, MONDAY).meals;
    const list = buildShoppingList(d, MONDAY);
    expect(list.estimated).toBeGreaterThan(20);
    expect(list.estimated).toBeLessThan(120);
    expect(list.missingPrices).toBe(0);
  });

  it('budget dépassé : suggestions sans jamais réduire les portions', () => {
    d = fresh();
    d.weeklyBudget = 5;
    d.meals.push(meal(d, { date: MONDAY, recipeId: 'saumon-epinards', source: 'fresh', portions: 2 }));
    const before = JSON.stringify(d.meals);
    const s = budgetSuggestions(d, buildShoppingList(d, MONDAY));
    expect(s.length).toBeGreaterThan(0);
    expect(s.some((x) => x.kind === 'swap')).toBe(true);
    expect(JSON.stringify(d.meals)).toBe(before);
    expect(s.map((x) => x.text).join(' ')).not.toMatch(/réduire (tes|les) portions(?! ne)/);
  });
});

describe('batch cooking', () => {
  it('portions, frigo / congélateur, décongélation la veille', () => {
    // dimanche 18 → lun, mar, jeu, ven
    for (const i of [0, 1, 3, 4]) d.meals.push(meal(d, { date: addDays(MONDAY, i), recipeId: 'test-recette' }));
    const p = buildBatchPlan(d, MONDAY);
    expect(p.batchDay).toBe('2026-10-18');
    expect(p.cookFull).toHaveLength(1);
    expect(p.cookFull[0].total).toBe(4);
    expect(p.fridgeCount).toBe(2);
    expect(p.freezerCount).toBe(2);
    expect(p.defrost.map((t) => t.on)).toEqual([addDays(MONDAY, 2), addDays(MONDAY, 3)]);
    expect(p.totals.find((t) => t.key === BEEF)!.qty).toBeCloseTo(480);
    expect(p.totals.find((t) => t.name === 'pâtes')).toBeUndefined(); // accompagnement à part
    expect(p.accompaniments.find((t) => t.name === 'pâtes')!.qty).toBeCloseTo(320);
    expect(p.durationMin).toBeGreaterThan(30);
  });

  it('portions supplémentaires à congeler : ajoutées au batch ET aux courses', () => {
    d.meals.push(meal(d, { date: MONDAY, recipeId: 'test-recette' }));
    d.weeks[MONDAY] = { batchChecks: {}, shoppingChecks: {}, manualItems: [], realPrices: {}, extraPortions: { 'test-recette': 2 } };
    const p = buildBatchPlan(d, MONDAY);
    expect(p.cookFull[0].total).toBe(3);
    expect(p.freezerCount).toBe(2);
    expect(item(BEEF)!.qty).toBeCloseTo(360);
  });

  it('le remplacement d’un repas met à jour le batch', () => {
    d.meals.push(meal(d, { id: 'x', date: MONDAY, recipeId: 'test-recette' }));
    expect(buildBatchPlan(d, MONDAY).cookFull[0].recipe.id).toBe('test-recette');
    d.meals[0].recipeId = 'chili';
    expect(buildBatchPlan(d, MONDAY).cookFull[0].recipe.id).toBe('chili');
  });

  it('repas frais de fin de semaine : viande crue à congeler + rappel de décongélation', () => {
    d.meals.push(meal(d, { date: addDays(MONDAY, 3), recipeId: 'test-recette', source: 'fresh' }));
    const p = buildBatchPlan(d, MONDAY);
    expect(p.freshPrep).toHaveLength(1);
    expect(p.defrost[0].on).toBe(addDays(MONDAY, 2));
  });

  it('semaine sans batch : plan vide', () => {
    expect(buildBatchPlan(d, MONDAY).empty).toBe(true);
  });
});
