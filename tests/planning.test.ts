import { describe, expect, it } from 'vitest';
import { generateWeek, mealsOfWeek, refreshStorage, storageFor } from '../src/lib/planning';
import { defaultRecipes } from '../src/data/recipes';
import { ingredientKey } from '../src/lib/units';
import { fresh, MONDAY } from './helpers';
import { addDays } from '../src/lib/dates';

describe('bibliothèque de recettes', () => {
  it('contient les 47 recettes de la liste, sans doublon', () => {
    const r = defaultRecipes();
    expect(r.length).toBe(47);
    expect(new Set(r.map((x) => x.id)).size).toBe(47);
    expect(new Set(r.map((x) => ingredientKey(x.name))).size).toBe(47);
    expect(r.filter((x) => x.name === 'Salade grecque')[0].categories).toEqual(['salade']);
    expect(r.find((x) => x.id === 'paella')!.categories).toEqual(['mijote']);
    // quantités des livres : confirmées ; les autres restent provisoires
    expect(r.find((x) => x.id === 'moussaka')!.provisional).toBe(false);
    expect(r.find((x) => x.id === 'moussaka')!.ingredients.find((i) => i.name === 'haché de bœuf')!.qty).toBe(400);
    expect(r.find((x) => x.id === 'ratatouille')!.provisional).toBe(true);
    for (const x of r) expect(x.steps.length, x.name).toBeGreaterThan(0);
  });

  it('chaque ingrédient a un prix et un rayon dans le catalogue', () => {
    const d = fresh();
    for (const r of d.recipes) for (const i of r.ingredients) expect(d.ingredients[ingredientKey(i.name)], i.name).toBeTruthy();
  });
});

describe('génération de la semaine', () => {
  const d = fresh();
  const { meals, rotation } = generateWeek(d, MONDAY);

  it('petit-déjeuner chaque jour, déjeuner et dîner chaque jour', () => {
    for (let i = 0; i < 7; i++) {
      const day = addDays(MONDAY, i);
      expect(meals.filter((m) => m.date === day && m.slot === 'breakfast' && m.kind === 'breakfast')).toHaveLength(1);
      expect(meals.filter((m) => m.date === day && m.slot === 'lunch')).toHaveLength(1);
      expect(meals.filter((m) => m.date === day && m.slot === 'dinner')).toHaveLength(1);
    }
    expect(rotation).toBe(1);
  });

  it('n’utilise que des recettes de la bibliothèque', () => {
    const ids = new Set(d.recipes.map((r) => r.id));
    for (const m of meals.filter((x) => x.kind === 'recipe')) expect(ids.has(m.recipeId!)).toBe(true);
  });

  it('samedi soir = restaurant, sans repas à compenser', () => {
    const sat = meals.find((m) => m.date === addDays(MONDAY, 5) && m.slot === 'dinner')!;
    expect(sat.kind).toBe('restaurant');
  });

  it('collation facultative uniquement les jours de coaching', () => {
    const snackDays = meals.filter((m) => m.slot === 'snack').map((m) => m.date);
    expect(snackDays).toEqual([addDays(MONDAY, 1), addDays(MONDAY, 2), addDays(MONDAY, 4)]);
  });

  it('portions batch au frigo jusqu’à 3 jours, puis au congélateur', () => {
    for (const m of meals.filter((x) => x.source === 'batch')) {
      const r = d.recipes.find((x) => x.id === m.recipeId)!;
      const daysAfterSunday = (Date.parse(m.date) - Date.parse('2026-10-18')) / 86_400_000;
      if (daysAfterSunday > Math.min(3, r.fridgeDays)) expect(m.storage).toBe('freezer');
      else expect(m.storage).toBe('fridge');
    }
    expect(meals.some((m) => m.storage === 'freezer')).toBe(true);
  });

  it('riz : jamais plus de 24 h au frigo', () => {
    const riz = d.recipes.find((r) => r.id === 'riz-cantonais')!;
    expect(storageFor(riz, MONDAY, addDays(MONDAY, 0), 3).storage).toBe('fridge');
    expect(storageFor(riz, MONDAY, addDays(MONDAY, 1), 3).storage).toBe('freezer');
  });

  it('plat non congelable au-delà du frigo → cuisiné frais', () => {
    const kedgeree = d.recipes.find((r) => r.id === 'kedgeree')!;
    expect(storageFor(kedgeree, MONDAY, addDays(MONDAY, 4), 3).source).toBe('fresh');
  });

  it('la rotation fait varier les recettes d’une semaine à l’autre', () => {
    const d2 = fresh();
    d2.rotation = 1;
    const a = new Set(meals.filter((m) => m.source === 'batch').map((m) => m.recipeId));
    const b = new Set(generateWeek(d2, addDays(MONDAY, 7)).meals.filter((m) => m.source === 'batch').map((m) => m.recipeId));
    expect([...a].some((x) => !b.has(x))).toBe(true);
  });

  it('déplacer un repas batch recalcule frigo / congélateur', () => {
    const m = meals.find((x) => x.source === 'batch' && x.storage === 'fridge')!;
    const r = d.recipes.find((x) => x.id === m.recipeId)!;
    const moved = refreshStorage({ ...m, date: addDays(MONDAY, 4) }, r, 3);
    expect(moved.storage).toBe(r.freezable ? 'freezer' : undefined);
  });

  it('mealsOfWeek ne déborde pas sur la semaine suivante', () => {
    const all = [...meals, ...generateWeek(d, addDays(MONDAY, 7)).meals];
    expect(mealsOfWeek(all, MONDAY)).toHaveLength(meals.length);
  });
});
