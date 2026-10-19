import { useState } from 'react';
import { ensureWeek, mutate, useData } from '../store/store';
import { addDays, diffDays, formatLong, todayISO, weekStart, weekdayIndex } from '../lib/dates';
import { beforeStart } from '../lib/planning';
import { ENCOURAGEMENTS, pickFor } from '../lib/messages';
import { randomId } from '../data/defaults';
import { Btn, Card, CardHead, FruitArt, Icon, NumberField, toast, SubmitBtn } from '../components/ui';
import { DayMeals, DaySport, DayTasksCard, ScheduleStrip } from '../components/day';
import { HydrationWidget } from '../components/hydration';

function WeighPrompt({ today }: { today: string }) {
  const data = useData((d) => d);
  const [kg, setKg] = useState<number | undefined>();
  const monday = weekStart(today);
  const meta = data.weeks[monday];
  const done = data.weights.some((w) => w.date >= monday && w.date <= addDays(monday, 6));
  const due = weekdayIndex(today) >= data.weighDay;
  if (beforeStart(data, today) || !data.weighReminders || done || !due || meta?.weighing === 'ignoré' || (meta?.weighPostponedTo && today < meta.weighPostponedTo)) return null;
  return (
    <Card tint="peach">
      <CardHead icon="scale" title="Point hebdomadaire" />
      <p className="small">Si tu te sens à l’aise avec la pesée aujourd’hui : idéalement le matin, dans les mêmes conditions que d’habitude. Sinon, tu peux la reporter ou l’ignorer, sans souci.</p>
      <NumberField label="Poids" suffix="kg" value={kg} min={30} max={250} onChange={setKg} />
      <div className="grid3">
        <SubmitBtn
          missing={!kg && 'Indique ton poids pour l’enregistrer.'}
          onClick={() => {
            if (!kg) return;
            mutate((d) => {
              d.weights.push({ id: randomId(), date: today, kg });
            });
            toast('Merci, c’est noté');
          }}
        >
          Enregistrer
        </SubmitBtn>
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
  const start = useData((d) => d.profile.startDate);
  const notStarted = useData((d) => beforeStart(d, today));
  const inDays = diffDays(start, today);
  return (
    <div className="page">
      <div className="topbar">
        <span className="brand grow">mange bien<b> !</b></span>
        <a className="icon-btn" href="#/reglages" aria-label="Réglages">
          <Icon name="gear" />
        </a>
      </div>
      <section className="hero">
        <FruitArt className="hero-art" />
        <span className="kicker">Aujourd’hui</span>
        <span className="date">{formatLong(today)}</span>
        <p>{pickFor(today, ENCOURAGEMENTS)}</p>
        <div className="row wrap">
          <span className="chip rose">{phase === 'recuperation' ? 'Sport : phase de récupération' : 'Sport : reprise progressive'}</span>
        </div>
      </section>
      {notStarted && (
        <Card tint="warn">
          <CardHead icon="calendar" title={inDays === 1 ? 'C’est demain !' : `J-${inDays}`} />
          <p>Ton programme commence le <strong>{formatLong(start)}</strong>. D’ici là, rien à faire : tes repas, ta pesée et tes rappels démarreront ce jour-là.</p>
          <div className="row wrap">
            <a className="btn small" href={`#/jour/${start}`}>Voir mon premier jour</a>
            <a className="btn secondary small" href="#/alimentation?tab=recettes">Découvrir mes recettes</a>
          </div>
        </Card>
      )}
      <WeighPrompt today={today} />
      <DayTasksCard date={today} />
      <DayMeals date={today} />
      <HydrationWidget compact />
      <DaySport date={today} />
      <Card>
        <button className="link-row" onClick={() => setShowHours(!showHours)} aria-expanded={showHours} style={{ padding: 0, minHeight: 44, border: 0 }}>
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
