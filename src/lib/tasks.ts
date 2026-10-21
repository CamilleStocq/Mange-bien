import type { AppData } from '../store/types';
import { addDays, weekStart, weekdayIndex } from './dates';
import { buildBatchPlan } from './batch';
import { isActive, mealsOfDay } from './planning';
import { countLabels, mealName } from './reminders';

export interface DayTask {
  id: string;
  icon: string;
  text: string;
  href?: string;
  time?: string;
}

/** Tâches de préparation d'une journée (décongélation, veille, batch, courses, restes). */
export function dayTasks(data: AppData, date: string): DayTask[] {
  const out: DayTask[] = [];
  const wd = weekdayIndex(date);
  const tomorrow = addDays(date, 1);
  const rules = data.notif.rules;

  // Un seul rappel par plat, même s'il est prévu deux fois (midi et soir).
  const defrost = buildBatchPlan(data, weekStart(tomorrow)).defrost.filter((t) => t.on === date);
  for (const label of countLabels(defrost.map((t) => t.label))) {
    out.push({ id: `defrost:${date}:${label}`, icon: 'snow', time: rules.defrost.time ?? '20:30', text: `Ce soir : sortir du congélateur et mettre au frigo — ${label} (pour demain).`, href: `#/jour/${tomorrow}` });
  }
  const once = <T extends { recipeId?: string }>(list: T[]) => list.filter((m, i) => list.findIndex((x) => x.recipeId === m.recipeId) === i);
  const freshTomorrow = once(mealsOfDay(data.meals, tomorrow).filter((m) => isActive(m) && m.kind === 'recipe' && m.source === 'fresh'));
  for (const m of freshTomorrow) {
    out.push({ id: `eve:${m.id}`, icon: 'list', time: rules.prepEve.time ?? '20:00', text: `Vérifier les ingrédients pour demain : ${mealName(m, data)}.`, href: m.recipeId ? `#/recette/${m.recipeId}` : undefined });
  }
  for (const m of mealsOfDay(data.meals, tomorrow).filter((x) => isActive(x) && x.kind === 'recipe' && x.cookEve)) {
    out.push({ id: `eve-cook:${m.id}`, icon: 'pot', time: rules.prepEve.time ?? '20:00', text: `Ce soir : prépare ${mealName(m, data)} pour demain midi, en boîte au frigo.`, href: m.recipeId ? `#/recette/${m.recipeId}` : undefined });
  }
  const freshToday = once(mealsOfDay(data.meals, date).filter((m) => isActive(m) && m.kind === 'recipe' && m.source === 'fresh' && m.slot !== 'breakfast' && !m.cookEve));
  for (const m of freshToday) {
    const two = m.portions > 1 ? ` (${String(m.portions).replace('.', ',')} portions : une pour toi, le reste en boîte au frigo)` : '';
    out.push({ id: `cook:${m.id}`, icon: 'pot', text: `À cuisiner aujourd’hui : ${mealName(m, data)}${two}.`, href: m.recipeId ? `#/recette/${m.recipeId}` : undefined });
  }
  if (wd === 6) {
    const plan = buildBatchPlan(data, tomorrow);
    if (!plan.empty) {
      const checks = data.weeks[tomorrow]?.batchChecks ?? {};
      const done = plan.steps.filter((s) => checks[s.id]).length;
      out.push({ id: 'batch', icon: 'pot', time: data.batchStart, text: `Batch cooking : ${plan.cookFull.length} plat(s), ≈ ${Math.round(plan.durationMin / 15) * 15} min (${done}/${plan.steps.length} étapes).`, href: `#/batch?w=${tomorrow}` });
    }
  }
  if (rules.shopping.day === wd) {
    const monday = wd >= 4 ? addDays(weekStart(date), 7) : weekStart(date);
    out.push({ id: 'shopping', icon: 'cart', time: rules.shopping.time, text: 'Jour de courses : ta liste est prête.', href: `#/courses?w=${monday}` });
  }
  if (rules.leftovers.day === wd) out.push({ id: 'leftovers', icon: 'fridge', text: 'Petit point frigo : restes et ingrédients disponibles.', href: '#/alimentation?tab=stock' });
  return out.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
}
