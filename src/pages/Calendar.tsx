import { useMemo, useState } from 'react';
import type { AppData } from '../store/types';
import { generateWeekIfEmpty, useData } from '../store/store';
import { addDays, addMonths, DAY_SHORT, formatDayMonth, formatHHMM, formatLong, monthGrid, monthLabel, parseISO, todayISO, weekDays, weekStart, weekdayIndex } from '../lib/dates';
import { isActive, mealsOfDay, mealsOfWeek, SLOT_LABEL } from '../lib/planning';
import { dayTasks } from '../lib/tasks';
import { ACTIVITY_LABEL, buildReminders, CATEGORY_INFO } from '../lib/reminders';
import { go, type Route } from '../lib/router';
import { Btn, Card, CardHead, Empty, Icon, Seg, toast } from '../components/ui';
import { mealTime, mealTitle } from '../components/meals';
import { DayMeals, DaySport, DayTasksCard, ScheduleStrip } from '../components/day';

interface Ev {
  key: string;
  kind: 'food' | 'sport' | 'coach' | 'prep';
  time: string;
  text: string;
}

function dayEvents(data: AppData, date: string): Ev[] {
  const out: Ev[] = [];
  for (const m of mealsOfDay(data.meals, date)) {
    if (m.slot === 'snack') continue;
    out.push({ key: m.id, kind: 'food', time: mealTime(m, data), text: `${SLOT_LABEL[m.slot]} · ${mealTitle(m, data)}${isActive(m) ? '' : ` (${m.status})`}` });
  }
  const s = data.schedule[weekdayIndex(date)];
  if (s.coaching) out.push({ key: 'coach', kind: 'coach', time: s.coaching.start, text: 'Coaching (pro)' });
  for (const x of data.sport.sessions.filter((y) => y.date === date)) {
    out.push({ key: x.id, kind: 'sport', time: x.time, text: `${ACTIVITY_LABEL[x.activity]} ${x.durationMin} min${x.status !== 'prévue' ? ` (${x.status})` : ''}` });
  }
  for (const t of dayTasks(data, date)) out.push({ key: t.id, kind: 'prep', time: t.time ?? '', text: t.text });
  return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}

function Legend() {
  return (
    <div className="row wrap tiny muted">
      <span className="row" style={{ gap: 4 }}><span className="dot food" />Repas</span>
      <span className="row" style={{ gap: 4 }}><span className="dot sport" />Sport</span>
      <span className="row" style={{ gap: 4 }}><span className="dot coach" />Coaching (pro)</span>
      <span className="row" style={{ gap: 4 }}><span className="dot prep" />Préparation</span>
    </div>
  );
}

