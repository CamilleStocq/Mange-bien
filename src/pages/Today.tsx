import { useState } from 'react';
import { ensureWeek, mutate, useData } from '../store/store';
import { addDays, formatLong, todayISO, weekStart, weekdayIndex } from '../lib/dates';
import { ENCOURAGEMENTS, pickFor } from '../lib/messages';
import { randomId } from '../data/defaults';
import { Btn, Card, CardHead, Icon, NumberField, toast } from '../components/ui';
import { DayMeals, DaySport, DayTasksCard, ScheduleStrip } from '../components/day';
import { HydrationWidget } from '../components/hydration';

function WeighPrompt({ today }: { today: string }) {
  const data = useData((d) => d);
  const [kg, setKg] = useState<number | undefined>();
  const monday = weekStart(today);
  const meta = data.weeks[monday];
  const done = data.weights.some((w) => w.date >= monday && w.date <= addDays(monday, 6));
  const due = weekdayIndex(today) >= data.weighDay;
  if (!data.weighReminders || done || !due || meta?.weighing === 'ignoré' || (meta?.weighPostponedTo && today < meta.weighPostponedTo)) return null;
  return (
    <Card tint="peach">
      <CardHead icon="scale" title="Point hebdomadaire" />
      <p className="small">Si tu te sens à l’aise avec la pesée aujourd’hui : idéalement le matin, dans les mêmes conditions que d’habitude. Sinon, tu peux la reporter ou l’ignorer, sans souci.</p>
      <NumberField label="Poids" suffix="kg" value={kg} min={30} max={250} onChange={setKg} />
      <div className="grid3">
        <Btn
          disabled={!kg}
          onClick={() => {
            if (!kg) return;
            mutate((d) => {
              d.weights.push({ id: randomId(), date: today, kg });
            });
            toast('Merci, c’est noté');
          }}
        >
          Enregistrer
        </Btn>
        <Btn variant="secondary" onClick={() => mutate((d) => { ensureWeek(d, monday).weighPostponedTo = addDays(today, 1); })}>
          Demain
        </Btn>
        <Btn variant="ghost" onClick={() => mutate((d) => { ensureWeek(d, monday).weighing = 'ignoré'; })}>
          Ignorer
        </Btn>
      </div>
    </Card>
  );
}

export function Today() {
  const today = todayISO();
  const phase = useData((d) => d.sport.phase);
  const pushOn = useData((d) => d.push.subscribed);
  const [showHours, setShowHours] = useState(false);
  return (
    <div className="page">
      <div className="topbar">
        <div className="grow" />
        <a className="icon-btn" href="#/reglages" aria-label="Réglages">
          <Icon name="gear" />
        </a>
      </div>
      <section className="hero">
        <span className="small muted strong">Aujourd’hui</span>
        <span className="date">{formatLong(today)}</span>
        <p>{pickFor(today, ENCOURAGEMENTS)}</p>
        <div className="row wrap">
          <span className="chip rose">{phase === 'recuperation' ? 'Sport : phase de récupération' : 'Sport : reprise progressive'}</span>
        </div>
      </section>
      <WeighPrompt today={today} />
      <DayTasksCard date={today} />
      <DayMeals date={today} expanded />
      <HydrationWidget compact />
      <DaySport date={today} />
      <Card>
        <button className="link-row" onClick={() => setShowHours(!showHours)} aria-expanded={showHours} style={{ padding: 0, minHeight: 32, border: 0 }}>
          <Icon name="clock" />
          <h2 className="grow">Horaires du jour</h2>
          <Icon name={showHours ? 'minus' : 'plus'} size={18} />
        </button>
        {showHours && <ScheduleStrip date={today} />}
      </Card>
      {!pushOn && (
        <Card tint="sage">
          <CardHead icon="bell" title="Rappels" />
          <p className="small">Les rappels quotidiens (repas, décongélation, batch, courses) ne sont pas encore activés sur cet appareil.</p>
          <a className="btn secondary" href="#/reglages/notifications">Configurer les notifications</a>
        </Card>
      )}
    </div>
  );
}
