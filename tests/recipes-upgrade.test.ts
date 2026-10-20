import { describe, expect, it } from 'vitest';
import { migrate } from '../src/data/defaults';
import { defaultRecipes } from '../src/data/recipes';
import { defaultRecipes as recipesV3 } from './legacy-recipes-v3';
import { ingredientKey } from '../src/lib/units';

/** Données enregistrées en version 3, avec la bibliothèque d'alors. */
function v3Data(edit?: (r: ReturnType<typeof recipesV3>) => void, extra: Record<string, unknown> = {}) {
  const recipes = recipesV3();
  edit?.(recipes);
  return { version: 3, recipes, ingredients: {}, meals: [], freezer: [], ...extra };
}

describe('mise à jour de la bibliothèque (version 4)', () => {
  it('recettes jamais modifiées : remplacées par la nouvelle liste de 47', () => {
    const d = migrate(v3Data());
    expect(d.recipes.map((r) => r.id).sort()).toEqual(defaultRecipes().map((r) => r.id).sort());
    expect(d.recipes.find((r) => r.id === 'moussaka')!.servings).toBe(4);
    expect(d.recipes.find((r) => r.id === 'colin-gratin')!.name).toBe('Gratin de courgettes et haddock');
  });

  it('chaque ingrédient des recettes est ajouté au catalogue existant', () => {
    const d = migrate(v3Data());
    for (const r of d.recipes) for (const i of r.ingredients) expect(d.ingredients[ingredientKey(i.name)], i.name).toBeTruthy();
  });

  it('une recette modifiée à la main est gardée telle quelle', () => {
    const d = migrate(v3Data((rs) => { rs.find((r) => r.id === 'moussaka')!.steps.push('Ma touche perso'); }));
    const m = d.recipes.find((r) => r.id === 'moussaka')!;
    expect(m.steps).toContain('Ma touche perso');
    expect(d.recipes.filter((r) => ingredientKey(r.name) === 'moussaka')).toHaveLength(1);
  });

  it('photo conservée lors du remplacement', () => {
    const d = migrate(v3Data((rs) => { rs.find((r) => r.id === 'chili')!.photo = 'data:image/jpeg;base64,xx'; }));
    expect(d.recipes.find((r) => r.id === 'chili')!.photo).toBe('data:image/jpeg;base64,xx');
  });

  it('ancienne recette retirée de la liste : gardée si elle est encore planifiée', () => {
    const d = migrate(v3Data(undefined, { meals: [{ id: 'm', date: '2026-10-20', slot: 'dinner', kind: 'recipe', recipeId: 'minestrone' }] }));
    expect(d.recipes.some((r) => r.id === 'minestrone')).toBe(true);
    expect(d.recipes.some((r) => r.id === 'pates-pesto')).toBe(false);
  });

  it('recette créée par l’utilisatrice : conservée, et pas de doublon de nom', () => {
    const d = migrate(v3Data((rs) => { rs.push({ ...rs[0], id: 'perso', name: 'Ratatouille', ingredients: [], steps: ['à ma façon'] }); }));
    expect(d.recipes.filter((r) => ingredientKey(r.name) === 'ratatouille')).toHaveLength(1);
    expect(d.recipes.find((r) => ingredientKey(r.name) === 'ratatouille')!.id).toBe('perso');
  });

  it('anciennes catégories converties : pâtes, soupes, salades, riz, mijotés, autres', () => {
    const d = migrate(v3Data((rs) => {
      rs.push({ ...rs[0], id: 'p1', name: 'Pâtes au thon', categories: ['plat' as never] });
      rs.push({ ...rs[0], id: 'p2', name: 'Velouté de potiron', categories: ['vegetarien' as never] });
      rs.push({ ...rs[0], id: 'p3', name: 'Quiche lorraine', categories: ['plat' as never] });
    }));
    expect(d.recipes.find((r) => r.id === 'p1')!.categories).toEqual(['pates']);
    expect(d.recipes.find((r) => r.id === 'p2')!.categories).toEqual(['soupe']);
    expect(d.recipes.find((r) => r.id === 'p3')!.categories).toEqual(['autre']);
    expect(d.recipes.find((r) => r.id === 'couscous')!.categories).toEqual(['mijote']);
  });
});