export function CalendarPage({ route }: { route: Route }) {
  const data = useData((d) => d);
  const today = todayISO();
  const [mode, setMode] = useState<'week' | 'month'>((route.query.get('vue') as 'week' | 'month') || 'week');
  const [anchor, setAnchor] = useState(route.query.get('d') || today);
  const [selected, setSelected] = useState(anchor);
  const monday = weekStart(anchor);
  const days = weekDays(monday);
  const weekHasMeals = mealsOfWeek(data.meals, monday).length > 0;

  return (
    <div className="page">
      <div className="topbar">
        <h1 className="grow">Calendrier</h1>
        <Btn small variant="ghost" onClick={() => { setAnchor(today); setSelected(today); }}>Aujourd’hui</Btn>
      </div>
      <Seg label="Affichage" value={mode} options={[{ value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }]} onChange={setMode} />
      <div className="row between">
        <button className="icon-btn" aria-label={mode === 'week' ? 'Semaine précédente' : 'Mois précédent'} onClick={() => setAnchor(mode === 'week' ? addDays(anchor, -7) : addMonths(anchor, -1))}>
          <Icon name="left" />
        </button>
        <div className="strong cap">
          {mode === 'week' ? `${formatDayMonth(days[0])} – ${formatDayMonth(days[6])}` : monthLabel(anchor)}
        </div>
        <button className="icon-btn" aria-label={mode === 'week' ? 'Semaine suivante' : 'Mois suivant'} onClick={() => setAnchor(mode === 'week' ? addDays(anchor, 7) : addMonths(anchor, 1))}>
          <Icon name="right" />
        </button>
      </div>
      <Legend />

      {mode === 'week' ? (
        <>
          {!weekHasMeals && (
            <Card tint="sage">
              <p>Aucun repas n’est encore planifié pour cette semaine.</p>
              <Btn onClick={() => { generateWeekIfEmpty(monday); toast('Semaine générée à partir de tes recettes'); }}>Générer cette semaine</Btn>
            </Card>
          )}
          {days.map((d) => {
            const evs = dayEvents(data, d);
            return (
              <Card key={d} className={d === today ? 'today-card' : ''}>
                <a className="row between" href={`#/jour/${d}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h2 className="cap">{formatLong(d).replace(/ \d{4}$/, '')}</h2>
                  <Icon name="chevron" size={18} />
                </a>
                {evs.length ? (
                  <div className="col" style={{ gap: 4 }}>
                    {evs.map((e) => (
                      <div key={e.key} className={`ev ${e.kind}`}>
                        <span className="ev-time">{e.time ? formatHHMM(e.time) : ''}</span>
                        <span className="grow">{e.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="small muted">Rien de prévu.</p>
                )}
              </Card>
            );
          })}
        </>
      ) : (
        <MonthView anchor={anchor} selected={selected} onSelect={setSelected} data={data} today={today} />
      )}
    </div>
  );
}

function MonthView({ anchor, selected, onSelect, data, today }: { anchor: string; selected: string; onSelect: (d: string) => void; data: AppData; today: string }) {
  const grid = useMemo(() => monthGrid(anchor), [anchor]);
  const month = parseISO(anchor).getUTCMonth();
  const evs = dayEvents(data, selected);
  return (
    <>
      <div className="month" role="grid" aria-label={monthLabel(anchor)}>
        {DAY_SHORT.map((d) => <div key={d} className="mh">{d}</div>)}
        {grid.map((d) => {
          const e = dayEvents(data, d);
          const kinds = [...new Set(e.map((x) => x.kind))];
          return (
            <button key={d} className={`${parseISO(d).getUTCMonth() !== month ? 'out' : ''} ${d === today ? 'today' : ''}`} aria-pressed={d === selected} aria-label={formatLong(d)} onClick={() => onSelect(d)} onDoubleClick={() => go(`/jour/${d}`)}>
              {parseISO(d).getUTCDate()}
              <span className="dots">{kinds.map((k) => <span key={k} className={`dot ${k}`} />)}</span>
            </button>
          );
        })}
      </div>
      <Card>
        <CardHead title={<span className="cap">{formatLong(selected)}</span>} />
        {evs.length ? evs.map((e) => (
          <div key={e.key} className={`ev ${e.kind}`}>
            <span className="ev-time">{e.time ? formatHHMM(e.time) : ''}</span>
            <span className="grow">{e.text}</span>
          </div>
        )) : <p className="small muted">Rien de prévu.</p>}
        <a className="btn secondary" href={`#/jour/${selected}`}>Voir la journée détaillée</a>
      </Card>
    </>
  );
}

export function DayPage({ date }: { date: string }) {
  const data = useData((d) => d);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!valid) return <div className="page"><Empty><p>Cette date n’existe pas dans le calendrier.</p><a className="btn secondary" href="#/calendrier">Revenir au calendrier</a></Empty></div>;
  const reminders = buildReminders(data, date, 1, 0);
  return (
    <div className="page">
      <div className="topbar">
        <a className="icon-btn" href={`#/calendrier?d=${date}`} aria-label="Retour au calendrier"><Icon name="back" /></a>
        <h1 className="grow cap" style={{ fontSize: '1.25rem' }}>{formatLong(date)}</h1>
      </div>
      <div className="row between">
        <a className="btn ghost small" href={`#/jour/${addDays(date, -1)}`}><Icon name="left" size={18} />Veille</a>
        {date !== todayISO() && <a className="btn ghost small" href="#/aujourdhui">Aujourd’hui</a>}
        <a className="btn ghost small" href={`#/jour/${addDays(date, 1)}`}>Lendemain<Icon name="right" size={18} /></a>
      </div>
      <DayTasksCard date={date} />
      <DayMeals date={date} />
      <DaySport date={date} />
      <Card>
        <CardHead icon="clock" title="Horaires" />
        <ScheduleStrip date={date} />
      </Card>
      <Card>
        <CardHead icon="bell" title="Rappels associés" />
        {reminders.length ? (
          <div className="list">
            {reminders.map((r) => (
              <div key={r.id} className="list-item">
                <span className="strong small nowrap">{formatHHMM(r.time)}</span>
                <div className="grow">
                  <div className="small strong">{CATEGORY_INFO[r.category].label}</div>
                  <div className="small muted">{r.body}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="small muted">Aucun rappel ce jour-là (catégories désactivées, pause ou heures calmes).</p>
        )}
        <a className="small" href="#/reglages/notifications">Régler les notifications</a>
      </Card>
    </div>
  );
}
