import type { Aisle, IngredientInfo } from '../store/types';
import { ingredientKey } from '../lib/units';

// Catalogue de départ. Les prix sont des ESTIMATIONS indicatives (supermarché belge, 2026),
// non vérifiées : ils sont modifiables dans Réglages → Ingrédients & prix.
// Repères nutritionnels approximatifs pour 100 g / 100 ml (ou par pièce pour les œufs, citrons…).
// prix : €/kg pour les ingrédients en g, €/L en ml, €/pièce en pièces.
type Row = [name: string, aisle: Aisle, price: number, kcal: number, protein: number];

const ROWS: Row[] = [
  ['yaourt grec', 'laitiers', 4.5, 100, 8],
  ['fruits (framboises, kiwi, ananas)', 'fruits-legumes', 5, 50, 1],
  ['muesli ou granola', 'epicerie', 6, 400, 9],
  ['nouilles de riz', 'feculents', 5, 360, 6],
  ['crevettes décortiquées', 'surgeles', 18, 80, 18],
  ['œuf', 'proteines', 0.3, 75, 6.5],
  ['germes de soja', 'fruits-legumes', 4, 30, 3],
  ['carotte', 'fruits-legumes', 1.5, 40, 1],
  ['oignon nouveau', 'fruits-legumes', 6, 30, 2],
  ['cacahuètes', 'epicerie', 8, 600, 25],
  ['sauce soja', 'epicerie', 6, 60, 8],
  ['sauce poisson (nuoc-mâm)', 'epicerie', 8, 35, 5],
  ['citron vert', 'fruits-legumes', 0.4, 10, 0],
  ['citron', 'fruits-legumes', 0.4, 15, 0],
  ["huile d'olive", 'epicerie', 9, 820, 0],
  ['haché porc et bœuf', 'proteines', 9, 220, 18],
  ['haché de bœuf', 'proteines', 13, 180, 19],
  ['tomates concassées', 'conserves', 2.2, 25, 1.2],
  ['oignon', 'fruits-legumes', 1.6, 40, 1],
  ['ail', 'fruits-legumes', 10, 130, 6],
  ['chapelure', 'epicerie', 3, 380, 12],
  ['pommes de terre', 'fruits-legumes', 1.3, 77, 2],
  ['lait demi-écrémé', 'laitiers', 1.1, 46, 3.3],
  ['beurre', 'laitiers', 10, 740, 0.7],
  ['haricots rouges', 'conserves', 3, 110, 8],
  ['poivron', 'fruits-legumes', 3.5, 30, 1],
  ['riz long', 'feculents', 2.5, 350, 7.5],
  ['riz basmati', 'feculents', 3.5, 350, 8],
  ['riz rond (paella)', 'feculents', 3, 350, 7],
  ['épices', 'epicerie', 25, 300, 10],
  ['semoule de couscous', 'feculents', 2.2, 360, 12],
  ['cuisse de poulet', 'proteines', 7, 170, 18],
  ['blanc de poulet', 'proteines', 12, 110, 23],
  ['pois chiches', 'conserves', 3, 130, 7],
  ['courgette', 'fruits-legumes', 2.5, 17, 1.2],
  ['emmental râpé', 'laitiers', 11, 380, 28],
  ['salade verte', 'fruits-legumes', 6, 15, 1.3],
  ['feuilles de lasagne', 'feculents', 3.5, 360, 12],
  ['farine', 'epicerie', 1, 350, 10],
  ['aubergine', 'fruits-legumes', 3, 25, 1],
  ['parmesan', 'laitiers', 22, 400, 33],
  ['saucisse de Toulouse', 'proteines', 10, 280, 15],
  ['haricots blancs', 'conserves', 3, 110, 7],
  ['lardons', 'proteines', 12, 260, 16],
  ['choucroute crue', 'fruits-legumes', 3, 20, 1.5],
  ['saucisse fumée', 'proteines', 12, 300, 13],
  ['petits pois surgelés', 'surgeles', 3, 80, 5.5],
  ['bouillon de légumes', 'epicerie', 0.6, 5, 0.3],
  ['jambon', 'proteines', 15, 115, 20],
  ['haddock fumé', 'proteines', 22, 100, 22],
  ['persil', 'fruits-legumes', 15, 40, 3],
  ['pavé de saumon', 'proteines', 25, 200, 20],
  ['épinards', 'surgeles', 5, 25, 3],
  ['filet de colin', 'surgeles', 16, 80, 17],
  ['crème légère', 'laitiers', 4, 160, 2.5],
  ['conchiglioni', 'feculents', 3, 360, 12],
  ['pesto basilic', 'epicerie', 15, 450, 5],
  ['mozzarella', 'laitiers', 9, 250, 18],
  ['pâtes', 'feculents', 1.8, 360, 12],
  ['tomates cerises', 'fruits-legumes', 6, 25, 1],
  ['roquette', 'fruits-legumes', 12, 25, 2.5],
  ['courge butternut', 'fruits-legumes', 2, 45, 1],
  ['champignons', 'fruits-legumes', 5, 22, 3],
  ['lentilles vertes', 'feculents', 3.5, 330, 24],
  ['lentilles corail', 'feculents', 3.5, 340, 24],
  ['fèves surgelées', 'surgeles', 4, 70, 6],
  ['pain complet', 'feculents', 3.5, 250, 9],
  ['pomme', 'fruits-legumes', 2.5, 52, 0.3],
  ['lait de coco', 'conserves', 4, 180, 2],
  ['feta', 'laitiers', 11, 260, 15],
  ['petites pâtes', 'feculents', 2, 360, 12],
  ['céleri branche', 'fruits-legumes', 3, 15, 0.7],
  ['légumes de saison', 'fruits-legumes', 2.5, 30, 1.5],
  ['concombre', 'fruits-legumes', 2.5, 12, 0.6],
  ['tomates', 'fruits-legumes', 3, 20, 0.9],
  ['olives noires', 'conserves', 10, 150, 1],
  ['oignon rouge', 'fruits-legumes', 2.5, 40, 1],
  ['laitue romaine', 'fruits-legumes', 5, 15, 1.2]
];

export function defaultCatalog(): Record<string, IngredientInfo> {
  const out: Record<string, IngredientInfo> = {};
  for (const [name, aisle, price, kcal, protein] of ROWS) {
    out[ingredientKey(name)] = { name, aisle, price, kcal, protein };
  }
  return out;
}
