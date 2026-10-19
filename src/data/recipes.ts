import type { BatchMode, IngredientLine, Recipe, RecipeCategory, Unit, WeighState } from '../store/types';

// Bibliothèque de départ construite à partir de TA liste de recettes (sans doublons).
// ⚠️ Toutes les quantités sont PROVISOIRES : ce sont des portions de départ raisonnables,
// pas tes proportions réelles. Elles sont marquées « provisoire » jusqu'à ce que tu les corriges.
// Les quantités sont saisies PAR PORTION ici puis multipliées par le nombre de portions de la recette.

type I = [name: string, qty: number, unit: Unit, state: WeighState, accomp?: boolean];

interface Def {
  id: string;
  name: string;
  cat: RecipeCategory[];
  servings: number;
  prep: number;
  cook: number;
  mode: BatchMode;
  quick?: boolean;
  fridge: number;
  freeze: boolean;
  months?: number;
  storage?: string;
  subs?: string;
  per: I[];
  steps: string[];
}

const D: Def[] = [
  {
    id: 'pad-thai', name: 'Pad thaï aux crevettes', cat: ['plat'], servings: 2, prep: 15, cook: 10, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'Meilleur fraîchement préparé. Restes : frigo, 24 h maximum.',
    subs: 'Crevettes ↔ blanc de poulet ou tofu ferme. Germes de soja ↔ chou chinois émincé.',
    per: [['nouilles de riz', 70, 'g', 'sec'], ['crevettes décortiquées', 120, 'g', 'cru'], ['œuf', 1, 'pièce', ''], ['germes de soja', 50, 'g', ''], ['carotte', 60, 'g', 'comestible'], ['oignon nouveau', 20, 'g', ''], ['cacahuètes', 10, 'g', ''], ['sauce soja', 10, 'ml', ''], ['sauce poisson (nuoc-mâm)', 5, 'ml', ''], ['citron vert', 0.5, 'pièce', ''], ["huile d'olive", 5, 'ml', '']],
    steps: ['Faire tremper les nouilles selon le paquet, égoutter.', 'Saisir les crevettes dans l’huile chaude 2–3 min, réserver.', 'Faire revenir carotte râpée et oignon, ajouter l’œuf battu et brouiller.', 'Ajouter nouilles, sauces, crevettes et germes de soja ; mélanger 2 min.', 'Servir avec cacahuètes concassées et citron vert.']
  },
  {
    id: 'boulettes-puree', name: 'Boulettes de viande à la sauce tomate et purée', cat: ['plat'], servings: 4, prep: 25, cook: 35, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois (boulettes + sauce ; la purée se congèle aussi).',
    subs: 'Haché porc-bœuf ↔ haché de volaille. Purée ↔ pâtes ou riz.',
    per: [['haché porc et bœuf', 120, 'g', 'cru'], ['tomates concassées', 150, 'g', ''], ['oignon', 40, 'g', 'comestible'], ['ail', 3, 'g', ''], ['chapelure', 10, 'g', ''], ['œuf', 0.25, 'pièce', ''], ["huile d'olive", 5, 'ml', ''], ['pommes de terre', 250, 'g', 'cru', true], ['lait demi-écrémé', 40, 'ml', '', true], ['beurre', 5, 'g', '', true]],
    steps: ['Mélanger haché, œuf, chapelure, moitié de l’oignon et ail ; former les boulettes.', 'Dorer les boulettes dans l’huile, réserver.', 'Faire revenir le reste d’oignon, ajouter les tomates, mijoter 10 min, remettre les boulettes 15 min.', 'Cuire les pommes de terre épluchées 20 min à l’eau, écraser avec lait chaud et beurre.']
  },
  {
    id: 'chili', name: 'Chili con carne', cat: ['plat'], servings: 4, prep: 15, cook: 45, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Se congèle très bien (3 mois). Riz : à cuire à part (voir accompagnements).',
    subs: 'Moitié du haché ↔ lentilles corail pour une version plus économique.',
    per: [['haché de bœuf', 110, 'g', 'cru'], ['haricots rouges', 120, 'g', 'égoutté'], ['tomates concassées', 120, 'g', ''], ['poivron', 60, 'g', 'comestible'], ['oignon', 40, 'g', 'comestible'], ['épices', 2, 'g', ''], ["huile d'olive", 5, 'ml', ''], ['riz long', 70, 'g', 'sec', true]],
    steps: ['Faire revenir oignon et poivron dans l’huile.', 'Ajouter le haché, faire dorer, ajouter les épices (cumin, paprika, chili).', 'Ajouter tomates et haricots rincés, mijoter 30–40 min.', 'Cuire le riz à part.']
  },
  {
    id: 'couscous', name: 'Couscous', cat: ['plat', 'autre'], servings: 4, prep: 20, cook: 45, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Bouillon, légumes et viande : frigo 3 jours, congélation 3 mois. Semoule : à préparer au moment.',
    subs: 'Cuisse de poulet ↔ merguez ou pois chiches en plus pour une version végétarienne.',
    per: [['cuisse de poulet', 130, 'g', 'cru'], ['pois chiches', 80, 'g', 'égoutté'], ['carotte', 80, 'g', 'comestible'], ['courgette', 100, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['tomates concassées', 80, 'g', ''], ['épices', 2, 'g', ''], ["huile d'olive", 5, 'ml', ''], ['semoule de couscous', 70, 'g', 'sec', true]],
    steps: ['Dorer le poulet dans l’huile avec l’oignon et le ras el hanout.', 'Ajouter carottes, tomates et eau à hauteur, mijoter 25 min.', 'Ajouter courgettes et pois chiches, cuire 15 min.', 'Préparer la semoule au moment (eau bouillante, 5 min).']
  },
  {
    id: 'hachis', name: 'Hachis parmentier et salade', cat: ['plat', 'autre'], servings: 4, prep: 25, cook: 40, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois en portions. Salade : à préparer au moment.',
    subs: 'Moitié bœuf ↔ lentilles. Pommes de terre ↔ moitié patate douce.',
    per: [['haché de bœuf', 110, 'g', 'cru'], ['oignon', 30, 'g', 'comestible'], ['pommes de terre', 250, 'g', 'cru'], ['lait demi-écrémé', 40, 'ml', ''], ['beurre', 5, 'g', ''], ['emmental râpé', 15, 'g', ''], ['salade verte', 50, 'g', '', true], ["huile d'olive", 5, 'ml', '', true]],
    steps: ['Cuire les pommes de terre et préparer la purée (lait, beurre).', 'Faire revenir oignon et haché.', 'Plat : viande en dessous, purée au-dessus, emmental.', 'Gratiner 20 min à 200 °C. Servir avec la salade.']
  },
  {
    id: 'lasagnes', name: 'Lasagnes', cat: ['plat', 'autre'], servings: 4, prep: 30, cook: 45, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois (portions découpées une fois refroidies).',
    subs: 'Haché ↔ lentilles corail + champignons.',
    per: [['feuilles de lasagne', 70, 'g', 'sec'], ['haché de bœuf', 100, 'g', 'cru'], ['tomates concassées', 150, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['carotte', 40, 'g', 'comestible'], ['lait demi-écrémé', 120, 'ml', ''], ['farine', 10, 'g', ''], ['beurre', 8, 'g', ''], ['emmental râpé', 20, 'g', '']],
    steps: ['Préparer une bolognaise : oignon, carotte, haché, tomates, 20 min.', 'Béchamel : beurre + farine, puis lait en fouettant.', 'Alterner feuilles, sauce, béchamel ; finir par béchamel + emmental.', 'Cuire 40–45 min à 180 °C.']
  },
  {
    id: 'moussaka', name: 'Moussaka', cat: ['plat'], servings: 4, prep: 35, cook: 50, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois.',
    subs: 'Aubergines poêlées ↔ rôties au four avec un pinceau d’huile (moins d’huile).',
    per: [['aubergine', 200, 'g', ''], ['haché de bœuf', 100, 'g', 'cru'], ['tomates concassées', 120, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['pommes de terre', 120, 'g', 'cru'], ['lait demi-écrémé', 100, 'ml', ''], ['farine', 8, 'g', ''], ['beurre', 6, 'g', ''], ['parmesan', 10, 'g', ''], ["huile d'olive", 10, 'ml', '']],
    steps: ['Rôtir les tranches d’aubergine et de pommes de terre au four (20 min, 200 °C).', 'Préparer la sauce viande-tomate.', 'Béchamel légère.', 'Monter : pommes de terre, aubergines, viande, béchamel, parmesan. Cuire 30 min à 180 °C.']
  },
  {
    id: 'cassoulet', name: 'Cassoulet', cat: ['plat', 'autre'], servings: 4, prep: 20, cook: 60, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois.',
    subs: 'Saucisse de Toulouse ↔ saucisse de volaille.',
    per: [['saucisse de Toulouse', 100, 'g', 'cru'], ['haricots blancs', 180, 'g', 'égoutté'], ['tomates concassées', 80, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['carotte', 40, 'g', 'comestible'], ['lardons', 30, 'g', 'cru'], ['chapelure', 5, 'g', '']],
    steps: ['Dorer saucisses et lardons, réserver.', 'Faire revenir oignon et carotte, ajouter tomates et haricots.', 'Remettre la viande, mijoter 40 min.', 'Saupoudrer de chapelure et gratiner 15 min.']
  },
  {
    id: 'choucroute', name: 'Choucroute garnie', cat: ['plat', 'autre'], servings: 4, prep: 15, cook: 60, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois (les pommes de terre peuvent devenir farineuses).',
    subs: 'Saucisse fumée ↔ filet de porc ou saucisse de volaille.',
    per: [['choucroute crue', 200, 'g', ''], ['saucisse fumée', 80, 'g', ''], ['lardons', 40, 'g', 'cru'], ['pommes de terre', 200, 'g', 'cru'], ['oignon', 20, 'g', 'comestible']],
    steps: ['Rincer la choucroute.', 'Faire revenir oignon et lardons, ajouter la choucroute et un fond d’eau, cuire 40 min.', 'Ajouter pommes de terre et saucisses, cuire encore 20 min.']
  },
  {
    id: 'paella', name: 'Paella', cat: ['plat', 'autre'], servings: 4, prep: 20, cook: 35, mode: 'full', fridge: 1, freeze: true, months: 2,
    storage: 'Contient du riz : refroidir en moins d’1 h, frigo 24 h maximum, sinon congeler (2 mois).',
    subs: 'Crevettes ↔ plus de poulet. Riz rond ↔ riz long.',
    per: [['riz rond (paella)', 75, 'g', 'sec'], ['cuisse de poulet', 80, 'g', 'cru'], ['crevettes décortiquées', 60, 'g', 'cru'], ['poivron', 50, 'g', 'comestible'], ['petits pois surgelés', 40, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['tomates concassées', 50, 'g', ''], ['bouillon de légumes', 200, 'ml', ''], ['épices', 1, 'g', ''], ["huile d'olive", 8, 'ml', '']],
    steps: ['Dorer le poulet, ajouter oignon et poivron.', 'Ajouter le riz, nacrer 2 min, puis tomates, épices (safran/paprika) et bouillon chaud.', 'Cuire 18 min sans remuer ; ajouter crevettes et petits pois les 5 dernières minutes.']
  },
  {
    id: 'riz-cantonais', name: 'Riz cantonais aux crevettes', cat: ['plat', 'autre'], servings: 4, prep: 15, cook: 20, mode: 'full', fridge: 1, freeze: true, months: 2,
    storage: 'Riz : refroidir rapidement, frigo 24 h maximum, sinon congeler (2 mois).',
    subs: 'Crevettes ↔ jambon seulement. Petits pois ↔ dés de carotte.',
    per: [['riz long', 75, 'g', 'sec'], ['crevettes décortiquées', 80, 'g', 'cru'], ['œuf', 1, 'pièce', ''], ['petits pois surgelés', 40, 'g', ''], ['jambon', 30, 'g', ''], ['oignon nouveau', 15, 'g', ''], ['sauce soja', 10, 'ml', ''], ["huile d'olive", 8, 'ml', '']],
    steps: ['Cuire le riz, l’étaler pour le refroidir vite.', 'Omelette fine coupée en lanières.', 'Sauter crevettes, petits pois, jambon, puis le riz et la sauce soja ; ajouter l’omelette.']
  },
  {
    id: 'kedgeree', name: 'Kedgeree', cat: ['plat'], servings: 2, prep: 15, cook: 25, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'À préparer le jour même (poisson + œufs durs). Restes : 24 h au frigo.',
    subs: 'Haddock ↔ saumon ou colin.',
    per: [['riz basmati', 75, 'g', 'sec'], ['haddock fumé', 120, 'g', 'cru'], ['œuf', 1, 'pièce', ''], ['oignon', 30, 'g', 'comestible'], ['épices', 2, 'g', ''], ['beurre', 5, 'g', ''], ['persil', 3, 'g', ''], ['lait demi-écrémé', 50, 'ml', '']],
    steps: ['Pocher le haddock 8 min dans le lait, effeuiller.', 'Cuire œufs durs (9 min) et riz.', 'Faire revenir oignon et curry dans le beurre, ajouter riz et poisson, puis œufs en quartiers et persil.']
  },
  {
    id: 'saumon-epinards', name: 'Saumon, épinards et purée de pommes de terre', cat: ['plat'], servings: 2, prep: 15, cook: 25, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'Saumon cuit : frigo 2 jours. La purée peut être préparée à l’avance.',
    subs: 'Saumon ↔ truite ou colin. Épinards frais ↔ surgelés.',
    per: [['pavé de saumon', 130, 'g', 'cru'], ['épinards', 150, 'g', ''], ['pommes de terre', 250, 'g', 'cru', true], ['lait demi-écrémé', 40, 'ml', '', true], ['beurre', 5, 'g', '', true], ['citron', 0.25, 'pièce', '']],
    steps: ['Cuire les pommes de terre, faire la purée.', 'Cuire le saumon 12–15 min au four à 200 °C.', 'Faire tomber les épinards à la poêle, citronner.']
  },
  {
    id: 'colin-gratin', name: 'Colin ou haddock et gratin de courgettes', cat: ['plat'], servings: 2, prep: 15, cook: 30, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'Le gratin se prépare à l’avance (frigo 2 jours). Poisson : cuire le jour même.',
    subs: 'Colin ↔ haddock, cabillaud ou lieu.',
    per: [['filet de colin', 140, 'g', 'cru'], ['courgette', 250, 'g', ''], ['crème légère', 30, 'ml', ''], ['emmental râpé', 15, 'g', ''], ['œuf', 0.5, 'pièce', ''], ["huile d'olive", 5, 'ml', '']],
    steps: ['Trancher les courgettes, les faire revenir 5 min.', 'Mélanger œuf, crème, emmental ; verser sur les courgettes, cuire 25 min à 190 °C.', 'Cuire le poisson 10–12 min (four ou poêle).']
  },
  {
    id: 'conchiglioni', name: 'Conchiglioni aux légumes grillés et pesto de basilic', cat: ['plat'], servings: 4, prep: 30, cook: 35, mode: 'full', fridge: 3, freeze: true, months: 2,
    storage: 'Frigo 3 jours. Congélation 2 mois.',
    subs: 'Mozzarella ↔ ricotta. Pesto maison ↔ pesto du commerce.',
    per: [['conchiglioni', 80, 'g', 'sec'], ['courgette', 80, 'g', ''], ['aubergine', 80, 'g', ''], ['poivron', 60, 'g', 'comestible'], ['pesto basilic', 20, 'g', ''], ['mozzarella', 30, 'g', ''], ["huile d'olive", 5, 'ml', '']],
    steps: ['Griller les légumes en dés au four (25 min, 200 °C).', 'Cuire les conchiglioni al dente.', 'Mélanger légumes et pesto, farcir les pâtes, mozzarella dessus, gratiner 10 min.']
  },
  {
    id: 'bolognaise', name: 'Pâtes bolognaise', cat: ['plat'], servings: 4, prep: 15, cook: 40, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Sauce : frigo 3 jours, congélation 3 mois. Pâtes : à cuire le jour même de préférence.',
    subs: 'Moitié du haché ↔ lentilles corail.',
    per: [['haché de bœuf', 100, 'g', 'cru'], ['tomates concassées', 150, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['carotte', 30, 'g', 'comestible'], ["huile d'olive", 5, 'ml', ''], ['pâtes', 80, 'g', 'sec', true], ['parmesan', 8, 'g', '', true]],
    steps: ['Faire revenir oignon et carotte, ajouter le haché.', 'Ajouter les tomates, mijoter 30 min.', 'Cuire les pâtes au moment du repas ; parmesan.']
  },
  {
    id: 'pates-pesto', name: 'Pâtes au pesto', cat: ['plat'], servings: 2, prep: 5, cook: 12, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'À préparer au moment (12 min).',
    subs: 'Ajouter des petits pois ou du poulet pour un repas plus complet.',
    per: [['pâtes', 80, 'g', 'sec'], ['pesto basilic', 25, 'g', ''], ['parmesan', 8, 'g', ''], ['tomates cerises', 80, 'g', ''], ['roquette', 20, 'g', '']],
    steps: ['Cuire les pâtes.', 'Mélanger avec le pesto et une cuillère d’eau de cuisson.', 'Ajouter tomates cerises, roquette, parmesan.']
  },
  {
    id: 'pates-petits-pois', name: 'Pâtes aux petits pois, lardons et oignons', cat: ['plat'], servings: 2, prep: 10, cook: 15, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'À préparer au moment.',
    subs: 'Lardons ↔ dés de jambon ou de poulet.',
    per: [['pâtes', 80, 'g', 'sec'], ['petits pois surgelés', 80, 'g', ''], ['lardons', 50, 'g', 'cru'], ['oignon', 40, 'g', 'comestible'], ['crème légère', 30, 'ml', ''], ['parmesan', 8, 'g', '']],
    steps: ['Faire revenir oignon et lardons.', 'Ajouter petits pois et un fond d’eau, 5 min, puis la crème.', 'Mélanger avec les pâtes cuites.']
  },
  {
    id: 'carbonara', name: 'Pâtes carbonara', cat: ['plat'], servings: 2, prep: 10, cook: 12, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'À préparer au moment.',
    subs: 'Lardons ↔ guanciale ou dés de jambon.',
    per: [['pâtes', 80, 'g', 'sec'], ['lardons', 60, 'g', 'cru'], ['œuf', 1, 'pièce', ''], ['parmesan', 15, 'g', '']],
    steps: ['Cuire les pâtes, garder un peu d’eau de cuisson.', 'Dorer les lardons.', 'Hors du feu, mélanger pâtes, lardons, œuf battu + parmesan et un peu d’eau de cuisson.']
  },
  {
    id: 'pates-butternut', name: 'Pâtes à la courge butternut', cat: ['plat'], servings: 4, prep: 15, cook: 30, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Sauce butternut : frigo 3 jours, congélation 3 mois. Pâtes à cuire au moment.',
    subs: 'Butternut ↔ potiron. Ajouter des lardons ou des pois chiches pour plus de protéines.',
    per: [['courge butternut', 200, 'g', 'comestible'], ['oignon', 30, 'g', 'comestible'], ['crème légère', 30, 'ml', ''], ['parmesan', 10, 'g', ''], ['pâtes', 80, 'g', 'sec', true]],
    steps: ['Cuire la butternut en dés avec l’oignon (20 min).', 'Mixer avec la crème et le parmesan.', 'Mélanger avec les pâtes cuites au moment.']
  },
  {
    id: 'pates-poulet', name: 'Pâtes au poulet, champignons et crème', cat: ['plat'], servings: 4, prep: 15, cook: 20, mode: 'full', fridge: 3, freeze: true, months: 2,
    storage: 'Sauce : frigo 3 jours, congélation 2 mois. Pâtes à cuire au moment.',
    subs: 'Crème ↔ moitié crème, moitié lait.',
    per: [['blanc de poulet', 110, 'g', 'cru'], ['champignons', 100, 'g', ''], ['crème légère', 40, 'ml', ''], ['oignon', 30, 'g', 'comestible'], ["huile d'olive", 5, 'ml', ''], ['pâtes', 80, 'g', 'sec', true]],
    steps: ['Dorer le poulet en dés, réserver.', 'Faire revenir oignon et champignons.', 'Ajouter crème et poulet, mijoter 5 min.', 'Cuire les pâtes au moment.']
  },
  {
    id: 'lentilles-riz', name: 'Lentilles, riz et poivrons', cat: ['plat', 'vegetarien'], servings: 4, prep: 15, cook: 35, mode: 'full', fridge: 1, freeze: true, months: 3,
    storage: 'Contient du riz : frigo 24 h, sinon congeler (3 mois).',
    subs: 'Ajouter de la feta ou un œuf pour plus de protéines.',
    per: [['lentilles vertes', 60, 'g', 'sec'], ['riz long', 50, 'g', 'sec'], ['poivron', 100, 'g', 'comestible'], ['oignon', 40, 'g', 'comestible'], ['tomates concassées', 80, 'g', ''], ['épices', 1, 'g', ''], ["huile d'olive", 8, 'ml', '']],
    steps: ['Cuire les lentilles 25 min.', 'Cuire le riz.', 'Faire revenir oignon et poivrons, ajouter tomates, cumin, puis lentilles et riz.']
  },
  {
    id: 'saucisse-lentilles', name: 'Saucisse, lentilles et tomates', cat: ['plat'], servings: 4, prep: 10, cook: 40, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois.',
    subs: 'Saucisse ↔ saucisse de volaille.',
    per: [['saucisse de Toulouse', 100, 'g', 'cru'], ['lentilles vertes', 70, 'g', 'sec'], ['tomates concassées', 120, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['carotte', 50, 'g', 'comestible']],
    steps: ['Dorer les saucisses.', 'Ajouter oignon, carotte, lentilles rincées, tomates et eau.', 'Mijoter 35 min.']
  },
  {
    id: 'soupe-pois-chiches', name: 'Soupe de pois chiches et fèves', cat: ['vegetarien'], servings: 4, prep: 15, cook: 30, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois.',
    subs: 'Fèves ↔ petits pois.',
    per: [['pois chiches', 120, 'g', 'égoutté'], ['fèves surgelées', 80, 'g', ''], ['oignon', 40, 'g', 'comestible'], ['carotte', 60, 'g', 'comestible'], ['tomates concassées', 100, 'g', ''], ['bouillon de légumes', 250, 'ml', ''], ['épices', 1, 'g', ''], ["huile d'olive", 5, 'ml', ''], ['pain complet', 50, 'g', '', true]],
    steps: ['Faire revenir oignon et carotte avec le cumin.', 'Ajouter tomates, bouillon, pois chiches, cuire 20 min.', 'Ajouter les fèves 8 min. Servir avec du pain.']
  },
  {
    id: 'mulligatawny', name: 'Mulligatawny', cat: ['vegetarien'], servings: 4, prep: 15, cook: 30, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois. Riz : à cuire à part.',
    subs: 'Ajouter du poulet si tu le souhaites.',
    per: [['lentilles corail', 60, 'g', 'sec'], ['carotte', 60, 'g', 'comestible'], ['pomme', 50, 'g', 'comestible'], ['oignon', 40, 'g', 'comestible'], ['lait de coco', 50, 'ml', ''], ['bouillon de légumes', 250, 'ml', ''], ['épices', 3, 'g', ''], ['riz basmati', 40, 'g', 'sec', true]],
    steps: ['Faire revenir oignon, carotte et curry.', 'Ajouter lentilles, pomme, bouillon ; cuire 20 min.', 'Ajouter le lait de coco, mixer partiellement.']
  },
  {
    id: 'shakshuka', name: 'Shakshuka', cat: ['vegetarien'], servings: 2, prep: 10, cook: 20, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'La sauce poivrons-tomates peut être préparée à l’avance (frigo 3 jours) ; œufs au moment.',
    subs: 'Feta ↔ chèvre frais.',
    per: [['œuf', 2, 'pièce', ''], ['tomates concassées', 200, 'g', ''], ['poivron', 100, 'g', 'comestible'], ['oignon', 40, 'g', 'comestible'], ['feta', 30, 'g', ''], ['épices', 1, 'g', ''], ["huile d'olive", 5, 'ml', ''], ['pain complet', 60, 'g', '', true]],
    steps: ['Faire revenir oignon et poivron, ajouter tomates et épices, 10 min.', 'Creuser des puits, casser les œufs, couvrir 6–8 min.', 'Feta émiettée, servir avec le pain.']
  },
  {
    id: 'minestrone', name: 'Minestrone', cat: ['vegetarien'], servings: 4, prep: 20, cook: 30, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congeler sans les pâtes si possible.',
    subs: 'Légumes selon la saison.',
    per: [['haricots blancs', 80, 'g', 'égoutté'], ['petites pâtes', 30, 'g', 'sec'], ['carotte', 60, 'g', 'comestible'], ['courgette', 80, 'g', ''], ['céleri branche', 30, 'g', ''], ['tomates concassées', 100, 'g', ''], ['bouillon de légumes', 300, 'ml', ''], ['parmesan', 10, 'g', ''], ["huile d'olive", 5, 'ml', '']],
    steps: ['Faire revenir les légumes en dés.', 'Ajouter tomates et bouillon, cuire 20 min.', 'Ajouter haricots et pâtes, 10 min. Parmesan au service.']
  },
  {
    id: 'soupe-repas', name: 'Soupe-repas (légumes de saison)', cat: ['vegetarien'], servings: 4, prep: 15, cook: 30, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois.',
    subs: 'Lentilles corail ↔ pois cassés. Emmental ↔ œuf dur.',
    per: [['lentilles corail', 40, 'g', 'sec'], ['légumes de saison', 250, 'g', 'comestible'], ['pommes de terre', 100, 'g', 'cru'], ['bouillon de légumes', 300, 'ml', ''], ['emmental râpé', 15, 'g', ''], ['pain complet', 50, 'g', '', true]],
    steps: ['Couper les légumes et pommes de terre.', 'Cuire avec lentilles et bouillon 25 min.', 'Mixer, servir avec emmental et pain.']
  },
  {
    id: 'salade-grecque', name: 'Salade grecque', cat: ['vegetarien', 'salade'], servings: 2, prep: 15, cook: 0, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'Légumes coupés : frigo 2 jours. Assaisonner au moment.',
    subs: 'Pois chiches ajoutés pour en faire un repas complet (provisoire).',
    per: [['concombre', 120, 'g', ''], ['tomates', 150, 'g', ''], ['feta', 50, 'g', ''], ['olives noires', 20, 'g', 'égoutté'], ['oignon rouge', 20, 'g', 'comestible'], ['pois chiches', 80, 'g', 'égoutté'], ["huile d'olive", 10, 'ml', ''], ['pain complet', 50, 'g', '', true]],
    steps: ['Couper concombre, tomates et oignon.', 'Ajouter pois chiches, olives et feta.', 'Assaisonner (huile, origan) au moment.']
  },
  {
    id: 'salade-cesar', name: 'Salade César', cat: ['salade'], servings: 2, prep: 15, cook: 12, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'Poulet cuit : frigo 2–3 jours. Salade et sauce séparées jusqu’au repas.',
    subs: 'Sauce allégée au yaourt grec.',
    per: [['blanc de poulet', 120, 'g', 'cru'], ['laitue romaine', 120, 'g', ''], ['parmesan', 15, 'g', ''], ['pain complet', 30, 'g', ''], ['yaourt grec', 30, 'g', ''], ["huile d'olive", 5, 'ml', ''], ['citron', 0.25, 'pièce', '']],
    steps: ['Cuire le poulet, le trancher.', 'Croûtons : pain en dés grillé à la poêle.', 'Sauce : yaourt, parmesan, citron. Assembler au moment.']
  }
];

export function defaultRecipes(): Recipe[] {
  return D.map((d) => {
    const ingredients: IngredientLine[] = d.per.map(([name, qty, unit, state, accomp]) => ({
      name,
      qty: Math.round(qty * d.servings * 100) / 100,
      unit,
      state,
      ...(accomp ? { accomp: true } : {})
    }));
    return {
      id: d.id,
      name: d.name,
      categories: d.cat,
      servings: d.servings,
      prepMin: d.prep,
      cookMin: d.cook,
      ingredients,
      steps: d.steps,
      substitutions: d.subs ?? '',
      fridgeDays: d.fridge,
      freezable: d.freeze,
      freezerMonths: d.months ?? 0,
      storageNotes: d.storage ?? '',
      batchMode: d.mode,
      quick: !!d.quick,
      provisional: true
    };
  });
}
