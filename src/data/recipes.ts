import type { BatchMode, IngredientLine, Recipe, RecipeCategory, Unit, WeighState } from '../store/types';
import { ingredientKey } from '../lib/units';

// Bibliothèque de départ : TA liste de 47 recettes.
// - Recettes de tes livres (Simplissime, Jamie Oliver) : quantités du livre, pour le nombre de personnes du livre
//   (champ « tot »). Les étapes sont résumées avec nos mots.
// - Autres recettes : portions de départ raisonnables, saisies PAR PORTION (champ « per ») et marquées
//   « provisoire » jusqu'à ce que tu les corriges.

type I = [name: string, qty: number, unit: Unit, state: WeighState, accomp?: boolean, note?: string];

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
  /** Quantités par portion (recettes sans livre, provisoires) */
  per?: I[];
  /** Quantités totales du livre, pour « servings » personnes */
  tot?: I[];
  steps: string[];
}

const D: Def[] = [
  // ——— Plats mijotés et classiques ———
  {
    id: 'couscous', name: 'Couscous', cat: ['mijote'], servings: 4, prep: 20, cook: 45, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Bouillon, légumes et viande : frigo 3 jours, congélation 3 mois. Semoule : à préparer au moment.',
    subs: 'Cuisse de poulet ↔ merguez ou pois chiches en plus pour une version végétarienne.',
    per: [['cuisse de poulet', 130, 'g', 'cru'], ['pois chiches', 80, 'g', 'égoutté'], ['carotte', 80, 'g', 'comestible'], ['courgette', 100, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['tomates concassées', 80, 'g', ''], ['épices', 2, 'g', ''], ["huile d'olive", 5, 'ml', ''], ['semoule de couscous', 70, 'g', 'sec', true]],
    steps: ['Dorer le poulet dans l’huile avec l’oignon et le ras el hanout.', 'Ajouter carottes, tomates et eau à hauteur, mijoter 25 min.', 'Ajouter courgettes et pois chiches, cuire 15 min.', 'Préparer la semoule au moment (eau bouillante, 5 min).']
  },
  {
    id: 'ratatouille', name: 'Ratatouille', cat: ['mijote'], servings: 4, prep: 25, cook: 50, mode: 'full', fridge: 4, freeze: true, months: 3,
    storage: 'Frigo 4 jours (encore meilleure le lendemain). Congélation 3 mois. Riz : à cuire à part.',
    subs: 'Ajouter un œuf au plat ou des pois chiches pour plus de protéines. Riz ↔ semoule ou pain.',
    per: [['aubergine', 120, 'g', ''], ['courgette', 150, 'g', ''], ['poivron', 100, 'g', 'comestible'], ['tomates', 150, 'g', ''], ['oignon', 50, 'g', 'comestible'], ['ail', 3, 'g', ''], ['épices', 1, 'g', '', false, 'herbes de Provence'], ["huile d'olive", 10, 'ml', ''], ['riz long', 60, 'g', 'sec', true]],
    steps: ['Couper tous les légumes en dés.', 'Faire revenir l’oignon et l’ail dans l’huile, puis les poivrons 5 min.', 'Ajouter aubergines et courgettes, puis les tomates et les herbes.', 'Couvrir et mijoter 40 min à feu doux. Cuire le riz à part.']
  },
  {
    id: 'boulettes-puree', name: 'Boulettes sauce tomate et purée', cat: ['mijote'], servings: 4, prep: 25, cook: 35, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois (boulettes + sauce ; la purée se congèle aussi).',
    subs: 'Haché porc-bœuf ↔ haché de volaille. Purée ↔ pâtes ou riz.',
    per: [['haché porc et bœuf', 120, 'g', 'cru'], ['tomates concassées', 150, 'g', ''], ['oignon', 40, 'g', 'comestible'], ['ail', 3, 'g', ''], ['chapelure', 10, 'g', ''], ['œuf', 0.25, 'pièce', ''], ["huile d'olive", 5, 'ml', ''], ['pommes de terre', 250, 'g', 'cru', true], ['lait demi-écrémé', 40, 'ml', '', true], ['beurre', 5, 'g', '', true]],
    steps: ['Mélanger haché, œuf, chapelure, moitié de l’oignon et ail ; former les boulettes.', 'Dorer les boulettes dans l’huile, réserver.', 'Faire revenir le reste d’oignon, ajouter les tomates, mijoter 10 min, remettre les boulettes 15 min.', 'Cuire les pommes de terre épluchées 20 min à l’eau, écraser avec lait chaud et beurre.']
  },
  {
    id: 'fish-and-chips', name: 'Fish and chips (au four)', cat: ['autre'], servings: 2, prep: 15, cook: 30, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'Meilleur tout juste sorti du four. Les frites peuvent être coupées la veille (dans l’eau, au frigo).',
    subs: 'Colin ↔ cabillaud ou lieu. Petits pois ↔ salade verte.',
    per: [['filet de colin', 150, 'g', 'cru'], ['farine', 15, 'g', ''], ['œuf', 0.5, 'pièce', ''], ['chapelure', 25, 'g', ''], ['pommes de terre', 250, 'g', 'cru'], ["huile d'olive", 10, 'ml', ''], ['citron', 0.25, 'pièce', ''], ['petits pois surgelés', 80, 'g', '', true]],
    steps: ['Couper les pommes de terre en frites, les mélanger avec l’huile et les cuire 30 min à 220 °C.', 'Passer le poisson dans la farine, l’œuf battu puis la chapelure.', 'L’enfourner pour les 15 dernières minutes, à côté des frites.', 'Cuire les petits pois 5 min ; servir avec le citron.']
  },
  {
    id: 'hachis', name: 'Hachis parmentier et salade', cat: ['mijote'], servings: 4, prep: 25, cook: 40, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois en portions. Salade : à préparer au moment.',
    subs: 'Moitié bœuf ↔ lentilles. Pommes de terre ↔ moitié patate douce.',
    per: [['haché de bœuf', 110, 'g', 'cru'], ['oignon', 30, 'g', 'comestible'], ['pommes de terre', 250, 'g', 'cru'], ['lait demi-écrémé', 40, 'ml', ''], ['beurre', 5, 'g', ''], ['emmental râpé', 15, 'g', ''], ['salade verte', 50, 'g', '', true], ["huile d'olive", 5, 'ml', '', true]],
    steps: ['Cuire les pommes de terre et préparer la purée (lait, beurre).', 'Faire revenir oignon et haché.', 'Plat : viande en dessous, purée au-dessus, emmental.', 'Gratiner 20 min à 200 °C. Servir avec la salade.']
  },
  {
    id: 'lasagnes', name: 'Lasagnes', cat: ['mijote'], servings: 4, prep: 30, cook: 45, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois (portions découpées une fois refroidies).',
    subs: 'Haché ↔ lentilles corail + champignons.',
    per: [['feuilles de lasagne', 70, 'g', 'sec'], ['haché de bœuf', 100, 'g', 'cru'], ['tomates concassées', 150, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['carotte', 40, 'g', 'comestible'], ['lait demi-écrémé', 120, 'ml', ''], ['farine', 10, 'g', ''], ['beurre', 8, 'g', ''], ['emmental râpé', 20, 'g', '']],
    steps: ['Préparer une bolognaise : oignon, carotte, haché, tomates, 20 min.', 'Béchamel : beurre + farine, puis lait en fouettant.', 'Alterner feuilles, sauce, béchamel ; finir par béchamel + emmental.', 'Cuire 40–45 min à 180 °C.']
  },
  {
    id: 'moussaka', name: 'Moussaka', cat: ['mijote'], servings: 4, prep: 5, cook: 60, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois.',
    subs: 'Fromage râpé ↔ feta émiettée. Crème ↔ yaourt grec.',
    tot: [['haché de bœuf', 400, 'g', 'cru'], ['aubergine', 600, 'g', '', false, '2 aubergines'], ['emmental râpé', 50, 'g', ''], ['crème légère', 100, 'ml', ''], ['tomates concassées', 400, 'g', '']],
    steps: ['Préchauffer le four à 180 °C.', 'Trancher finement les aubergines.', 'Tout mélanger dans un plat à gratin : aubergines, haché, tomates, fromage et crème. Saler, poivrer.', 'Enfourner 1 h.']
  },
  {
    id: 'cassoulet', name: 'Cassoulet', cat: ['mijote'], servings: 6, prep: 20, cook: 205, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois. Penser au trempage des haricots la veille.',
    subs: 'Haricots secs ↔ 3 boîtes de haricots blancs (sauter le trempage et la première cuisson).',
    tot: [['haricots blancs secs', 400, 'g', 'sec', false, 'tarbais'], ['cuisse de canard confite', 600, 'g', ''], ['échine de porc', 500, 'g', 'cru'], ['saucisse de Toulouse', 500, 'g', 'cru'], ['poitrine fumée', 400, 'g', ''], ['bouillon de volaille', 3500, 'ml', ''], ['oignon', 150, 'g', 'comestible'], ['ail', 15, 'g', '', false, '3 gousses'], ['graisse de canard', 45, 'g', '']],
    steps: ['La veille : faire tremper les haricots dans l’eau froide.', 'Four à 180 °C. Cuire les haricots 20 min à l’eau bouillante, égoutter.', 'Dans la graisse de canard, dorer oignon et ail émincés, échine, poitrine et saucisse en morceaux.', 'Tout verser dans un grand plat avec les haricots et le bouillon ; enfourner 2 h en enfonçant la croûte quand elle se forme.', 'Ajouter le canard et cuire encore 1 h. Saler, poivrer.']
  },
  {
    id: 'choucroute', name: 'Choucroute garnie', cat: ['mijote'], servings: 6, prep: 15, cook: 65, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois (les pommes de terre peuvent devenir farineuses).',
    subs: 'Bière ↔ vin blanc d’Alsace ou bouillon. Palette ↔ plus de jambon.',
    tot: [['choucroute crue', 1200, 'g', ''], ['palette fumée', 800, 'g', ''], ['jambon', 500, 'g', '', false, 'jambon cuit en tranche épaisse'], ['poitrine fumée', 500, 'g', ''], ['saucisse fumée', 600, 'g', ''], ['saucisses de Strasbourg', 600, 'g', ''], ['bière blonde', 1000, 'ml', ''], ['pommes de terre', 1200, 'g', 'cru', false, '8 moyennes'], ['épices', 3, 'g', '', false, '25 baies de genièvre + 4 feuilles de laurier']],
    steps: ['Mettre dans une cocotte la choucroute, le genièvre, le laurier, la poitrine et la palette.', 'Verser la bière et 20 cl d’eau ; cuire 45 min à couvert, à feu doux.', 'Cuire les pommes de terre 20 min à l’eau salée.', 'Réchauffer les saucisses 2 min dans l’eau de cuisson, puis tout dresser sur un plat.']
  },
  {
    id: 'poivrons-farcis', name: 'Poivrons farcis', cat: ['autre'], servings: 4, prep: 20, cook: 45, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois (poivrons farcis cuits, un par boîte).',
    subs: 'Haché de bœuf ↔ haché de volaille ou lentilles. Riz ↔ boulgour.',
    per: [['poivron', 200, 'g', '', false, '1 gros poivron'], ['haché de bœuf', 100, 'g', 'cru'], ['riz long', 30, 'g', 'sec'], ['oignon', 30, 'g', 'comestible'], ['ail', 2, 'g', ''], ['tomates concassées', 100, 'g', ''], ['emmental râpé', 15, 'g', ''], ['épices', 1, 'g', ''], ["huile d'olive", 5, 'ml', '']],
    steps: ['Cuire le riz 10 min (il finira de cuire au four).', 'Faire revenir oignon, ail et haché ; ajouter épices, riz et la moitié des tomates.', 'Couper le chapeau des poivrons, les vider, les farcir.', 'Les poser sur le reste de tomates, emmental dessus, cuire 35 min à 190 °C.']
  },

  {
    id: 'colin-gratin', name: 'Gratin de courgettes et haddock', cat: ['autre'], servings: 4, prep: 10, cook: 45, mode: 'full', fridge: 2, freeze: false,
    storage: 'Frigo 2 jours. Ne se congèle pas (les courgettes rendent de l’eau).',
    subs: 'Haddock ↔ colin ou cabillaud. Parmesan ↔ emmental râpé (moins salé).',
    tot: [['courgette', 900, 'g', '', false, '3 courgettes'], ['haddock fumé', 400, 'g', '', false, 'sans peau'], ['parmesan', 200, 'g', '', false, 'en copeaux'], ['basilic frais', 10, 'g', '', false, '20 feuilles'], ["huile d'olive", 60, 'ml', '', false, '4 c. à soupe']],
    steps: ['Préchauffer le four à 170 °C.', 'Tailler les courgettes en fines lamelles dans la longueur (avec un économe), le haddock en tranches fines ; hacher le basilic.', 'Superposer dans un plat à gratin courgettes, parmesan, haddock et basilic ; arroser d’huile.', 'Enfourner 45 min.']
  },
  // ——— Riz et céréales ———
  {
    id: 'chili', name: 'Chili con carne', cat: ['mijote'], servings: 4, prep: 15, cook: 45, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Se congèle très bien (3 mois). Riz : à cuire à part (voir accompagnements).',
    subs: 'Moitié du haché ↔ lentilles corail pour une version plus économique.',
    per: [['haché de bœuf', 110, 'g', 'cru'], ['haricots rouges', 120, 'g', 'égoutté'], ['tomates concassées', 120, 'g', ''], ['poivron', 60, 'g', 'comestible'], ['oignon', 40, 'g', 'comestible'], ['épices', 2, 'g', ''], ["huile d'olive", 5, 'ml', ''], ['riz long', 70, 'g', 'sec', true]],
    steps: ['Faire revenir oignon et poivron dans l’huile.', 'Ajouter le haché, faire dorer, ajouter les épices (cumin, paprika, chili).', 'Ajouter tomates et haricots rincés, mijoter 30–40 min.', 'Cuire le riz à part.']
  },
  {
    id: 'paella', name: 'Paëlla au poulet', cat: ['mijote'], servings: 4, prep: 5, cook: 45, mode: 'full', fridge: 1, freeze: false,
    storage: 'Riz et moules : à manger dans les 24 h (refroidir en moins d’1 h). Ne pas congeler les moules.',
    subs: 'Moules ↔ crevettes. Chorizo ↔ dés de poivron en plus.',
    tot: [['riz rond (paella)', 400, 'g', 'sec'], ['cuisse de poulet', 500, 'g', 'cru', false, '2 cuisses coupées en 2'], ['moules', 600, 'g', '', false, '30 moules nettoyées'], ['poivron', 200, 'g', 'comestible', false, '1 poivron rouge'], ['chorizo', 110, 'g', '', false, '½ chorizo'], ['épices', 1, 'g', '', false, '2 dosettes de safran']],
    steps: ['Préchauffer le four à 180 °C.', 'Dans un grand plat : riz, cuisses de poulet, poivron en lamelles, chorizo en tranches, safran et 1 l d’eau. Poivrer, mélanger.', 'Enfourner 35 min.', 'Ajouter les moules, mélanger et cuire encore 10 min.']
  },
  {
    id: 'riz-cantonais', name: 'Riz cantonais aux crevettes', cat: ['riz'], servings: 4, prep: 10, cook: 18, mode: 'full', fridge: 1, freeze: true, months: 2,
    storage: 'Riz : refroidir rapidement, frigo 24 h maximum, sinon congeler (2 mois).',
    subs: 'Lardons ↔ dés de jambon. Crevettes ↔ poulet.',
    tot: [['riz long', 250, 'g', 'sec'], ['petits pois surgelés', 200, 'g', ''], ['crevettes décortiquées', 180, 'g', 'cru', false, '12 crevettes'], ['lardons', 200, 'g', 'cru'], ['œuf', 2, 'pièce', ''], ['oignon', 300, 'g', 'comestible', false, '2 oignons doux'], ["huile d'olive", 15, 'ml', '', false, 'ou huile neutre']],
    steps: ['Saisir 2 min à la poêle les oignons émincés, les lardons, les petits pois et les crevettes dans l’huile.', 'Ajouter le riz cru et 50 cl d’eau.', 'Cuire 12 à 15 min à feu doux en remuant de temps en temps.', 'Ajouter les œufs battus, cuire 2 min de plus. Saler, poivrer.']
  },
  {
    id: 'risotto-courgettes', name: 'Risotto aux courgettes', cat: ['riz'], servings: 2, prep: 10, cook: 25, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'À préparer au moment. Restes : frigo 24 h (en galettes poêlées, c’est très bon).',
    subs: 'Ajouter des petits pois ou des lardons. Parmesan ↔ chèvre frais.',
    per: [['riz pour risotto (arborio)', 75, 'g', 'sec'], ['courgette', 150, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['bouillon de légumes', 250, 'ml', ''], ['parmesan', 15, 'g', ''], ['beurre', 5, 'g', ''], ["huile d'olive", 5, 'ml', '']],
    steps: ['Faire revenir l’oignon et les courgettes en dés dans l’huile, réserver la moitié des courgettes.', 'Ajouter le riz, le nacrer 2 min.', 'Verser le bouillon chaud louche par louche en remuant, 18 min.', 'Hors du feu : courgettes réservées, beurre et parmesan.']
  },
  {
    id: 'kedgeree', name: 'Kedgeree léger et épicé', cat: ['riz'], servings: 6, prep: 15, cook: 30, mode: 'full', fridge: 1, freeze: false,
    storage: 'Poisson et œufs durs : frigo 24 h maximum. Ne se congèle pas.',
    subs: 'Haddock ↔ saumon ou colin. Yaourt facultatif.',
    tot: [['riz basmati', 300, 'g', 'sec'], ['haddock fumé', 600, 'g', 'cru'], ['œuf', 6, 'pièce', ''], ['oignon', 200, 'g', 'comestible', false, '2 oignons'], ['ail', 15, 'g', '', false, '3 gousses'], ['beurre', 50, 'g', ''], ['gingembre frais', 20, 'g', ''], ['piment rouge frais', 2, 'pièce', ''], ['coriandre', 20, 'g', ''], ['citron', 3, 'pièce', ''], ['épices', 6, 'g', '', false, 'garam masala, cumin, graines de moutarde, curcuma, laurier, poivre'], ['yaourt nature', 120, 'g', '', false, 'facultatif']],
    steps: ['Cuire le riz ; plonger les œufs dans la même eau pour les 6 premières minutes, puis les écaler et les couper en quatre.', 'Faire revenir oignons et ail dans le beurre avec les épices, le gingembre, le piment et les tiges de coriandre, 10 min.', 'Pocher le haddock 5 min avec laurier et poivre, puis l’émietter sans peau ni arêtes.', 'Mélanger le riz aux oignons avec le jus d’un citron et demi, puis le curcuma, le poisson, les œufs et les feuilles de coriandre.', 'Couvrir 2 min et servir avec des quartiers de citron et le yaourt.']
  },
  {
    id: 'lentilles-riz', name: 'Lentilles, riz et poivrons', cat: ['riz'], servings: 4, prep: 15, cook: 35, mode: 'full', fridge: 1, freeze: true, months: 3,
    storage: 'Contient du riz : frigo 24 h, sinon congeler (3 mois).',
    subs: 'Ajouter de la feta ou un œuf pour plus de protéines.',
    per: [['lentilles vertes', 60, 'g', 'sec'], ['riz long', 50, 'g', 'sec'], ['poivron', 100, 'g', 'comestible'], ['oignon', 40, 'g', 'comestible'], ['tomates concassées', 80, 'g', ''], ['épices', 1, 'g', ''], ["huile d'olive", 8, 'ml', '']],
    steps: ['Cuire les lentilles 25 min.', 'Cuire le riz.', 'Faire revenir oignon et poivrons, ajouter tomates, cumin, puis lentilles et riz.']
  },
  {
    id: 'saucisse-lentilles', name: 'Saucisses, lentilles et sauce tomate', cat: ['mijote'], servings: 4, prep: 15, cook: 50, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois (sans les brocolis, à cuire au moment).',
    subs: 'Saucisses italiennes ↔ saucisses de Toulouse ou de volaille. Brocolis ↔ haricots verts.',
    tot: [['saucisse de Toulouse', 600, 'g', 'cru', false, '8 saucisses moyennes (italiennes ou Toulouse)'], ['lentilles vertes', 400, 'g', 'sec', false, 'du Puy'], ['tomates concassées', 800, 'g', ''], ['oignon rouge', 100, 'g', 'comestible'], ['ail', 25, 'g', '', false, '5 gousses'], ['vinaigre de vin rouge', 30, 'ml', ''], ['brocoli', 500, 'g', ''], ['citron', 0.5, 'pièce', ''], ['persil', 30, 'g', ''], ["huile d'olive", 60, 'ml', ''], ['épices', 2, 'g', '', false, 'cannelle, piment séché, laurier, thym']],
    steps: ['Sauce : faire revenir oignon, ail, cannelle et piment 10 min ; ajouter le vinaigre puis les tomates, mijoter 30 min.', 'Lentilles : les couvrir d’eau avec ail, laurier et tiges de persil, cuire 25 min à feu doux.', 'Pendant ce temps, cuire les saucisses huilées 20 min au four à 200 °C.', 'Cuire les brocolis à l’eau bouillante, les assaisonner de citron et d’huile.', 'Assaisonner les lentilles (huile, persil haché, vinaigre), napper de sauce, poser saucisses et brocolis.']
  },

  // ——— Soupes ———
  {
    id: 'soupe-poulet-poche', name: 'Soupe au poulet poché', cat: ['soupe'], servings: 6, prep: 8, cook: 120, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Bouillon, poulet et légumes : frigo 3 jours, congélation 3 mois. Nouilles : à cuire au moment, dans le bouillon.',
    subs: 'Vermicelles de riz ↔ petites pâtes. Moutarde anglaise ↔ moutarde forte.',
    tot: [['poulet entier', 1500, 'g', 'cru'], ['poitrine fumée', 60, 'g', '', false, '4 tranches fines de lard fumé'], ['carotte', 360, 'g', 'comestible', false, '6 petites carottes'], ['épi de maïs', 4, 'pièce', ''], ['romarin frais', 20, 'g', ''], ['nouilles de riz', 150, 'g', 'sec', false, '3 nids de vermicelles de riz'], ['petits pois surgelés', 400, 'g', ''], ['moutarde', 30, 'g', '', false, 'pour le service']],
    steps: ['Dans une grande cocotte : le poulet, le lard tranché, les carottes entières et les épis coupés en trois. Couvrir de 4 l d’eau.', 'Porter à ébullition puis mijoter 1 h 30 à couvert, à feu moyen-doux.', 'Sortir le poulet, l’effilocher ; répartir lard, carottes et maïs dans les bols.', 'Faire bouillir le bouillon 2 min avec le romarin, les nouilles et les petits pois.', 'Servir les nouilles, les petits pois et le bouillon par-dessus, avec la moutarde.']
  },
  {
    id: 'soupe-indienne', name: 'Soupe indienne', cat: ['soupe'], servings: 4, prep: 10, cook: 24, mode: 'full', fridge: 1, freeze: true, months: 3,
    storage: 'Contient du riz : frigo 24 h, sinon congeler (3 mois).',
    subs: 'Épinards surgelés ↔ frais. Papadums ↔ croûtons de pain.',
    tot: [['carotte', 400, 'g', 'comestible'], ['oignon', 300, 'g', 'comestible', false, '2 oignons'], ['coriandre', 30, 'g', ''], ['pâte de curry', 15, 'g', '', false, 'Madras'], ['riz basmati', 150, 'g', 'sec'], ['épinards', 320, 'g', '', false, 'surgelés'], ['lait de coco', 400, 'ml', '', false, 'light'], ['papadums', 4, 'pièce', ''], ["huile d'olive", 15, 'ml', '']],
    steps: ['Faire revenir les carottes en fines rondelles et les oignons hachés dans l’huile, 10 min.', 'Ajouter les tiges de coriandre hachées, puis la pâte de curry, le riz et les épinards ; 5 min en remuant.', 'Verser le lait de coco et 3 boîtes d’eau, porter à ébullition.', 'Émietter les papadums dans la soupe, couvrir et mijoter 10 min.', 'Ajouter les feuilles de coriandre, assaisonner.']
  },
  {
    id: 'soupe-repas', name: 'Soupe-repas (légumes de saison)', cat: ['soupe'], servings: 4, prep: 15, cook: 30, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois.',
    subs: 'Lentilles corail ↔ pois cassés. Emmental ↔ œuf dur.',
    per: [['lentilles corail', 40, 'g', 'sec'], ['légumes de saison', 250, 'g', 'comestible'], ['pommes de terre', 100, 'g', 'cru'], ['bouillon de légumes', 300, 'ml', ''], ['emmental râpé', 15, 'g', ''], ['pain complet', 50, 'g', '', true]],
    steps: ['Couper les légumes et pommes de terre.', 'Cuire avec lentilles et bouillon 25 min.', 'Mixer, servir avec emmental et pain.']
  },
  {
    id: 'ribollita', name: 'Ribollita', cat: ['soupe'], servings: 6, prep: 30, cook: 120, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours (meilleure réchauffée, d’où son nom). Congélation 3 mois. Haricots secs : trempage la veille.',
    subs: 'Haricots secs ↔ 2 boîtes de haricots blancs (sauter le trempage). Chou noir ↔ chou frisé ou kale.',
    tot: [['haricots blancs secs', 310, 'g', 'sec', false, 'cannellini, trempés la nuit'], ['tomates', 120, 'g', '', false, '1 tomate'], ['pommes de terre', 100, 'g', 'cru', false, '1 petite'], ['oignon rouge', 200, 'g', 'comestible', false, '2 oignons'], ['carotte', 200, 'g', 'comestible'], ['céleri branche', 150, 'g', '', false, '3 branches'], ['ail', 15, 'g', '', false, '3 gousses'], ['tomates concassées', 400, 'g', '', false, 'tomates entières en boîte'], ['chou kale (cavolo nero)', 310, 'g', ''], ['pain complet', 150, 'g', '', false, 'pain rassis'], ["huile d'olive", 60, 'ml', ''], ['épices', 2, 'g', '', false, 'graines de fenouil, piment séché, laurier']],
    steps: ['Cuire les haricots trempés avec le laurier, la tomate et la pomme de terre, environ 1 h. Garder un peu d’eau de cuisson.', 'Hacher oignons, carottes, céleri et ail ; les faire suer doucement 15–20 min avec le fenouil et le piment.', 'Ajouter les tomates en boîte, mijoter quelques minutes.', 'Ajouter les haricots, un peu de leur eau, et le chou émincé ; porter à ébullition.', 'Incorporer le pain en morceaux, mouiller si besoin, cuire 30 min jusqu’à une soupe épaisse. Finir avec un filet d’huile.']
  },
  {
    id: 'soupe-pois-chiches', name: 'Soupe aux pois chiches et aux fèves', cat: ['soupe'], servings: 6, prep: 20, cook: 40, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois.',
    subs: 'Fèves ↔ petits pois. Le livre sert la soupe avec un pesto myrte-noix : le pesto basilic le remplace.',
    tot: [['pois chiches', 450, 'g', 'égoutté', false, '1 bocal de 700 g'], ['fèves surgelées', 150, 'g', '', false, '350 g de fèves fraîches en gousse'], ['oignon rouge', 100, 'g', 'comestible'], ['carotte', 100, 'g', 'comestible'], ['céleri branche', 100, 'g', '', false, '½ cœur de céleri'], ['courgette', 300, 'g', ''], ['pain complet', 200, 'g', '', false, 'pain au levain rassis'], ["huile d'olive", 30, 'ml', ''], ['épices', 2, 'g', '', false, '4 piments rouges secs'], ['pesto basilic', 60, 'g', '']],
    steps: ['Faire revenir les piments secs 2 min dans l’huile, puis les réserver dans un bol avec cette huile.', 'Couper oignon, carotte, céleri et courgette en morceaux ; les cuire 15 min dans la cocotte.', 'Ajouter les fèves, les pois chiches avec leur jus et 3 pichets d’eau ; mijoter 15 min.', 'Ajouter le pain en petits morceaux, couper le feu et laisser reposer 15 min. Assaisonner.', 'Servir avec un peu de pesto et l’huile pimentée.']
  },
  {
    id: 'mulligatawny', name: 'Mulligatawny', cat: ['soupe'], servings: 6, prep: 20, cook: 60, mode: 'full', fridge: 1, freeze: true, months: 3,
    storage: 'Contient du riz : frigo 24 h, sinon congeler (3 mois).',
    subs: 'Steak haché ↔ lentilles corail pour une version végétarienne. Sauce HP ↔ un peu de sauce Worcestershire.',
    tot: [['haché de bœuf', 250, 'g', 'cru'], ['oignon rouge', 100, 'g', 'comestible'], ['carotte', 200, 'g', 'comestible'], ['ail', 20, 'g', '', false, '4 gousses'], ['poivron', 200, 'g', 'comestible', false, '1 poivron rouge'], ['gingembre frais', 15, 'g', '', false, '3 cm'], ['piment rouge frais', 1, 'pièce', ''], ['coriandre', 20, 'g', ''], ['pâte de curry', 20, 'g', ''], ['concentré de tomate', 20, 'g', ''], ['sauce HP', 20, 'ml', ''], ['bouillon de bœuf', 1500, 'ml', ''], ['courge butternut', 350, 'g', 'comestible', false, '½ courge'], ['riz basmati', 200, 'g', 'sec', false, '1 tasse'], ['yaourt nature', 120, 'g', ''], ["huile d'olive", 15, 'ml', ''], ['épices', 2, 'g', '', false, 'garam masala, thym']],
    steps: ['Dorer le haché 7 min dans l’huile en l’émiettant.', 'Ajouter oignon, carottes, ail, poivron, gingembre, piment et tiges de coriandre hachés ; cuire 10 min.', 'Ajouter pâte de curry, concentré de tomate et sauce HP, puis le bouillon ; couvrir et cuire 40 min.', 'Pendant ce temps : dorer la courge en dés avec thym et garam masala, ajouter le riz et 2 tasses d’eau, cuire 8 min puis reposer 8 min à couvert.', 'Verser le riz à la courge dans la soupe ; servir avec le yaourt et les feuilles de coriandre.']
  },

  // ——— Curry et épices ———
  {
    id: 'tikka-masala', name: 'Curry tikka masala', cat: ['mijote'], servings: 4, prep: 15, cook: 30, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois. Riz : à cuire à part.',
    subs: 'Poulet ↔ pois chiches + chou-fleur. Crème ↔ yaourt (hors du feu).',
    per: [['blanc de poulet', 130, 'g', 'cru'], ['yaourt nature', 30, 'g', ''], ['pâte de curry', 15, 'g', '', false, 'tikka masala'], ['oignon', 40, 'g', 'comestible'], ['ail', 3, 'g', ''], ['gingembre frais', 3, 'g', ''], ['tomates concassées', 100, 'g', ''], ['crème légère', 30, 'ml', ''], ["huile d'olive", 5, 'ml', ''], ['coriandre', 3, 'g', ''], ['riz basmati', 70, 'g', 'sec', true]],
    steps: ['Mariner le poulet en dés avec le yaourt et la moitié de la pâte de curry (15 min ou la veille).', 'Faire dorer le poulet, réserver.', 'Faire revenir oignon, ail et gingembre, ajouter le reste de pâte de curry puis les tomates ; mijoter 15 min.', 'Remettre le poulet, ajouter la crème, 5 min. Coriandre au service, riz à part.']
  },
  {
    id: 'curry-kefta', name: 'Curry de kefta', cat: ['mijote'], servings: 4, prep: 25, cook: 30, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois (boulettes dans leur sauce). Riz : à cuire à part.',
    subs: 'Haché de bœuf ↔ haché d’agneau ou de volaille. Riz ↔ semoule ou pain naan.',
    per: [['haché de bœuf', 110, 'g', 'cru'], ['oignon', 40, 'g', 'comestible'], ['ail', 3, 'g', ''], ['coriandre', 3, 'g', ''], ['épices', 3, 'g', '', false, 'cumin, paprika, cannelle, curry'], ['tomates concassées', 120, 'g', ''], ['lait de coco', 50, 'ml', ''], ["huile d'olive", 5, 'ml', ''], ['riz basmati', 70, 'g', 'sec', true]],
    steps: ['Mélanger haché, moitié de l’oignon râpé, coriandre et la moitié des épices ; former des petites boulettes.', 'Les dorer à la poêle, réserver.', 'Faire revenir le reste d’oignon, l’ail et les épices, ajouter tomates et lait de coco ; mijoter 10 min.', 'Remettre les boulettes 15 min dans la sauce. Riz à part.']
  },
  {
    id: 'pois-chiches-epices', name: 'Pois chiches épicés', cat: ['mijote'], servings: 4, prep: 5, cook: 20, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Frigo 3 jours. Congélation 3 mois.',
    subs: 'Tomates fraîches ↔ 1 boîte de tomates concassées. Riz : accompagnement suggéré.',
    tot: [['pâte de curry', 60, 'g', ''], ["huile d'olive", 15, 'ml', ''], ['tomates', 500, 'g', '', false, 'bien mûres'], ['pois chiches', 400, 'g', 'égoutté', false, '1 bocal de 570 g'], ['lait de coco', 400, 'ml', '', false, 'allégé'], ['chutney de mangue', 15, 'g', ''], ['riz basmati', 240, 'g', 'sec', true]],
    steps: ['Dans une cocotte, chauffer la pâte de curry avec l’huile.', 'Ajouter les tomates hachées, cuire 5 min.', 'Ajouter les pois chiches égouttés et le lait de coco ; mijoter 15 min en écrasant une partie des pois chiches.', 'Incorporer le chutney de mangue, assaisonner.']
  },

  // ——— Pâtes ———
  {
    id: 'bolognaise', name: 'Pâtes bolognaise', cat: ['pates'], servings: 4, prep: 15, cook: 40, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Sauce : frigo 3 jours, congélation 3 mois. Pâtes : à cuire le jour même de préférence.',
    subs: 'Moitié du haché ↔ lentilles corail.',
    per: [['haché de bœuf', 100, 'g', 'cru'], ['tomates concassées', 150, 'g', ''], ['oignon', 30, 'g', 'comestible'], ['carotte', 30, 'g', 'comestible'], ["huile d'olive", 5, 'ml', ''], ['pâtes', 80, 'g', 'sec', true], ['parmesan', 8, 'g', '', true]],
    steps: ['Faire revenir oignon et carotte, ajouter le haché.', 'Ajouter les tomates, mijoter 30 min.', 'Cuire les pâtes au moment du repas ; parmesan.']
  },
  {
    id: 'carbonara', name: 'Pâtes carbonara', cat: ['pates'], servings: 2, prep: 10, cook: 12, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'À préparer au moment.',
    subs: 'Lardons ↔ guanciale ou dés de jambon.',
    per: [['pâtes', 80, 'g', 'sec'], ['lardons', 60, 'g', 'cru'], ['œuf', 1, 'pièce', ''], ['parmesan', 15, 'g', '']],
    steps: ['Cuire les pâtes, garder un peu d’eau de cuisson.', 'Dorer les lardons.', 'Hors du feu, mélanger pâtes, lardons, œuf battu + parmesan et un peu d’eau de cuisson.']
  },
  {
    id: 'pates-champignons-lardons', name: 'Pâtes aux champignons et lardons', cat: ['pates'], servings: 2, prep: 10, cook: 15, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'À préparer au moment. Champignons émincés la veille : frigo, boîte fermée.',
    subs: 'Lardons ↔ dés de poulet. Crème ↔ moitié crème, moitié lait.',
    per: [['pâtes', 80, 'g', 'sec'], ['champignons', 125, 'g', ''], ['lardons', 50, 'g', 'cru'], ['oignon', 30, 'g', 'comestible'], ['crème légère', 30, 'ml', ''], ['parmesan', 8, 'g', '']],
    steps: ['Dorer les lardons, ajouter l’oignon puis les champignons émincés ; 8 min.', 'Ajouter la crème, laisser réduire 2 min.', 'Mélanger avec les pâtes cuites et un peu d’eau de cuisson ; parmesan.']
  },
  {
    id: 'pates-butternut', name: 'Pâtes à la courge butternut', cat: ['pates'], servings: 4, prep: 15, cook: 30, mode: 'full', fridge: 3, freeze: true, months: 3,
    storage: 'Sauce butternut : frigo 3 jours, congélation 3 mois. Pâtes à cuire au moment.',
    subs: 'Butternut ↔ potiron. Ajouter des lardons ou des pois chiches pour plus de protéines.',
    per: [['courge butternut', 200, 'g', 'comestible'], ['oignon', 30, 'g', 'comestible'], ['crème légère', 30, 'ml', ''], ['parmesan', 10, 'g', ''], ['pâtes', 80, 'g', 'sec', true]],
    steps: ['Cuire la butternut en dés avec l’oignon (20 min).', 'Mixer avec la crème et le parmesan.', 'Mélanger avec les pâtes cuites au moment.']
  },
  {
    id: 'pates-saumon-epinards', name: 'Pâtes saumon et épinards', cat: ['pates'], servings: 2, prep: 10, cook: 15, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'À préparer au moment. Saumon cru : congeler s’il est mangé en fin de semaine.',
    subs: 'Saumon frais ↔ saumon fumé (ajouté hors du feu). Épinards frais ↔ surgelés.',
    per: [['pâtes', 80, 'g', 'sec'], ['pavé de saumon', 110, 'g', 'cru'], ['épinards', 100, 'g', ''], ['crème légère', 40, 'ml', ''], ['ail', 2, 'g', ''], ['citron', 0.25, 'pièce', ''], ['parmesan', 5, 'g', '']],
    steps: ['Cuire les pâtes.', 'Saisir le saumon en dés 3 min, réserver.', 'Faire tomber les épinards avec l’ail, ajouter la crème et le zeste de citron.', 'Mélanger pâtes, sauce et saumon ; jus de citron et parmesan.']
  },
  {
    id: 'pates-brocolis-poulet', name: 'Pâtes au poulet et brocolis', cat: ['pates'], servings: 2, prep: 10, cook: 15, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'À préparer au moment. Restes : frigo 2 jours.',
    subs: 'Crème ↔ pesto. Brocoli ↔ courgette.',
    per: [['pâtes', 80, 'g', 'sec'], ['blanc de poulet', 110, 'g', 'cru'], ['brocoli', 120, 'g', ''], ['ail', 2, 'g', ''], ['crème légère', 30, 'ml', ''], ['parmesan', 8, 'g', ''], ["huile d'olive", 5, 'ml', '']],
    steps: ['Cuire les pâtes ; ajouter les fleurettes de brocoli dans la même eau 4 min avant la fin.', 'Dorer le poulet en dés avec l’ail.', 'Ajouter la crème, puis pâtes et brocolis égouttés ; parmesan.']
  },
  {
    id: 'pates-petits-pois', name: 'Pâtes aux petits pois, lardons et oignons', cat: ['pates'], servings: 2, prep: 10, cook: 15, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'À préparer au moment.',
    subs: 'Lardons ↔ dés de jambon ou de poulet.',
    per: [['pâtes', 80, 'g', 'sec'], ['petits pois surgelés', 80, 'g', ''], ['lardons', 50, 'g', 'cru'], ['oignon', 40, 'g', 'comestible'], ['crème légère', 30, 'ml', ''], ['parmesan', 8, 'g', '']],
    steps: ['Faire revenir oignon et lardons.', 'Ajouter petits pois et un fond d’eau, 5 min, puis la crème.', 'Mélanger avec les pâtes cuites.']
  },
  {
    id: 'puttanesca', name: 'Pâtes à la puttanesca', cat: ['pates'], servings: 2, prep: 5, cook: 15, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'La sauce se garde 3 jours au frigo et se congèle (3 mois). Pâtes à cuire au moment.',
    subs: 'Ajouter une boîte de thon pour plus de protéines.',
    per: [['pâtes', 80, 'g', 'sec'], ['tomates concassées', 150, 'g', ''], ['olives noires', 20, 'g', 'égoutté'], ['câpres', 8, 'g', 'égoutté'], ['anchois', 8, 'g', ''], ['ail', 3, 'g', ''], ['épices', 0.5, 'g', '', false, 'piment séché'], ["huile d'olive", 8, 'ml', ''], ['persil', 3, 'g', '']],
    steps: ['Faire fondre les anchois dans l’huile avec l’ail et le piment.', 'Ajouter tomates, olives et câpres ; mijoter 10 min.', 'Mélanger avec les pâtes cuites ; persil.']
  },
  {
    id: 'pasta-e-ceci', name: 'Pâtes aux pois chiches (pasta e ceci)', cat: ['pates'], servings: 4, prep: 10, cook: 55, mode: 'full', fridge: 3, freeze: true, months: 2,
    storage: 'Frigo 3 jours (allonger avec un peu d’eau en réchauffant). Congélation 2 mois.',
    subs: 'Bouillon de volaille ↔ bouillon de légumes pour une version végétarienne. Ditalini ↔ petites pâtes.',
    tot: [['oignon', 80, 'g', 'comestible', false, '1 petit oignon'], ['céleri branche', 50, 'g', '', false, '1 branche'], ['ail', 5, 'g', '', false, '1 gousse'], ["huile d'olive", 15, 'ml', ''], ['romarin frais', 2, 'g', '', false, '1 brin'], ['pois chiches', 480, 'g', 'égoutté', false, '2 boîtes de 400 g'], ['bouillon de volaille', 500, 'ml', ''], ['petites pâtes', 100, 'g', 'sec', false, 'ditalini'], ['basilic frais', 5, 'g', '', false, 'ou persil']],
    steps: ['Faire suer oignon, céleri, ail et romarin hachés dans l’huile, 15–20 min sans coloration.', 'Ajouter les pois chiches rincés et le bouillon, cuire 30 min à feu doux.', 'Réserver la moitié des pois chiches, mixer le reste de la soupe, puis remettre les pois chiches entiers.', 'Ajouter les pâtes et cuire jusqu’à ce qu’elles soient tendres (allonger d’eau si besoin).', 'Servir avec un filet d’huile et le basilic.']
  },
  {
    id: 'conchiglioni', name: 'Pâtes aux légumes rôtis et pesto (conchiglioni)', cat: ['pates'], servings: 4, prep: 50, cook: 55, mode: 'full', fridge: 3, freeze: false,
    storage: 'Frigo 3 jours : se mange chaude ou en salade froide.',
    subs: 'Pesto maison ↔ pesto du commerce. Amandes ↔ pignons.',
    tot: [['conchiglioni', 500, 'g', 'sec'], ['courgette', 600, 'g', '', false, '2 courgettes'], ['aubergine', 300, 'g', '', false, '1 aubergine'], ['tomates', 360, 'g', '', false, '3 tomates'], ['poivron', 400, 'g', 'comestible', false, '1 rouge + 1 vert'], ['oignon', 200, 'g', 'comestible', false, '2 oignons'], ['ail', 5, 'g', '', false, '1 gousse'], ['amandes', 30, 'g', ''], ['parmesan', 30, 'g', ''], ['basilic frais', 60, 'g', '', false, '2 bouquets'], ["huile d'olive", 105, 'ml', '', false, '7 c. à soupe']],
    steps: ['Couper tous les légumes en petits cubes ; les rôtir 45 min à 180 °C avec 3 c. à soupe d’huile, sel et poivre, en remuant de temps en temps.', 'Pesto : mixer ail, amandes, parmesan et basilic en versant le reste d’huile en filet.', 'Cuire les pâtes ; détendre le pesto avec une petite louche d’eau de cuisson.', 'Mélanger pâtes, pesto et légumes. Servir chaud ou froid.']
  },

  // ——— Asie ———
  {
    id: 'pad-thai', name: 'Pad thaï à la crevette', cat: ['pates'], servings: 4, prep: 15, cook: 15, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'Meilleur fraîchement préparé. Restes : frigo, 24 h maximum.',
    subs: 'Crevettes ↔ blanc de poulet ou tofu ferme. Ajouter un œuf brouillé ou des germes de soja.',
    tot: [['nouilles de riz', 200, 'g', 'sec'], ['oignon nouveau', 40, 'g', '', false, '2 oignons nouveaux'], ['crevettes décortiquées', 300, 'g', 'cru', false, '20 crevettes crues'], ['coriandre', 30, 'g', '', false, '1 botte'], ['sauce soja', 120, 'ml', '', false, '8 c. à soupe'], ['cacahuètes', 70, 'g', '', false, 'grillées'], ["huile d'olive", 60, 'ml', '', false, '4 c. à soupe']],
    steps: ['Cuire les nouilles al dente à l’eau bouillante salée.', 'Saisir les crevettes avec les oignons émincés dans l’huile, 3 min en remuant.', 'Ajouter les nouilles, la sauce soja et les cacahuètes concassées ; mélanger.', 'Hors du feu, ajouter la coriandre hachée.']
  },
  {
    id: 'boeuf-croustillant', name: 'Bœuf croustillant à l’asiatique et nouilles de riz', cat: ['pates'], servings: 2, prep: 15, cook: 10, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'À préparer au moment (25 min). Bœuf haché cru : congeler s’il est mangé en fin de semaine.',
    subs: 'Nouilles de riz complet ↔ nouilles de riz classiques. Miel ↔ sirop d’érable.',
    tot: [['haché de bœuf', 200, 'g', 'cru', false, 'maigre'], ['nouilles de riz', 150, 'g', 'sec', false, 'complètes si possible'], ['cacahuètes', 15, 'g', '', false, 'nature'], ['ail', 10, 'g', '', false, '2 gousses'], ['gingembre frais', 25, 'g', '', false, '5 cm'], ['huile de sésame', 15, 'ml', ''], ['miel', 7, 'g', ''], ['sauce poisson (nuoc-mâm)', 5, 'ml', ''], ['sauce soja', 5, 'ml', ''], ['citron vert', 2, 'pièce', ''], ['oignon nouveau', 30, 'g', '', false, '2 oignons verts'], ['piment rouge frais', 1, 'pièce', ''], ['salade verte', 120, 'g', '', false, 'crudités : laitue, cresson, épinards'], ['carotte', 80, 'g', 'comestible'], ['coriandre', 5, 'g', ''], ['épices', 1, 'g', '', false, '2 étoiles de badiane']],
    steps: ['Griller les cacahuètes à sec, les concasser.', 'Dans l’huile de sésame avec la badiane, émietter le haché ; ajouter la moitié de l’ail et du gingembre, puis le miel. Poêler 5 min jusqu’à ce que ce soit croustillant.', 'Sauce : piler le reste d’ail et de gingembre avec le nuoc-mâm, la sauce soja et le jus des citrons verts.', 'Cuire les nouilles ; préparer la salade (carotte en allumettes, feuilles déchirées).', 'Dresser salade, nouilles, sauce, bœuf, puis oignons, piment, cacahuètes et coriandre.']
  },

  // ——— Œufs et poêlées ———
  {
    id: 'oeufs-au-plat', name: 'Œufs au plat réconfortants (riz, saucisse, lard)', cat: ['autre'], servings: 2, prep: 5, cook: 10, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'À préparer au moment (15 min).',
    subs: 'Version végétarienne : saucisses végétariennes et champignons hachés. Riz cuit en sachet ↔ reste de riz.',
    tot: [['saucisse de Toulouse', 140, 'g', 'cru', false, '2 saucisses de porc'], ['poitrine fumée', 40, 'g', '', false, '2 tranches fines de lard fumé'], ['oignon nouveau', 60, 'g', '', false, '4 oignons nouveaux'], ['sauce HP', 15, 'ml', ''], ['riz basmati', 90, 'g', 'sec', false, 'ou 1 sachet de riz cuit (250 g)'], ['sauce pimentée', 45, 'ml', ''], ['œuf', 2, 'pièce', ''], ['pain complet', 80, 'g', '', false, '2 tranches de pain au levain']],
    steps: ['Dans une grande poêle, faire tomber la chair des saucisses et le lard haché ; dorer en émiettant.', 'Ajouter les oignons nouveaux en tronçons et la sauce HP, 2 min.', 'Ajouter le riz cuit, 2 min en remuant, puis le pousser sur un côté.', 'Verser la sauce pimentée, casser les œufs, couvrir le temps de griller le pain.']
  },
  {
    id: 'chakchouka-pois-chiches', name: 'Chakchouka aux pois chiches', cat: ['mijote'], servings: 2, prep: 3, cook: 10, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'À préparer au moment (13 min).',
    subs: 'Pâte de curry korma ↔ autre pâte douce. Pain complet grillé pour tremper.',
    tot: [['noix de cajou', 30, 'g', '', false, 'non salées'], ['oignon nouveau', 150, 'g', '', false, '1 bouquet'], ['pâte de curry', 10, 'g', '', false, 'korma, 2 c. à café'], ['pois chiches', 240, 'g', 'égoutté', false, '1 boîte de 400 g, avec leur jus'], ['lait de coco', 15, 'ml', '', false, '1 c. à soupe de crème de coco'], ['épinards', 100, 'g', '', false, 'jeunes pousses'], ['œuf', 4, 'pièce', ''], ['yaourt nature', 30, 'g', '']],
    steps: ['Griller les noix de cajou à la poêle, ajouter les oignons en rondelles et la pâte de curry ; 5 min.', 'Ajouter les pois chiches avec leur jus, la crème de coco et les épinards ; porter à ébullition.', 'Écraser la moitié des pois chiches, faire des puits et casser les œufs ; couvrir 3 min.', 'Finir avec le yaourt et un peu de poivre.']
  },
  {
    id: 'shakshuka', name: 'Chakchouka classique', cat: ['mijote'], servings: 2, prep: 10, cook: 20, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'La sauce poivrons-tomates peut être préparée à l’avance (frigo 3 jours) ; œufs au moment.',
    subs: 'Feta ↔ chèvre frais.',
    per: [['œuf', 2, 'pièce', ''], ['tomates concassées', 200, 'g', ''], ['poivron', 100, 'g', 'comestible'], ['oignon', 40, 'g', 'comestible'], ['feta', 30, 'g', ''], ['épices', 1, 'g', ''], ["huile d'olive", 5, 'ml', ''], ['pain complet', 60, 'g', '', true]],
    steps: ['Faire revenir oignon et poivron, ajouter tomates et épices, 10 min.', 'Creuser des puits, casser les œufs, couvrir 6–8 min.', 'Feta émiettée, servir avec le pain.']
  },

  // ——— Bowls et salades ———
  {
    id: 'protein-bowl', name: 'Protein bowl', cat: ['salade'], servings: 2, prep: 15, cook: 15, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'Quinoa et poulet cuits : frigo 3 jours. Assembler et assaisonner au moment.',
    subs: 'Poulet ↔ thon, œufs ou tofu. Quinoa ↔ riz.',
    per: [['quinoa', 60, 'g', 'sec'], ['blanc de poulet', 120, 'g', 'cru'], ['pois chiches', 60, 'g', 'égoutté'], ['œuf', 1, 'pièce', ''], ['avocat', 0.5, 'pièce', ''], ['concombre', 80, 'g', ''], ['tomates cerises', 80, 'g', ''], ['yaourt grec', 30, 'g', '', false, 'sauce'], ['citron', 0.25, 'pièce', ''], ["huile d'olive", 5, 'ml', '']],
    steps: ['Cuire le quinoa (12 min) et l’œuf dur (9 min).', 'Cuire le poulet à la poêle, le trancher.', 'Sauce : yaourt, citron, sel, poivre.', 'Disposer quinoa, poulet, pois chiches, légumes, avocat et œuf ; sauce au moment.']
  },
  {
    id: 'salade-pates', name: 'Salade de pâtes', cat: ['salade'], servings: 2, prep: 15, cook: 12, mode: 'prep', quick: true, fridge: 2, freeze: false,
    storage: 'Frigo 2 jours, assaisonnement à part. Pratique pour les lunchbox.',
    subs: 'Thon ↔ poulet ou mozzarella. Maïs ↔ poivron.',
    per: [['pâtes', 70, 'g', 'sec'], ['thon au naturel', 60, 'g', 'égoutté'], ['tomates cerises', 80, 'g', ''], ['concombre', 60, 'g', ''], ['maïs doux', 40, 'g', 'égoutté'], ['mozzarella', 30, 'g', ''], ["huile d'olive", 8, 'ml', ''], ['basilic frais', 3, 'g', '']],
    steps: ['Cuire les pâtes, les rincer à l’eau froide.', 'Couper tomates, concombre et mozzarella.', 'Mélanger avec le thon et le maïs ; assaisonner au moment.']
  },
  {
    id: 'salade-riz', name: 'Salade de riz', cat: ['salade'], servings: 2, prep: 15, cook: 12, mode: 'prep', quick: true, fridge: 1, freeze: false,
    storage: 'Riz : refroidir rapidement, frigo 24 h maximum.',
    subs: 'Thon ↔ crevettes ou jambon.',
    per: [['riz long', 60, 'g', 'sec'], ['thon au naturel', 60, 'g', 'égoutté'], ['œuf', 1, 'pièce', ''], ['maïs doux', 40, 'g', 'égoutté'], ['tomates', 100, 'g', ''], ['poivron', 50, 'g', 'comestible'], ['olives noires', 10, 'g', 'égoutté'], ["huile d'olive", 8, 'ml', '']],
    steps: ['Cuire le riz et l’œuf dur ; refroidir le riz étalé.', 'Couper tomates, poivron et œuf.', 'Mélanger avec thon, maïs et olives ; assaisonner au moment.']
  },
  {
    id: 'salade-grecque', name: 'Salade grecque', cat: ['salade'], servings: 2, prep: 15, cook: 0, mode: 'prep', quick: true, fridge: 2, freeze: false,
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

/** Recettes par défaut d'une version précédente, par empreinte (contenu jamais modifié) : la mise à jour 4 les remplace. */
export const LEGACY_FINGERPRINTS: Record<string, string> = {
  'pad-thai': 'tezl21', 'boulettes-puree': '4yp9vz', chili: '19x9k3v', couscous: 'yruyt7', hachis: '11cafgr', lasagnes: 'otzymm',
  moussaka: '1r20mao', cassoulet: '1byje7l', choucroute: '1bzwhds', paella: '1xr1efm', 'riz-cantonais': '1c2qirr', kedgeree: 'xi0x89',
  'saumon-epinards': '9dyrpu', 'colin-gratin': '18z43yu', conchiglioni: 'u7s1bx', bolognaise: '1ao403w', 'pates-pesto': 'irisq9',
  'pates-petits-pois': '1n08e1q', carbonara: '1cunz9m', 'pates-butternut': 'uxs5yk', 'pates-poulet': 'msrtvi', 'lentilles-riz': '1w9bwgv',
  'saucisse-lentilles': '1u4n5zq', 'soupe-pois-chiches': 'ua8c6j', mulligatawny: '1wmgcpy', shakshuka: '1taw5e0', minestrone: '5mf7et',
  'soupe-repas': 'luyd8', 'salade-grecque': '1ycv4xs', 'salade-cesar': '8or1cq'
};

export function defaultRecipes(): Recipe[] {
  return D.map((d) => {
    const book = !!d.tot;
    const lines = (d.tot ?? d.per ?? []).map(([name, qty, unit, state, accomp, note]): IngredientLine => ({
      name,
      qty: book ? qty : Math.round(qty * d.servings * 100) / 100,
      unit,
      state,
      ...(accomp ? { accomp: true } : {}),
      ...(note ? { note } : {})
    }));
    return {
      id: d.id,
      name: d.name,
      categories: d.cat,
      servings: d.servings,
      prepMin: d.prep,
      cookMin: d.cook,
      ingredients: lines,
      steps: d.steps,
      substitutions: d.subs ?? '',
      fridgeDays: d.fridge,
      freezable: d.freeze,
      freezerMonths: d.months ?? 0,
      storageNotes: d.storage ?? '',
      batchMode: d.mode,
      quick: !!d.quick,
      provisional: !book
    };
  });
}

/**
 * Mise à jour de la bibliothèque vers la liste actuelle, sans jamais perdre une modification :
 * - recette par défaut jamais modifiée → remplacée par sa nouvelle version (photo et réglages conservés) ;
 * - recette modifiée à la main, ou créée par l'utilisatrice → gardée telle quelle ;
 * - ancienne recette par défaut absente de la liste → retirée seulement si jamais modifiée ET plus utilisée
 *   (repas planifiés, congélateur…) ;
 * - nouvelle recette → ajoutée, sauf si une recette du même nom existe déjà.
 * `isUsed(id)` dit si une recette est encore référencée ailleurs dans les données.
 */
export function upgradeRecipes(current: Recipe[], isUsed: (id: string) => boolean): Recipe[] {
  const next = new Map(defaultRecipes().map((r) => [r.id, r]));
  const untouched = (r: Recipe) => LEGACY_FINGERPRINTS[r.id] === recipeFingerprint(r);
  const out: Recipe[] = [];
  for (const r of current) {
    const n = next.get(r.id);
    next.delete(r.id);
    if (n && untouched(r)) {
      const keep: Partial<Recipe> = {};
      for (const k of ['photo', 'excludeFromRotation', 'manualCost', 'nutrition'] as const) if (r[k] !== undefined) (keep as Record<string, unknown>)[k] = r[k];
      out.push({ ...n, ...keep });
    } else if (!n && untouched(r) && !isUsed(r.id)) {
      continue;
    } else {
      // recette gardée : nouvelles catégories (celles de la liste pour une recette par défaut, sinon devinées)
      out.push({ ...r, categories: n ? n.categories : normalizeCategories(r) });
    }
  }
  const names = new Set(out.map((r) => ingredientKey(r.name)));
  for (const r of next.values()) if (!names.has(ingredientKey(r.name))) out.push(r);
  return out;
}

const CATEGORIES: RecipeCategory[] = ['pates', 'soupe', 'salade', 'riz', 'mijote', 'autre'];

/** Anciennes catégories (plat, végétarien…) → catégories actuelles, d'après le nom de la recette. */
export function normalizeCategories(r: Pick<Recipe, 'id' | 'name' | 'categories'>): RecipeCategory[] {
  const ok = r.categories.filter((c) => CATEGORIES.includes(c));
  if (ok.length) return ok;
  const known = D.find((d) => d.id === r.id);
  if (known) return known.cat;
  const k = ingredientKey(r.name);
  if (k.includes('salade') || k.includes('bowl')) return ['salade'];
  if (k.includes('soupe') || k.includes('veloute')) return ['soupe'];
  if (/(pates|spaghetti|tagliatelle|penne|lasagne)/.test(k)) return ['pates'];
  if (/(riz|risotto)/.test(k)) return ['riz'];
  return ['autre'];
}

/** Empreinte du contenu d'une recette (nom, portions, ingrédients, étapes) : sert à reconnaître une recette jamais modifiée. */
export function recipeFingerprint(r: Pick<Recipe, 'name' | 'servings' | 'ingredients' | 'steps'>): string {
  const s = JSON.stringify([r.name, r.servings, r.ingredients.map((i) => [i.name, i.qty, i.unit, i.state, !!i.accomp]), r.steps]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}
