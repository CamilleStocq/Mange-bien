import type { ActivityKey, AppData, ISODate, MealEntry, Recipe, SportSession } from '../store/types';
import { addDays, hhmmToMin, minToHHMM, weekDays, weekStart, weekdayIndex } from './dates';
import { isActive, mealsOfDay, mealsOfWeek } from './planning';
import { ingredientKey, recipeNutrition } from './units';
import { weightTrend } from './stats';

/**
 * Mon coach : repères du jour pour perdre du poids en douceur, sans régime strict.
 * - un léger déficit (≈ 400 kcal) plutôt qu'une restriction : c'est ce qui tient dans la durée ;
 * - des protéines à chaque repas, des féculents ajustés à l'activité du jour ;
 * - un repas plaisir par semaine, prévu à l'avance ;
 * - le sport uniquement dans le cadre validé par le médecin / kiné.
 * Repères généraux, pas une prescription.
 */

export type DayKind = 'cardio' | 'force' | 'coaching' | 'repos';

const CARDIO = new Set<ActivityKey>(['course', 'velo', 'natation']);
const KCAL_PER_MIN: Record<SportSession['intensity'], number> = { 'très douce': 3, douce: 5, modérée: 7 };
/** Jamais en dessous de ce repère, même pour perdre plus vite. */
export const MIN_KCAL = 1400;
const DEFICIT = 400;

const activeSessions = (d: AppData, date: ISODate) => d.sport.sessions.filter((s) => s.date === date && (s.status === 'prévue' || s.status === 'faite'));

export function currentWeight(d: AppData): number | undefined {
  const t = weightTrend(d.weights);
  return t.length ? t[t.length - 1].trend : d.profile.startWeightKg;
}

export function dayKind(d: AppData, date: ISODate): DayKind {
  const s = activeSessions(d, date);
  if (s.some((x) => CARDIO.has(x.activity))) return 'cardio';
  if (s.some((x) => x.activity === 'renforcement')) return 'force';
  if (d.schedule[weekdayIndex(date)]?.coaching) return 'coaching';
  return 'repos';
}

export interface DayTargets {
  kcal: number;
  protein: number;
  /** Dépense estimée de la journée */
  spend: number;
}

/** Repère calorique du jour : dépense estimée (Mifflin-St Jeor, femme) moins un léger déficit. */
export function dayTargets(d: AppData, date: ISODate): DayTargets | undefined {
  const kg = currentWeight(d);
  const { heightCm, age } = d.profile;
  if (!kg || !heightCm || !age) return undefined;
  const bmr = 10 * kg + 6.25 * heightCm - 5 * age - 161;
  const coach = d.schedule[weekdayIndex(date)]?.coaching;
  // Base : vie quotidienne plutôt active. Coaching : debout et en mouvement pendant la séance.
  let spend = bmr * 1.4;
  if (coach) spend += Math.max(0, hhmmToMin(coach.end) - hhmmToMin(coach.start)) * 2.5;
  for (const s of activeSessions(d, date)) spend += s.durationMin * KCAL_PER_MIN[s.intensity];
  const kcal = Math.max(MIN_KCAL, Math.round((spend - DEFICIT) / 50) * 50);
  // Protéines : ≈ 1,6 g par kg du poids visé (ou actuel), pour garder les muscles.
  const protein = Math.round((1.6 * (d.profile.targetWeightKg ?? kg)) / 5) * 5;
  return { kcal, protein, spend: Math.round(spend) };
}

/** Féculents par portion (poids cru ou sec) selon la journée : moins les jours calmes, plus les jours de cardio. */
export const STARCH_TARGET: Record<DayKind, number> = { repos: 50, coaching: 60, force: 60, cardio: 80 };

export interface MealAdvice {
  meal: MealEntry;
  name: string;
  text: string;
  reduce: boolean;
}

/**
 * Féculent principal d'une portion, en « équivalent cru/sec » pour comparer au repère :
 * 100 g de pâtes sèches ≈ 450 g de pommes de terre ≈ 250 g de légumineuses cuites ≈ 140 g de pain.
 */
