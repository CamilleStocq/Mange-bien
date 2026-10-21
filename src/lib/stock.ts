import type { AppData } from '../store/types';
import { addDays, weekStart } from './dates';
import { ingredientKey } from './units';

/**
 * Ce qu'il y a à la maison au début d'une semaine :
 * - stock saisi à la main (« Ce que j'ai déjà »), à partir du jour où il a été saisi ;
 * - surplus des courses : un format entier acheté pour un besoin plus petit (2 kg d'oignons pour 360 g) ;
 *   le reste passe aux semaines suivantes et se déduit au fil des repas ;
 * - le frais (légumes, viande, poisson, laitier) ne se garde qu'une semaine, sauf ce qui se conserve
 *   longtemps (oignons, ail, pommes de terre, courge, carottes, agrumes) ;
 * - placard : les basiques (huile, épices, sauces…) achetés une fois ne reviennent plus sur la liste,
 *   jusqu'à ce que tu indiques « presque fini ».
 */

/** Basiques du placard : on en achète un format, il dure plusieurs semaines. */
export const STAPLES = new Set([
  'epices', "huile d'olive", 'huile de sesame', 'sauce soja', 'sauce poisson (nuoc-mam)', 'vinaigre de vin rouge', 'farine', 'moutarde', 'miel',
  'chapelure', 'bouillon de legumes', 'bouillon de volaille', 'bouillon de boeuf', 'concentre de tomate', 'pate de curry', 'sauce hp', 'sauce pimentee',
  'chutney de mangue', 'graisse de canard', 'capres', 'cacahuetes', 'amandes', 'noix de cajou', 'papadums'
].map(ingredientKey));

const LONG_KEEP = new Set(['oignon', 'oignon rouge', 'ail', 'pommes de terre', 'courge butternut', 'carotte', 'citron', 'citron vert', 'gingembre frais'].map(ingredientKey));
const PERISHABLE_AISLES = new Set(['fruits-legumes', 'proteines', 'laitiers']);

export function isStaple(data: AppData, key: string): boolean {
  return STAPLES.has(key) || !!data.pantry[key]?.staple;
}

/** « J'en ai assez » pour cette semaine : coché à la main, ou basique du placard acheté une semaine précédente. */
export function hasEnough(data: AppData, key: string, monday: string): boolean {
  const p = data.pantry[key];
  return !!p?.all && (!p.since || monday > p.since);
}

/** Quantités nécessaires par ingrédient pour une semaine (calcul fourni par la liste de courses). */
export type WeekNeeds = (monday: string) => Map<string, number>;

interface Lot { qty: number; expires?: string }

/** Stock disponible au début de la semaine `monday`, par ingrédient (hors placard « assez »). */
export function stockAt(data: AppData, monday: string, needsOf: WeekNeeds): Map<string, number> {
  const lots = new Map<string, Lot[]>();
  const push = (k: string, lot: Lot) => { if (lot.qty > 0) lots.set(k, [...(lots.get(k) ?? []), lot]); };
  const start = addDays(monday, -7 * 6);

  // Entrées de stock par semaine : saisies à la main et surplus des courses de la semaine précédente.
  const entering = (v: string) => {
    for (const [k, p] of Object.entries(data.pantry)) {
      if (!p.qty || p.all) continue;
      // saisi à la main : disponible à partir de la semaine de saisie (sans date : pour la semaine demandée)
      const since = p.since ? weekStart(p.since) : monday;
      if ((since < start ? start : since) === v) push(k, { qty: p.qty });
    }
    const prev = data.weeks[addDays(v, -7)]?.surplus ?? {};
    for (const [k, qty] of Object.entries(prev)) {
      const perishable = PERISHABLE_AISLES.has(data.ingredients[k]?.aisle ?? '') && !LONG_KEEP.has(k);
      push(k, { qty, expires: perishable ? v : undefined });
    }
  };

  for (let v = start; v <= monday; v = addDays(v, 7)) {
    entering(v);
    for (const [k, list] of lots) lots.set(k, list.filter((l) => !l.expires || l.expires >= v));
    if (v === monday) break;
    // Les repas de la semaine v consomment le stock, le plus ancien d'abord.
    const needs = lots.size ? needsOf(v) : new Map<string, number>();
    for (const [k, list] of lots) {
      let need = needs.get(k) ?? 0;
      for (const l of list) {
        const used = Math.min(l.qty, need);
        l.qty -= used;
        need -= used;
      }
      lots.set(k, list.filter((l) => l.qty > 1e-6));
    }
  }
  const out = new Map<string, number>();
  for (const [k, list] of lots) {
    const sum = list.reduce((s, l) => s + l.qty, 0);
    if (sum > 1e-6) out.set(k, sum);
  }
  return out;
}

/** Article coché (ou décoché) dans la liste de la semaine `monday` : surplus et placard mis à jour. */
export function recordPurchase(d: AppData, monday: string, key: string, bought: boolean, surplus: number): void {
  const w = d.weeks[monday];
  if (!w) return;
  w.surplus ??= {};
  if (bought && surplus > 0) w.surplus[key] = surplus;
  else delete w.surplus[key];
  if (!isStaple(d, key)) return;
  const p = d.pantry[key];
  if (bought) d.pantry[key] = { all: true, staple: true, since: monday };
  else if (p?.since === monday) d.pantry[key] = { staple: true };
}

/** Basique presque fini : il revient sur la prochaine liste de courses. */
export function markLow(d: AppData, key: string): void {
  d.pantry[key] = { staple: true };
}
