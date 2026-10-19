import type { AppData, WeightEntry } from '../store/types';
import { addDays, diffDays, weekStart } from './dates';
import { mealsOfWeek } from './planning';

export interface TrendPoint {
  date: string;
  kg: number;
  trend: number;
}

/**
 * Tendance lissée (moyenne exponentielle pondérée par le temps, demi-vie ~2 semaines).
 * Elle atténue les fluctuations d'eau, de sel, de cycle, de digestion…
 */
export function weightTrend(entries: WeightEntry[], halfLifeDays = 14): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const out: TrendPoint[] = [];
  let trend: number | undefined;
  let prev: string | undefined;
  for (const e of sorted) {
    if (trend === undefined || !prev) trend = e.kg;
    else {
      const dt = Math.max(0, diffDays(e.date, prev));
      const alpha = 1 - Math.pow(0.5, dt / halfLifeDays);
      trend = trend + alpha * (e.kg - trend);
    }
    prev = e.date;
    out.push({ date: e.date, kg: e.kg, trend: Math.round(trend * 10) / 10 });
  }
  return out;
}

export interface WeekHabit {
  monday: string;
  planned: number;
  done: number; // mangé ou préparé
  batchSteps: number;
  batchDone: number;
  hydrationDays: number;
  sportMinutes: number;
}

export function habitWeeks(data: AppData, today: string, count = 8): WeekHabit[] {
  const out: WeekHabit[] = [];
  const current = weekStart(today);
  for (let i = count - 1; i >= 0; i--) {
    const monday = addDays(current, -7 * i);
    const meals = mealsOfWeek(data.meals, monday).filter((m) => m.slot !== 'snack');
    const meta = data.weeks[monday];
    const checks = meta?.batchChecks ?? {};
    let hydrationDays = 0;
    for (let d = 0; d < 7; d++) {
      const log = data.hydration.log[addDays(monday, d)] ?? [];
      if (log.reduce((s, x) => s + x.ml, 0) >= data.hydration.goalMl * 0.8) hydrationDays++;
    }
    const sportMinutes = data.sport.sessions
      .filter((s) => s.status === 'faite' && s.date >= monday && s.date <= addDays(monday, 6))
      .reduce((s, x) => s + x.durationMin, 0);
    out.push({
      monday,
      planned: meals.length,
      done: meals.filter((m) => m.status === 'mangé' || m.status === 'préparé').length,
      batchSteps: Object.keys(checks).length,
      batchDone: Object.values(checks).filter(Boolean).length,
      hydrationDays,
      sportMinutes
    });
  }
  return out;
}

/** Variation récente de la tendance, formulée avec prudence. */
export function trendMessage(points: TrendPoint[]): string {
  if (points.length < 3) return 'Quelques pesées supplémentaires permettront de voir une tendance. Une pesée isolée ne dit pas grand-chose.';
  const last = points[points.length - 1];
  const ref = points.find((p) => diffDays(last.date, p.date) <= 28) ?? points[0];
  const delta = last.trend - ref.trend;
  if (Math.abs(delta) < 0.3) {
    return 'La tendance est stable ces dernières semaines. C’est normal par moments : sommeil, récupération, stress et cycle jouent aussi. Pas besoin de réduire tes portions ; tu peux simplement vérifier que le planning reste réaliste pour toi.';
  }
  if (delta < 0) return `La tendance descend doucement (${delta.toFixed(1).replace('.', ',')} kg sur la période). Les variations d’un jour à l’autre ne reflètent pas forcément la masse grasse.`;
  return 'La tendance remonte légèrement. Les fluctuations (eau, sel, cycle, récupération) sont fréquentes et ne traduisent pas forcément un changement de masse grasse.';
}