function mainStarch(r: Recipe, d: AppData): { name: string; qty: number; equiv: number; total: number } | undefined {
  let best: { name: string; qty: number; equiv: number } | undefined;
  let total = 0;
  for (const i of r.ingredients) {
    if (i.unit !== 'g') continue;
    const k = ingredientKey(i.name);
    const potato = k.includes('pomme de terre') || k.includes('pommes de terre') || k.includes('patate');
    const pulse = k.includes('pois chiche') || k.includes('lentille') || k.includes('haricot');
    if (!potato && !pulse && d.ingredients[k]?.aisle !== 'feculents') continue;
    const factor = potato ? 0.22 : pulse && i.state !== 'sec' ? 0.4 : k.includes('pain') ? 0.7 : i.state === 'cuit' ? 0.4 : 1;
    const qty = i.qty / Math.max(1, r.servings);
    const equiv = qty * factor;
    total += equiv;
    if (!best || equiv > best.equiv) best = { name: i.name, qty, equiv };
  }
  return best && { ...best, total };
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

export function mealAdvice(d: AppData, date: ISODate): MealAdvice[] {
  const kind = dayKind(d, date);
  const target = STARCH_TARGET[kind];
  const out: MealAdvice[] = [];
  for (const m of mealsOfDay(d.meals, date)) {
    if (!isActive(m) || (m.slot !== 'lunch' && m.slot !== 'dinner')) continue;
    if (m.kind !== 'recipe') continue;
    const r = d.recipes.find((x) => x.id === m.recipeId);
    if (!r) continue;
    const st = mainStarch(r, d);
    const nut = recipeNutrition(r, d.ingredients);
    const prot = nut.protein >= 25 ? '' : ' Ajoute une source de protéines (œuf, skyr, jambon, pois chiches).';
    if (st && st.total > target + 10) {
      // On réduit le féculent principal d'autant qu'il faut pour revenir au repère.
      const keep = round5(st.qty * Math.max(0.3, (st.equiv - (st.total - target)) / st.equiv));
      out.push({ meal: m, name: r.name, reduce: true, text: `Garde environ ${keep} g de ${st.name} (au lieu de ${round5(st.qty)} g), et remplis le reste de l’assiette de légumes.${prot}` });
    } else if (!st) {
      out.push({ meal: m, name: r.name, reduce: false, text: `Pas de féculent dans ce plat${kind === 'cardio' ? ' : ajoute une tranche de pain complet, c’est un jour de cardio' : ', c’est parfait pour une journée calme'}.${prot}` });
    } else {
      out.push({ meal: m, name: r.name, reduce: false, text: `Portion de féculents adaptée à ta journée, avec une belle part de légumes.${prot}` });
    }
  }
  return out;
}

/** Repère d'eau du jour : ton repère habituel, plus un supplément les jours de coaching et de sport. */
export function waterGoal(d: AppData, date: ISODate): number {
  let ml = d.hydration.goalMl;
  if (d.schedule[weekdayIndex(date)]?.coaching) ml += 500;
  ml += activeSessions(d, date).reduce((s, x) => s + Math.round((x.durationMin / 60) * 500), 0);
  return Math.round(ml / 100) * 100;
}

export const DRINKS = {
  free: 'Eau plate ou pétillante, thé, infusion, café sans sucre (plutôt avant 15 h).',
  some: 'Lait ou boisson végétale dans le café, un petit verre de jus au petit-déjeuner, un soda zéro de temps en temps.',
  treat: 'Sodas sucrés, alcool, cocktails, jus en grande quantité : à garder pour ton repas plaisir.'
};

export interface TreatPlan {
  date: ISODate;
  slot: 'dinner' | 'lunch';
  why: string;
}

/** Le repas plaisir de la semaine : le samedi soir (resto ou repas libre), sinon le soir de la plus grosse séance du week-end. */
export function treatPlan(d: AppData, monday: ISODate): TreatPlan {
  const week = mealsOfWeek(d.meals, monday).filter((m) => isActive(m) && (m.kind === 'restaurant' || m.kind === 'free') && m.slot !== 'breakfast' && m.slot !== 'snack');
  if (week.length) {
    const m = week[0];
    return { date: m.date, slot: m.slot === 'lunch' ? 'lunch' : 'dinner', why: m.kind === 'restaurant' ? 'Ton resto de la semaine.' : 'Ton repas libre de la semaine.' };
  }
  const weekend = [4, 5, 6].map((k) => addDays(monday, k));
  let best = addDays(monday, 5);
  let most = 0;
  for (const day of weekend) {
    const mins = activeSessions(d, day).reduce((s, x) => s + x.durationMin, 0);
    if (mins > most) [best, most] = [day, mins];
  }
  return { date: best, slot: 'dinner', why: most ? 'Le soir de ta plus belle séance de la semaine.' : 'En fin de semaine, pour en profiter sans y penser le reste du temps.' };
}

export function treatToday(d: AppData, date: ISODate): TreatPlan | undefined {
  const t = treatPlan(d, weekStart(date));
  return t.date === date ? t : undefined;
}

/**
 * Semaine de sport la plus complète possible dans ton cadre : le nombre de séances et la durée de ton étape de reprise,
 * uniquement les activités autorisées, placées hors travail et hors coaching, avec un jour calme entre deux séances.
 * Les jours de coaching, tu es déjà en mouvement : pas de séance en plus.
 */
export function proposeSportWeek(d: AppData, monday: ISODate, makeId: () => string): SportSession[] {
  if (d.sport.phase !== 'reprise') return [];
  const stage = d.sport.stages[d.sport.currentStage];
  const allowed = (['velo', 'natation', 'course', 'renforcement', 'mobilite'] as ActivityKey[]).filter((a) => ['autorisé', 'restreint'].includes(d.sport.authorizations[a]?.status));
  if (!stage || !allowed.length) return [];
  const free = weekDays(monday).filter((day) => !d.schedule[weekdayIndex(day)]?.coaching);
  // Jours espacés : on prend un jour sur deux d'abord, puis on complète.
  const spaced = [...free.filter((_, k) => k % 2 === 0), ...free.filter((_, k) => k % 2 === 1)];
  const days = spaced.slice(0, stage.sessionsPerWeek).sort();
  const cardio = allowed.filter((a) => CARDIO.has(a));
  const strength = allowed.filter((a) => !CARDIO.has(a));
  const out: SportSession[] = days.map((date, k) => {
    // Alterner cardio et renforcement quand les deux sont autorisés.
    const pool = k % 2 === 0 ? (cardio.length ? cardio : strength) : strength.length ? strength : cardio;
    const activity = pool[Math.floor(k / 2) % pool.length];
    return { id: makeId(), date, time: slotFor(d, date, stage.maxMinutes), activity, durationMin: stage.maxMinutes, intensity: stage.intensity, status: 'prévue', notes: 'Proposée par ton coach, dans le cadre de ton étape de reprise. Arrête si douleur.' };
  });
  // Marche active les autres jours sans coaching, si elle est autorisée.
  if (['autorisé', 'restreint'].includes(d.sport.authorizations.marche?.status)) {
    for (const date of free.filter((x) => !days.includes(x))) {
      out.push({ id: makeId(), date, time: slotFor(d, date, 30), activity: 'marche', durationMin: Math.min(30, stage.maxMinutes), intensity: 'douce', status: 'prévue', notes: 'Marche active : à ton rythme, idéalement dehors.' });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Créneau : après le travail (+30 min) en semaine, 10 h le week-end ; toujours au moins 1 h avant le dîner. */
function slotFor(d: AppData, date: ISODate, minutes: number): string {
  const s = d.schedule[weekdayIndex(date)];
  const dinner = hhmmToMin(s?.dinner ?? '19:00');
  if (!s?.work) return '10:00';
  const start = hhmmToMin(s.work.end) + 30;
  if (start + minutes <= dinner - 30) return minToHHMM(start);
  return minToHHMM(Math.max(hhmmToMin(s.wake) + 30, hhmmToMin(s.work.start) - minutes - 30));
}

export interface Wins {
  meals: number;
  sessions: number;
  sportMin: number;
  waterDays: number;
  kgLost?: number;
}

/** Ce qui a été fait cette semaine (jusqu'à aujourd'hui inclus) : uniquement du positif. */
export function weekWins(d: AppData, today: ISODate): Wins {
  const monday = weekStart(today);
  const past = (x: { date: string }) => x.date >= monday && x.date <= today;
  const meals = d.meals.filter((m) => past(m) && m.kind === 'recipe' && m.status === 'mangé').length;
  const done = d.sport.sessions.filter((s) => past(s) && s.status === 'faite');
  let waterDays = 0;
  for (let day = monday; day <= today; day = addDays(day, 1)) {
    if ((d.hydration.log[day] ?? []).reduce((s, x) => s + x.ml, 0) >= waterGoal(d, day) * 0.8) waterDays++;
  }
  const t = weightTrend(d.weights);
  const kgLost = t.length >= 2 ? Math.round((t[0].trend - t[t.length - 1].trend) * 10) / 10 : undefined;
  return { meals, sessions: done.length, sportMin: done.reduce((s, x) => s + x.durationMin, 0), waterDays, kgLost: kgLost && kgLost > 0 ? kgLost : undefined };
}

export const MOTIVATION = [
  'Tu ne cherches pas la perfection, tu construis une habitude. Et elle se construit en ce moment.',
  'Chaque boîte préparée, chaque verre d’eau, chaque marche compte. Ça s’additionne.',
  'Ton corps change plus lentement que ton envie : c’est normal, et ça vient.',
  'Savourer un petit pas, c’est ce qui donne envie de faire le suivant.',
  'Tu prends soin de toi chaque jour. Ce n’est pas rien.',
  'Le repas plaisir fait partie du programme : il t’aide à tenir sur la durée.',
  'Une journée moins réussie ne change rien à la tendance. On reprend au repas suivant, simplement.',
  'Regarde où tu en étais il y a un mois : tu as déjà avancé.',
  'Le sport que tu fais aujourd’hui, c’est de l’énergie et de la bonne humeur pour demain.',
  'Bien dormir, boire, bouger un peu : les bases font la plus grande différence.'
];
