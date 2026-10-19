import { describe, expect, it } from 'vitest';
import { createDefaultData, migrate } from '../src/data/defaults';
import { ingredientKey } from '../src/lib/units';

describe('prix Colruyt (données version 2)', () => {
  it('remplace les prix restés aux estimations de départ et garde ceux modifiés à la main', () => {
    const old = createDefaultData();
    old.version = 1;
    const pates = ingredientKey('pâtes');
    const oeuf = ingredientKey('œuf');
    old.ingredients[pates].price = 1.8; // estimation de départ, jamais modifiée
    old.ingredients[oeuf].price = 0.42; // prix saisi à la main
    const d = migrate(structuredClone(old));
    expect(d.ingredients[pates].price).toBe(0.9);
    expect(d.ingredients[oeuf].price).toBe(0.42);
    expect(d.version).toBe(2);
  });

  it('ne retouche pas des données déjà en version 2', () => {
    const cur = createDefaultData();
    const pates = ingredientKey('pâtes');
    cur.ingredients[pates].price = 1.8;
    expect(migrate(structuredClone(cur)).ingredients[pates].price).toBe(1.8);
  });
});
