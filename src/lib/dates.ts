// Outils de dates. Les jours sont manipulés comme des chaînes ISO (YYYY-MM-DD) et calculés en UTC
// à midi pour ne jamais être affectés par les changements d'heure.

export const TZ = 'Europe/Brussels';

const DAY_MS = 86_400_000;

export function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12));
}

export function toISO(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  return toISO(new Date(parseISO(d).getTime() + n * DAY_MS));
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / DAY_MS);
}

/** 0 = lundi … 6 = dimanche */
export function weekdayIndex(d: string): number {
  return (parseISO(d).getUTCDay() + 6) % 7;
}

/** Lundi de la semaine contenant d (identifiant de semaine) */
export function weekStart(d: string): string {
  return addDays(d, -weekdayIndex(d));
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Date du jour dans le fuseau Europe/Brussels */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Heure actuelle HH:MM dans le fuseau Europe/Brussels */
export function nowHHMM(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('fr-BE', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}

export function hhmmToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function shiftHHMM(t: string, deltaMin: number): string {
  return minToHHMM(hhmmToMin(t) + deltaMin);
}

export const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const DAY_SHORT = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function formatLong(d: string): string {
  const dt = parseISO(d);
  return `${DAY_NAMES[weekdayIndex(d)]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

export function formatShort(d: string): string {
  const dt = parseISO(d);
  return `${DAY_SHORT[weekdayIndex(d)]} ${dt.getUTCDate()}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatDayMonth(d: string): string {
  const dt = parseISO(d);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

export function monthLabel(d: string): string {
  const dt = parseISO(d);
  return `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

export function formatHHMM(t: string): string {
  const [h, m] = t.split(':');
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

/** Grille du mois (semaines complètes lundi → dimanche) */
export function monthGrid(anyDay: string): string[] {
  const first = anyDay.slice(0, 8) + '01';
  const start = weekStart(first);
  const dt = parseISO(first);
  const next = toISO(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1, 12)));
  const end = addDays(weekStart(addDays(next, -1)), 6);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function addMonths(d: string, n: number): string {
  const dt = parseISO(d);
  return toISO(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + n, 1, 12)));
}

/**
 * Décalage (minutes) du fuseau par rapport à UTC à un instant donné.
 * Gère automatiquement l'heure d'été / d'hiver.
 */
export function tzOffsetMin(instant: number, timeZone = TZ): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUTC - Math.floor(instant / 1000) * 1000) / 60000);
}

/**
 * Convertit une heure murale (jour + HH:MM à Bruxelles) en instant UTC (ms).
 * Heure inexistante (passage à l'heure d'été, 2 h → 3 h) : décalée après le saut.
 * Heure ambiguë (passage à l'heure d'hiver) : première occurrence.
 */
export function zonedToUtc(date: string, time: string, timeZone = TZ): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const half = 43_200_000;
  const before = tzOffsetMin(wall - half, timeZone);
  const after = tzOffsetMin(wall + half, timeZone);
  const candidates = [wall - before * 60000, wall - after * 60000].filter(
    (c) => c + tzOffsetMin(c, timeZone) * 60000 === wall
  );
  if (candidates.length) return Math.min(...candidates);
  // Heure inexistante : on applique le décalage d'avant le saut (ex. 2 h 30 → 3 h 30)
  return wall - before * 60000;
}
