import type { AppData, MealEntry, NotifCategory } from '../store/types';
import { addDays, formatHHMM, hhmmToMin, shiftHHMM, weekStart, weekdayIndex, zonedToUtc } from './dates';
import { buildBatchPlan, type BatchPlan } from './batch';
import { isActive, mealsOfDay } from './planning';
import { buildShoppingList } from './shopping';
import { formatEuro, formatQty } from './units';
import { ENCOURAGEMENTS, MORNING_TITLES, pickFor } from './messages';

export interface Reminder {
  id: string;
  at: number; // instant UTC (ms)
  date: string;
  time: string;
  category: NotifCategory;
  title: string;
  body: string;
  url: string;
}

export const CATEGORY_INFO: Record<NotifCategory, { label: string; group: 'Repas' | 'Préparation' | 'Sport et récupération' | 'Suivi'; help: string }> = {
  morning: { label: 'Programme du matin', group: 'Repas', help: 'Après le réveil (décalage en minutes).' },
  breakfast: { label: 'Petit-déjeuner', group: 'Repas', help: 'Après le réveil (décalage en minutes).' },
  lunchPack: { label: 'Emporter le déjeuner', group: 'Repas', help: 'Jours de travail, après le réveil.' },
  dinner: { label: 'Dîner et recette du soir', group: 'Repas', help: 'Minutes avant le dîner ; les soirs de coaching, à la fin du coaching.' },
  snack: { label: 'Collation (si prévue)', group: 'Repas', help: 'À l’heure de la collation facultative.' },
  defrost: { label: 'Sortir du congélateur', group: 'Repas', help: 'La veille au soir.' },
  prepEve: { label: 'Préparer / vérifier pour demain', group: 'Préparation', help: 'La veille d’un repas cuisiné le jour même.' },
  batch: { label: 'Batch cooking du dimanche', group: 'Préparation', help: 'Minutes avant l’heure du batch.' },
  batchRemaining: { label: 'Étapes restantes du batch', group: 'Préparation', help: 'Dimanche, en fin d’après-midi.' },
  shopping: { label: 'Liste de courses', group: 'Préparation', help: 'Jour et heure de ton choix.' },
  leftovers: { label: 'Restes et ingrédients disponibles', group: 'Préparation', help: 'Une fois par semaine.' },
  sport: { label: 'Séance autorisée prévue', group: 'Sport et récupération', help: 'Minutes avant une séance prévue, uniquement si l’activité est autorisée.' },
  recovery: { label: 'Repos et récupération', group: 'Sport et récupération', help: 'Le dimanche, en phase de récupération.' },
  pain: { label: 'Noter mes douleurs', group: 'Sport et récupération', help: 'Chaque soir, facultatif.' },
  weigh: { label: 'Point hebdomadaire (pesée)', group: 'Suivi', help: 'Le jour de pesée, après le réveil.' },
  progress: { label: 'Faire le point sur ma semaine', group: 'Suivi', help: 'Une fois par semaine.' },
  hydration: { label: 'Hydratation', group: 'Suivi', help: 'Aux heures de ton choix.' },
  encouragement: { label: 'Message d’encouragement', group: 'Suivi', help: 'Une fois par jour.' }
};

export function inQuietHours(time: string, start: string, end: string): boolean {
  const t = hhmmToMin(time);
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  if (s === e) return false;
  return s < e ? t >= s && t < e : t >= s || t < e;
}

export function mealName(m: MealEntry, data: AppData): string {
  if (m.kind === 'breakfast') return 'ton petit-déjeuner habituel';
  if (m.kind === 'restaurant') return 'restaurant';
  if (m.kind === 'free') return 'repas libre';
  if (m.kind === 'custom') return m.customName || 'repas';
  const r = data.recipes.find((x) => x.id === m.recipeId);
  return r ? r.name.charAt(0).toLowerCase() + r.name.slice(1) : 'ton repas';
}

/**
 * Construit les rappels des `days` prochains jours à partir du planning.
 * Les heures sont des heures murales à Bruxelles converties en instants UTC (été/hiver gérés).
 */
