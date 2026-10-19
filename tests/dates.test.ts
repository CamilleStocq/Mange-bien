import { describe, expect, it } from 'vitest';
import { addDays, monthGrid, todayISO, tzOffsetMin, weekStart, weekdayIndex, zonedToUtc } from '../src/lib/dates';

describe('dates', () => {
  it('calcule le lundi de la semaine et l’index du jour', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // dimanche → lundi précédent
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekdayIndex('2026-10-19')).toBe(0);
    expect(weekdayIndex('2026-10-25')).toBe(6);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('change de semaine sans être perturbé par le passage à l’heure d’hiver', () => {
    expect(addDays('2026-10-19', 7)).toBe('2026-10-26');
    expect(addDays('2027-03-22', 7)).toBe('2027-03-29');
  });

  it('grille du mois : semaines complètes du lundi au dimanche', () => {
    const g = monthGrid('2026-10-15');
    expect(g.length % 7).toBe(0);
    expect(weekdayIndex(g[0])).toBe(0);
    expect(g).toContain('2026-10-01');
    expect(g).toContain('2026-10-31');
  });

  it('heure murale Bruxelles → UTC, été (UTC+2) et hiver (UTC+1)', () => {
    expect(new Date(zonedToUtc('2026-11-02', '12:30')).toISOString()).toBe('2026-11-02T11:30:00.000Z');
    expect(new Date(zonedToUtc('2026-10-19', '12:30')).toISOString()).toBe('2026-10-19T10:30:00.000Z'); // encore l’heure d’été
    expect(new Date(zonedToUtc('2026-08-03', '12:30')).toISOString()).toBe('2026-08-03T10:30:00.000Z');
    // Jour du passage à l’heure d’hiver (25/10/2026, 3 h → 2 h)
    expect(new Date(zonedToUtc('2026-10-25', '19:00')).toISOString()).toBe('2026-10-25T18:00:00.000Z');
    expect(new Date(zonedToUtc('2026-10-24', '19:00')).toISOString()).toBe('2026-10-24T17:00:00.000Z');
    // Jour du passage à l’heure d’été (28/03/2027, 2 h → 3 h)
    expect(new Date(zonedToUtc('2027-03-28', '10:00')).toISOString()).toBe('2027-03-28T08:00:00.000Z');
    expect(new Date(zonedToUtc('2027-03-27', '10:00')).toISOString()).toBe('2027-03-27T09:00:00.000Z');
  });

  it('gère les heures inexistantes et ambiguës', () => {
    // 2 h 30 n’existe pas le 28/03/2027 → décalée à 3 h 30 locale
    expect(new Date(zonedToUtc('2027-03-28', '02:30')).toISOString()).toBe('2027-03-28T01:30:00.000Z');
    // 2 h 30 existe deux fois le 25/10/2026 → première occurrence (heure d’été)
    expect(new Date(zonedToUtc('2026-10-25', '02:30')).toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(tzOffsetMin(Date.UTC(2026, 6, 1))).toBe(120);
    expect(tzOffsetMin(Date.UTC(2026, 11, 1))).toBe(60);
  });

  it('date du jour à Bruxelles, même quand UTC est encore la veille', () => {
    expect(todayISO(new Date('2026-10-19T22:30:00Z'))).toBe('2026-10-20');
  });
});
