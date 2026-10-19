import { useMemo, useState } from 'react';
import { useData } from '../store/store';
import { beforeStart, mealsOfDay, SLOT_ORDER } from '../lib/planning';
import { dayTasks } from '../lib/tasks';
import { formatHHMM, formatLong, weekdayIndex } from '../lib/dates';
import { ACTIVITY_LABEL } from '../lib/reminders';
import { Btn, Card, CardHead, Empty, Icon } from './ui';
import { MealCard, MealEditor } from './meals';
import { SessionCard } from './sport';

export function ScheduleStrip({ date }: { date: string }) {
  const s = useData((d) => d.schedule[weekdayIndex(date)]);
  return (
    <div className="col">
      <div className="ev prep"><span className="ev-time">{formatHHMM(s.wake)}</span>Réveil</div>
      {s.work && <div className="ev prep"><span className="ev-time">{formatHHMM(s.work.start)}</span>Travail jusqu’à {formatHHMM(s.work.end)}</div>}
      {s.coaching && (
        <div className="ev coach">
          <span className="ev-time">{formatHHMM(s.coaching.start)}</span>
          <span>Coaching jusqu’à {formatHHMM(s.coaching.end)} <span className="tiny muted">— engagement professionnel, pas ta séance</span></span>
        </div>
      )}
      <div className="ev prep"><span className="ev-time">{formatHHMM(s.bed)}</span>Coucher</div>
      {s.note && <p className="small muted">{s.note}</p>}
    </div>
  );
}

export function DayTasksCard({ date }: { date: string }) {
  const data = useData((d) => d);
  const tasks = dayTasks(data, date);
  if (!tasks.length) return null;
  return (
    <Card tint="sky">
      <CardHead icon="list" title="À anticiper" />
      <div className="list">
        {tasks.map((t) => (
          <a key={t.id} className="link-row" href={t.href ?? '#'} style={{ minHeight: 44 }} onClick={(e) => !t.href && e.preventDefault()}>
            <Icon name={t.icon} />
            <div className="grow small">
              {t.time && <strong>{formatHHMM(t.time)} · </strong>}
              {t.text}
            </div>
            {t.href && <Icon name="chevron" size={18} />}
          </a>
        ))}
      </div>
    </Card>
  );
}

export function DayMeals({ date, expanded }: { date: string; expanded?: boolean }) {
  const all = useData((d) => d.meals);
  const notStarted = useData((d) => beforeStart(d, date));
  const start = useData((d) => d.profile.startDate);
  const meals = useMemo(() => mealsOfDay(all, date), [all, date]);
  const [adding, setAdding] = useState(false);
  const sorted = [...meals].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  return (
    <Card>
      <CardHead icon="food" title="Repas" right={<Btn small variant="secondary" icon="plus" onClick={() => setAdding(true)}>Ajouter</Btn>} />
      {sorted.length ? (
        <div className="col">{sorted.map((m) => <MealCard key={m.id} m={m} expanded={expanded} />)}</div>
      ) : (
        notStarted ? (
          <Empty>
            <p>Ton programme commence le {formatLong(start)}. Rien n’est prévu avant, c’est normal.</p>
            <a className="btn secondary small" href={`#/jour/${start}`}>Voir mon premier jour</a>
          </Empty>
        ) : (
          <Empty icon="food">
            <p>Aucun repas prévu ce jour-là.</p>
            <a className="btn secondary small" href="#/alimentation">Générer la semaine</a>
          </Empty>
        )
      )}
      {adding && <MealEditor date={date} slot="dinner" onClose={() => setAdding(false)} />}
    </Card>
  );
}

export function DaySport({ date }: { date: string }) {
  const sport = useData((d) => d.sport);
  const sessions = sport.sessions.filter((s) => s.date === date);
  const allowed = Object.entries(sport.authorizations).filter(([, a]) => a.status === 'autorisé' || a.status === 'restreint');
  return (
    <Card tint="rose">
      <CardHead icon="sport" title="Activité" right={<a className="small" href="#/sport">Mon sport</a>} />
      {sport.phase === 'recuperation' && (
        <p className="small">
          <strong>Phase de récupération.</strong> Aucune séance n’est imposée. Aujourd’hui, la récupération fait partie du programme.
        </p>
      )}
      {sessions.length ? (
        sessions.map((s) => <SessionCard key={s.id} s={s} />)
      ) : allowed.length ? (
        <p className="small muted">Activités actuellement autorisées : {allowed.map(([k]) => ACTIVITY_LABEL[k]).join(', ')}. Rien n’est prévu aujourd’hui, et c’est très bien ainsi.</p>
      ) : (
        <p className="small muted">Aucune activité n’est encore renseignée comme autorisée par ton médecin ou ton kiné.</p>
      )}
    </Card>
  );
}
