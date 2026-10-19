import { describe, expect, it } from 'vitest';
import { buildReminders, inQuietHours } from '../src/lib/reminders';
import { generateWeek } from '../src/lib/planning';
import { FORBIDDEN_PATTERNS } from '../src/lib/messages';
import { weightTrend, trendMessage } from '../src/lib/stats';
import { addDays } from '../src/lib/dates';
import { fresh, MONDAY } from './helpers';

function planned() {
  const d = fresh();
  let rot = 0;
  for (let w = -1; w < 9; w++) {
    d.rotation = rot;
    const r = generateWeek(d, addDays(MONDAY, 7 * w));
    d.meals.push(...r.meals);
    rot = r.rotation;
  }
  return d;
}
const at = (iso: string) => new Date(iso).getTime();

describe('rappels', () => {
  it('heures de Bruxelles converties en UTC, avant et après le changement d’heure', () => {
    const d = planned();
    const list = buildReminders(d, MONDAY, 14, 0);
    const morningMon = list.find((r) => r.id === `morning:${MONDAY}`)!;
    expect(morningMon.time).toBe('05:55'); // réveil 5 h 45 + 10 min
    expect(new Date(morningMon.at).toISOString()).toBe('2026-10-19T03:55:00.000Z'); // été UTC+2
    const morningNext = list.find((r) => r.id === `morning:${addDays(MONDAY, 7)}`)!;
    expect(new Date(morningNext.at).toISOString()).toBe('2026-10-26T04:55:00.000Z'); // hiver UTC+1
  });

  it('dîner après le coaching à la fin du coaching ; sinon 1 h avant le dîner', () => {
    const list = buildReminders(planned(), MONDAY, 7, 0);
    expect(list.find((r) => r.id === `dinner:${addDays(MONDAY, 1)}`)!.time).toBe('20:30');
    expect(list.find((r) => r.id === `dinner:${MONDAY}`)!.time).toBe('18:00');
  });

  it('rappel de décongélation la veille au soir des portions congelées', () => {
    const d = planned();
    const list = buildReminders(d, MONDAY, 7, 0);
    const frozen = d.meals.filter((m) => m.storage === 'freezer' && m.date >= MONDAY && m.date <= addDays(MONDAY, 6));
    expect(frozen.length).toBeGreaterThan(0);
    for (const m of frozen) expect(list.some((r) => r.category === 'defrost' && r.date === addDays(m.date, -1))).toBe(true);
  });

  it('batch cooking le dimanche et courses le samedi', () => {
    const list = buildReminders(planned(), MONDAY, 7, 0);
    const batch = list.find((r) => r.category === 'batch')!;
    expect(batch.date).toBe(addDays(MONDAY, 6));
    expect(batch.time).toBe('14:00');
    expect(list.find((r) => r.category === 'shopping')!.date).toBe(addDays(MONDAY, 5));
  });

  it('respecte les heures calmes, la pause et les catégories désactivées', () => {
    const d = planned();
    d.notif.rules.hydration.times = ['23:00', '10:30'];
    let list = buildReminders(d, MONDAY, 7, 0);
    expect(list.some((r) => r.time === '23:00')).toBe(false);
    expect(list.every((r) => !inQuietHours(r.time, '22:30', '05:30'))).toBe(true);
    d.notif.rules.hydration.enabled = false;
    list = buildReminders(d, MONDAY, 7, 0);
    expect(list.some((r) => r.category === 'hydration')).toBe(false);
    d.notif.pausedUntil = addDays(MONDAY, 2);
    list = buildReminders(d, MONDAY, 7, 0);
    expect(list.every((r) => r.date > addDays(MONDAY, 2))).toBe(true);
  });

  it('ne renvoie que les rappels futurs', () => {
    const list = buildReminders(planned(), MONDAY, 2, at('2026-10-19T12:00:00Z'));
    expect(list.every((r) => r.at > at('2026-10-19T12:00:00Z'))).toBe(true);
  });

  it('mode discret : aucun nom de repas', () => {
    const d = planned();
    d.notif.discreet = true;
    const text = buildReminders(d, MONDAY, 14, 0).map((r) => r.body).join('\n');
    for (const r of d.recipes) expect(text.toLowerCase()).not.toContain(r.name.toLowerCase());
  });

  it('séance : rappel uniquement si l’activité est autorisée', () => {
    const d = planned();
    d.sport.sessions.push({ id: 's1', date: addDays(MONDAY, 3), time: '18:00', activity: 'natation', durationMin: 20, intensity: 'très douce', status: 'prévue', notes: '' });
    expect(buildReminders(d, MONDAY, 7, 0).some((r) => r.category === 'sport')).toBe(false);
    d.sport.authorizations.natation.status = 'autorisé';
    const s = buildReminders(d, MONDAY, 7, 0).find((r) => r.category === 'sport')!;
    expect(s.time).toBe('17:30');
  });

  it('phase de récupération : message de repos le dimanche, aucune séance inventée', () => {
    const list = buildReminders(planned(), MONDAY, 7, 0);
    expect(list.find((r) => r.category === 'recovery')!.date).toBe(addDays(MONDAY, 6));
    expect(list.some((r) => r.category === 'sport')).toBe(false);
  });

  it('pesée proposée le jour choisi, pas si déjà faite cette semaine', () => {
    const d = planned();
    d.weights = [];
    const w = buildReminders(d, MONDAY, 7, 0).filter((r) => r.category === 'weigh');
    expect(w.map((r) => r.date)).toEqual([addDays(MONDAY, 6)]); // dimanche
    expect(w[0].time).toBe('09:15');
    d.weights.push({ id: 'w', date: MONDAY, kg: 68 });
    expect(buildReminders(d, MONDAY, 7, 0).some((r) => r.category === 'weigh')).toBe(false);
  });

  it('aucun message culpabilisant sur 60 jours, toutes catégories activées', () => {
    const d = planned();
    for (const r of Object.values(d.notif.rules)) r.enabled = true;
    const text = buildReminders(d, MONDAY, 60, 0).map((r) => `${r.title} ${r.body}`);
    expect(text.length).toBeGreaterThan(300);
    for (const t of text) for (const p of FORBIDDEN_PATTERNS) expect(t).not.toMatch(p);
  });
});

describe('tendance du poids', () => {
  it('lisse les variations ponctuelles', () => {
    const pts = weightTrend([
      { id: 'a', date: '2026-10-19', kg: 68.3 },
      { id: 'b', date: '2026-10-26', kg: 69.4 },
      { id: 'c', date: '2026-11-02', kg: 67.8 }
    ]);
    expect(pts[1].trend).toBeLessThan(69.4);
    expect(pts[1].trend).toBeGreaterThan(68.3);
    expect(pts[2].trend).toBeGreaterThan(67.8);
  });

  it('stagnation : message sans réduction de portions', () => {
    const pts = weightTrend(Array.from({ length: 5 }, (_, i) => ({ id: String(i), date: addDays(MONDAY, 7 * i), kg: 68 })));
    const msg = trendMessage(pts);
    expect(msg).toMatch(/Pas besoin de réduire tes portions/);
    for (const p of FORBIDDEN_PATTERNS) expect(msg).not.toMatch(p);
  });
});
