import type { AppData } from '../store/types';
import { addDays, weekStart, weekdayIndex } from './dates';
import { buildBatchPlan } from './batch';
import { isActive, mealsOfDay } from './planning';
import { mealName } from './reminders';

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

  const defrost = buildBatchPlan(data, weekStart(tomorrow)).defrost.filter((t) => t.on === date);
  for (const t of defrost) {
    out.push({ id: t.id, icon: 'snow', time: rules.defrost.time ?? '20:30', text: `Ce soir : sortir du congélateur et mettre au frigo — ${t.label} (pour demain).`, href: `#/jour/${tomorrow}` });
  }
  const freshTomorrow = mealsOfDay(data.meals, tomorrow).filter((m) => isActive(m) && m.kind === 'recipe' && m.source === 'fresh');
  for (const m of freshTomorrow) {
    out.push({ id: `eve:${m.id}`, icon: 'list', time: rules.prepEve.time ?? '20:00', text: `Vérifier les ingrédients pour demain : ${mealName(m, data)}.`, href: m.recipeId ? `#/recette/${m.recipeId}` : undefined });
  }
  const freshToday = mealsOfDay(data.meals, date).filter((m) => isActive(m) && m.kind === 'recipe' && m.source === 'fresh' && m.slot !== 'breakfast');
  for (const m of freshToday) {
    out.push({ id: `cook:${m.id}`, icon: 'pot', text: `À cuisiner aujourd’hui : ${mealName(m, data)}.`, href: m.recipeId ? `#/recette/${m.recipeId}` : undefined });
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
