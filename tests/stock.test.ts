import { describe, expect, it } from 'vitest';
import { buildShoppingList, homeStock, weekNeeds } from '../src/lib/shopping';
import { markLow, recordPurchase } from '../src/lib/stock';
import { ensureWeekIn } from './stock-helpers';
import { addDays } from '../src/lib/dates';
import { fresh, meal, MONDAY } from './helpers';

const NEXT = addDays(MONDAY, 7);
const AFTER = addDays(MONDAY, 14);

function withMeals() {
  const d = fresh();
  d.meals = [];
  d.breakfast = [];
  d.meals.push(meal(d, { date: MONDAY, slot: 'dinner', recipeId: 'chili', source: 'fresh', portions: 2 }));
  d.meals.push(meal(d, { date: NEXT, slot: 'dinner', recipeId: 'chili', source: 'fresh', portions: 2 }));
  return d;
}

describe('surplus des courses', () => {
  it('le reste du format acheté est déduit de la liste de la semaine suivante', () => {
    const d = withMeals();
    const oignon = buildShoppingList(d, MONDAY).items.find((i) => i.name === 'oignon')!;
    expect(oignon.buy).toBe(2000); // filet de 2 kg pour 80 g
    ensureWeekIn(d, MONDAY);
    recordPurchase(d, MONDAY, 'oignon', true, oignon.buy - oignon.needed);
    const next = buildShoppingList(d, NEXT).items.find((i) => i.name === 'oignon')!;
    expect(next.owned).toBeCloseTo(1920);
    expect(next.needed).toBe(0);
    // décocher annule le surplus
    recordPurchase(d, MONDAY, 'oignon', false, 0);
    expect(buildShoppingList(d, NEXT).items.find((i) => i.name === 'oignon')!.needed).toBeGreaterThan(0);
  });

  it('le stock diminue au fil des repas des semaines intermédiaires', () => {
    const d = withMeals();
    ensureWeekIn(d, MONDAY);
    d.weeks[MONDAY].surplus = { oignon: 100 };
    expect(homeStock(d, NEXT).get('oignon')).toBeCloseTo(100);
    // la semaine NEXT utilise 80 g d'oignon → il en reste 20 g pour la semaine d'après
    expect(weekNeeds(d, NEXT).get('oignon')).toBeCloseTo(80);
    expect(homeStock(d, AFTER).get('oignon')).toBeCloseTo(20);
  });

  it('le frais ne se garde qu’une semaine', () => {
    const d = withMeals();
    ensureWeekIn(d, MONDAY);
    d.weeks[MONDAY].surplus = { 'haché de boeuf': 300, poivron: 100 };
    d.meals = [];
    expect(homeStock(d, NEXT).get('hache de boeuf')).toBeUndefined(); // clé inconnue : rien
    d.weeks[MONDAY].surplus = { 'hache de boeuf': 300 };
    expect(homeStock(d, NEXT).get('hache de boeuf')).toBe(300);
    expect(homeStock(d, AFTER).get('hache de boeuf')).toBeUndefined();
  });
});

describe('placard', () => {
  it('un basique acheté ne revient plus, jusqu’à « presque fini »', () => {
    const d = withMeals();
    ensureWeekIn(d, MONDAY);
    const huile = () => buildShoppingList(d, NEXT).items.find((i) => i.name === "huile d'olive")!;
    expect(huile().needed).toBeGreaterThan(0);
    recordPurchase(d, MONDAY, "huile d'olive", true, 0);
    expect(buildShoppingList(d, MONDAY).items.find((i) => i.name === "huile d'olive")!.needed).toBeGreaterThan(0); // la liste en cours ne bouge pas
    expect(huile().owned).toBe('all');
    markLow(d, "huile d'olive");
    expect(huile().needed).toBeGreaterThan(0);
  });
});