export function buildReminders(data: AppData, fromDate: string, days: number, nowMs = Date.now()): Reminder[] {
  const out: Reminder[] = [];
  const rules = data.notif.rules;
  const discreet = data.notif.discreet;
  const plans = new Map<string, BatchPlan>();
  const planFor = (monday: string) => {
    if (!plans.has(monday)) plans.set(monday, buildBatchPlan(data, monday));
    return plans.get(monday)!;
  };
  const name = (m: MealEntry) => (discreet ? 'ton repas prévu' : mealName(m, data));

  for (let i = 0; i < days; i++) {
    const d = addDays(fromDate, i);
    if (data.notif.pausedUntil && d <= data.notif.pausedUntil) continue;
    const wd = weekdayIndex(d);
    const sched = data.schedule[wd];
    const meals = mealsOfDay(data.meals, d).filter(isActive);
    const tomorrow = addDays(d, 1);
    const mealsTomorrow = mealsOfDay(data.meals, tomorrow).filter(isActive);
    const lunch = meals.find((m) => m.slot === 'lunch');
    const dinner = meals.find((m) => m.slot === 'dinner');
    const snack = meals.find((m) => m.slot === 'snack');
    const add = (category: NotifCategory, time: string, title: string, body: string, url: string, suffix = '') => {
      if (!rules[category]?.enabled) return;
      out.push({ id: `${category}:${d}${suffix}`, at: zonedToUtc(d, time), date: d, time, category, title, body, url });
    };
    const offset = (c: NotifCategory, def: number) => rules[c]?.offsetMin ?? def;

    // Repas
    {
      const parts: string[] = [];
      if (lunch) parts.push(`déjeuner : ${name(lunch)}`);
      if (dinner) parts.push(`dîner : ${name(dinner)}`);
      const programme = parts.length ? `Au menu — ${parts.join(' ; ')}. ` : '';
      add('morning', shiftHHMM(sched.wake, offset('morning', 10)), pickFor(d, MORNING_TITLES), `Voici le programme de ta journée. ${programme}${pickFor(d + 'e', ENCOURAGEMENTS)}`, '#/aujourdhui');
    }
    if (meals.some((m) => m.kind === 'breakfast')) {
      const items = data.breakfast.map((b) => `${b.name} ${formatQty(b.qty, b.unit)}`).join(', ');
      add('breakfast', shiftHHMM(sched.wake, offset('breakfast', 25)), 'Petit-déjeuner', discreet ? 'Ton petit-déjeuner habituel t’attend.' : `Ton petit-déjeuner habituel : ${items}.`, '#/aujourdhui');
    }
    if (sched.work && lunch && lunch.kind !== 'free' && lunch.kind !== 'restaurant') {
      const frozen = lunch.storage === 'freezer' ? ' (sortie du congélateur hier soir)' : '';
      add('lunchPack', shiftHHMM(sched.wake, offset('lunchPack', 30)), 'Ton déjeuner', `Pense à emporter ton déjeuner : ${name(lunch)}${discreet ? '' : frozen}.`, '#/aujourdhui');
    }
    if (snack && sched.snack) {
      add('snack', sched.snack, 'Collation facultative', 'Si tu as faim avant le coaching, c’est le bon moment pour ta collation.', '#/aujourdhui');
    }
    if (dinner) {
      if (dinner.kind === 'restaurant' || dinner.kind === 'free') {
        add('dinner', shiftHHMM(sched.dinner, -offset('dinner', 60)), 'Ce soir', 'Ce soir : repas libre. Profite de ce moment, le planning reprend tranquillement demain.', '#/aujourdhui');
      } else if (sched.coaching) {
        const ready = dinner.source === 'batch' ? ' Ta portion est prête à réchauffer.' : '';
        add('dinner', sched.coaching.end, 'Après le coaching', `Ce soir : ${name(dinner)}.${ready}`, `#/jour/${d}`);
      } else {
        add('dinner', shiftHHMM(sched.dinner, -offset('dinner', 60)), 'Ce soir', `Ce soir, tu as prévu ${name(dinner)}. Retrouve ta recette et les quantités dans l’application.`, `#/jour/${d}`);
      }
    }
    // Décongélation pour demain
    const defrost = planFor(weekStart(tomorrow)).defrost.filter((t) => t.on === d);
    if (defrost.length) {
      const what = discreet ? `${defrost.length} portion(s)` : defrost.map((t) => t.label).join(', ');
      add('defrost', rules.defrost.time ?? '20:30', 'Pour demain', `Pense à sortir du congélateur et mettre au frigo : ${what}.`, `#/jour/${tomorrow}`);
    }
    const freshTomorrow = mealsTomorrow.filter((m) => m.kind === 'recipe' && m.source === 'fresh');
    if (freshTomorrow.length) {
      add('prepEve', rules.prepEve.time ?? '20:00', 'Demain', `Pense à vérifier ce qu’il te faut pour demain : ${freshTomorrow.map(name).join(', ')}.`, `#/jour/${tomorrow}`);
    }

    // Préparation
    if (wd === 6) {
      const plan = planFor(addDays(d, 1));
      if (!plan.empty) {
        const body = discreet
          ? 'Ton batch cooking du dimanche t’attend : le plan est prêt dans l’application.'
          : `Ton batch cooking du dimanche t’attend : ${plan.cookFull.length} plat(s) à cuisiner, environ ${Math.round(plan.durationMin / 15) * 15} min.`;
        add('batch', shiftHHMM(data.batchStart, -offset('batch', 30)), 'Batch cooking', body, `#/batch?w=${addDays(d, 1)}`);
        add('batchRemaining', rules.batchRemaining.time ?? '17:00', 'Batch cooking', 'Où en es-tu ? Les étapes restantes et le rangement frigo / congélateur sont dans ta checklist.', `#/batch?w=${addDays(d, 1)}`);
      }
    }
    if (rules.shopping.day === wd) {
      const monday = wd >= 4 ? addDays(weekStart(d), 7) : weekStart(d);
      const list = buildShoppingList(data, monday);
      const est = list.items.length && !discreet ? ` (estimation : ${formatEuro(list.estimated)})` : '';
      add('shopping', rules.shopping.time ?? '10:00', 'Mes courses', `Ta liste de courses de la semaine est prête${est}.`, `#/courses?w=${monday}`);
    }
    if (rules.leftovers.day === wd) {
      add('leftovers', rules.leftovers.time ?? '18:30', 'Petit point frigo', 'Pense à vérifier les restes et les ingrédients disponibles avant d’en racheter.', '#/alimentation');
    }

    // Sport et récupération
    const auth = data.sport.authorizations;
    const sessions = data.sport.sessions.filter((s) => s.date === d && s.status === 'prévue');
    for (const s of sessions) {
      const st = auth[s.activity]?.status;
      if (st !== 'autorisé' && st !== 'restreint') continue;
      add('sport', shiftHHMM(s.time, -offset('sport', 30)), 'Séance prévue', `${ACTIVITY_LABEL[s.activity]} ${s.durationMin} min (${s.intensity}). Uniquement si tu te sens bien aujourd’hui : le repos reste une option.`, '#/sport', `:${s.id}`);
    }
    if (data.sport.phase === 'recuperation' && wd === 6 && !sessions.length) {
      add('recovery', rules.recovery.time ?? '10:00', 'Récupération', 'Aujourd’hui, la récupération fait partie du programme.', '#/sport');
    }
    add('pain', rules.pain.time ?? '21:30', 'Comment va ton dos ?', 'Si tu le souhaites, note tes sensations du jour en quelques secondes.', '#/sport?tab=douleurs');

    // Suivi
    if (data.weighReminders && wd === data.weighDay) {
      const monday = weekStart(d);
      const weighed = data.weights.some((w) => w.date >= monday && w.date <= addDays(monday, 6));
      if (!weighed && !data.weeks[monday]?.weighing) {
        add('weigh', shiftHHMM(sched.wake, offset('weigh', 15)), 'Point hebdomadaire', 'C’est le moment de faire ton point hebdomadaire, si tu te sens à l’aise avec la pesée.', '#/progression');
      }
    }
    if (rules.progress.day === wd) add('progress', rules.progress.time ?? '19:00', 'Ta semaine', 'Envie de faire le point sur ta semaine ? Ta progression et tes habitudes t’attendent.', '#/progression');
    for (const t of rules.hydration.times ?? []) {
      add('hydration', t, 'Hydratation', `Petite pause hydratation 💧 Repère du jour : ${formatQty(data.hydration.goalMl, 'ml')}.`, '#/hydratation', `:${t}`);
    }
    add('encouragement', rules.encouragement.time ?? '13:15', 'Mange bien !', pickFor(d + 'x', ENCOURAGEMENTS), '#/aujourdhui');
  }

  return out
    .filter((r) => r.at > nowMs && !inQuietHours(r.time, data.notif.quietStart, data.notif.quietEnd))
    .sort((a, b) => a.at - b.at);
}

export const ACTIVITY_LABEL: Record<string, string> = {
  natation: 'Natation',
  velo: 'Vélo',
  course: 'Course à pied',
  renforcement: 'Renforcement',
  mobilite: 'Mobilité',
  marche: 'Marche'
};

export function describeTime(r: Reminder): string {
  return formatHHMM(r.time);
}
