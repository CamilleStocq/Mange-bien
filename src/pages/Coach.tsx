import type { AppData } from '../store/types';
import { mutate, useData } from '../store/store';
import { addDays, formatHHMM, formatLong, todayISO, weekStart } from '../lib/dates';
import { ACTIVITY_LABEL } from '../lib/reminders';
import { SLOT_LABEL } from '../lib/planning';
import { DRINKS, MOTIVATION, STARCH_TARGET, dayKind, dayTargets, mealAdvice, proposeSportWeek, treatPlan, treatToday, waterGoal, weekWins, type DayKind } from '../lib/coach';
import { formatNumber, formatQty } from '../lib/units';
import { pickFor } from '../lib/messages';
import { randomId } from '../data/defaults';
import { Btn, Card, CardHead, Icon, NumberField, TextField, Topbar, toast } from '../components/ui';

const KIND_LABEL: Record<DayKind, string> = {
  cardio: 'Journée cardio : un peu plus de féculents pour l’énergie',
  force: 'Journée renforcement : protéines à chaque repas',
  coaching: 'Journée coaching : tu es en mouvement ce soir',
  repos: 'Journée calme : légumes en premier, féculents légers'
};

const dayName = (date: string) => formatLong(date).replace(/ \d{4}$/, '');

/** Carte de l'accueil : l'essentiel du jour, en quelques lignes. */
export function CoachCard({ date }: { date: string }) {
  const data = useData((d) => d);
  const targets = dayTargets(data, date);
  const advice = mealAdvice(data, date).filter((a) => a.reduce);
  const treat = treatToday(data, date);
  const plan = treatPlan(data, weekStart(date));
  return (
    <Card tint="sage">
      <CardHead icon="sparkle" title="Mon coach" right={<a className="small" href="#/coach">Tout voir</a>} />
      {data.profile.why && <p className="small"><strong>Ta raison :</strong> {data.profile.why}</p>}
      <p className="small">{pickFor(date, MOTIVATION)}</p>
      <ul className="small coach-list">
        {targets ? <li>Repère du jour : <strong>≈ {formatNumber(targets.kcal, 0)} kcal</strong>, dont <strong>{targets.protein} g de protéines</strong>.</li> : <li><a href="#/coach">Complète ton âge et ta taille</a> pour avoir ton repère du jour.</li>}
        <li>Eau : <strong>{formatQty(waterGoal(data, date), 'ml')}</strong> aujourd’hui.</li>
        {advice.map((a) => <li key={a.meal.id}>{SLOT_LABEL[a.meal.slot]} ({a.name}) : {a.text}</li>)}
        {treat ? <li><strong>C’est ton repas plaisir aujourd’hui</strong> ({SLOT_LABEL[treat.slot].toLowerCase()}) : profites-en, sans rien changer demain.</li> : <li>Repas plaisir : {dayName(plan.date)} {plan.slot === 'lunch' ? 'midi' : 'soir'}.</li>}
      </ul>
    </Card>
  );
}

export function CoachPage() {
  const data = useData((d) => d);
  const today = todayISO();
  const monday = weekStart(today);
  const targets = dayTargets(data, today);
  const kind = dayKind(data, today);
  const advice = mealAdvice(data, today);
  const plan = treatPlan(data, monday);
  const wins = weekWins(data, today);
  const p = data.profile;
  return (
    <div className="page">
      <Topbar title="Mon coach" sub="Perdre du poids en douceur, sans régime strict" backTo="#/aujourdhui" />

      <Card tint="sage">
        <CardHead icon="heart" title="Ma motivation" />
        <TextField label="Ma raison (pourquoi je fais ça pour moi)" value={p.why ?? ''} onChange={(v) => mutate((d) => { d.profile.why = v || undefined; })} placeholder="ex. me sentir bien dans mes vêtements, avoir de l’énergie" multiline />
        <p>{pickFor(today, MOTIVATION)}</p>
        <Wins wins={wins} hideKg={p.hideWeightOnHome} />
      </Card>

      <Card>
        <CardHead icon="food" title="Aujourd’hui" />
        <p className="small strong">{KIND_LABEL[kind]}</p>
        {targets ? (
          <>
            <p>Repère : <strong>≈ {formatNumber(targets.kcal, 0)} kcal</strong> sur la journée, dont <strong>{targets.protein} g de protéines</strong> (environ {Math.round(targets.protein / 4)} g à chaque repas, petit-déjeuner et collation compris).</p>
            <p className="tiny muted">Ta dépense estimée est d’environ {formatNumber(targets.spend, 0)} kcal : le repère te laisse un léger écart d’environ 400 kcal, jamais en dessous de 1 400 kcal. C’est une estimation, pas une règle à compter au gramme près.</p>
          </>
        ) : <ProfileForm data={data} />}
        <h3>Féculents</h3>
        <p className="small">Aujourd’hui : environ <strong>{STARCH_TARGET[kind]} g</strong> (poids cru ou sec) par repas, soit ≈ {Math.round(STARCH_TARGET[kind] * 2.5)} g cuits. Le reste de l’assiette : la moitié en légumes, un quart en protéines.</p>
        {advice.length > 0 && (
          <ul className="small coach-list">
            {advice.map((a) => <li key={a.meal.id}><strong>{SLOT_LABEL[a.meal.slot]} — {a.name} :</strong> {a.text}</li>)}
          </ul>
        )}
      </Card>

      <Card tint="sky">
        <CardHead icon="drop" title="Ce que je bois" />
        <p>Repère d’aujourd’hui : <strong>{formatQty(waterGoal(data, today), 'ml')}</strong>{waterGoal(data, today) > data.hydration.goalMl ? ' (un peu plus que d’habitude : coaching ou sport aujourd’hui)' : ''}.</p>
        <ul className="small coach-list">
          <li><strong>À volonté :</strong> {DRINKS.free}</li>
          <li><strong>Un peu :</strong> {DRINKS.some}</li>
          <li><strong>Pour le repas plaisir :</strong> {DRINKS.treat} Si tu bois de l’alcool, 1 à 2 verres, avec un grand verre d’eau entre les deux.</li>
        </ul>
        <a className="small" href="#/hydratation">Noter ce que je bois</a>
      </Card>

      <Card tint="peach">
        <CardHead icon="sparkle" title="Mon repas plaisir" />
        <p>Cette semaine : <strong>{dayName(plan.date)} {plan.slot === 'lunch' ? 'midi' : 'soir'}</strong>. {plan.why}</p>
        <ul className="small coach-list">
          <li>Un repas plaisir par semaine, prévu à l’avance : tu choisis ce que tu veux, sans te priver.</li>
          <li>Mange lentement, arrête-toi quand tu n’as plus faim, et savoure.</li>
          <li>Le lendemain, tu reprends simplement ton planning, sans rien enlever.</li>
          <li>Envie d’un petit plaisir un autre jour ? Un carré de chocolat ou un dessert partagé, ça passe très bien.</li>
        </ul>
        <p className="tiny muted">Pour le déplacer : mets « Resto » ou « Repas libre » sur le repas de ton choix dans l’agenda.</p>
      </Card>

      <SportCoach data={data} monday={monday} />

      <Card>
        <CardHead icon="book" title="Les bases" />
        <ul className="small coach-list">
          <li><strong>Assiette :</strong> ½ légumes, ¼ protéines, ¼ féculents, 1 cuillère de matière grasse.</li>
          <li><strong>Petit-déjeuner :</strong> des protéines (skyr, yaourt grec, œufs) et un fruit, pour tenir jusqu’à midi.</li>
          <li><strong>Collation si tu as faim :</strong> un fruit et une poignée d’amandes, ou un skyr. Avant le coaching, c’est même conseillé.</li>
          <li><strong>Sommeil :</strong> 7 à 8 h. La fatigue augmente l’envie de sucré.</li>
          <li><strong>Pesée :</strong> une fois par semaine. Regarde la tendance sur un mois, pas le chiffre du jour.</li>
        </ul>
        <p className="tiny muted">Repères généraux, pas une prescription. Pour un suivi adapté à ta santé, un·e diététicien·ne ou ton médecin peut t’accompagner.</p>
      </Card>
    </div>
  );
}

function Wins({ wins, hideKg }: { wins: ReturnType<typeof weekWins>; hideKg: boolean }) {
  const items = [
    wins.meals > 0 && `${wins.meals} repas maison`,
    wins.sessions > 0 && `${wins.sessions} séance${wins.sessions > 1 ? 's' : ''} (${wins.sportMin} min)`,
    wins.waterDays > 0 && `${wins.waterDays} jour${wins.waterDays > 1 ? 's' : ''} avec assez d’eau`,
    !hideKg && wins.kgLost && `${formatNumber(wins.kgLost)} kg en moins depuis le début`
  ].filter(Boolean) as string[];
  if (!items.length) return <p className="small muted">Tes victoires de la semaine s’afficheront ici dès ton premier repas noté « mangé ».</p>;
  return (
    <div className="row wrap">
      <span className="small strong">Cette semaine :</span>
      {items.map((t) => <span key={t} className="chip sage">{t}</span>)}
    </div>
  );
}

function ProfileForm({ data }: { data: AppData }) {
  const p = data.profile;
  return (
    <>
      <p className="small">Pour calculer ton repère du jour, complète :</p>
      <div className="grid3">
        <NumberField label="Âge" suffix="ans" value={p.age} min={14} max={99} onChange={(v) => v && mutate((d) => { d.profile.age = v; })} />
        <NumberField label="Taille" suffix="cm" value={p.heightCm} min={120} max={220} onChange={(v) => v && mutate((d) => { d.profile.heightCm = v; })} />
        <NumberField label="Poids" suffix="kg" value={p.startWeightKg} min={30} max={250} onChange={(v) => v && mutate((d) => { d.profile.startWeightKg = v; })} />
      </div>
    </>
  );
}

function SportCoach({ data, monday }: { data: AppData; monday: string }) {
  const sport = data.sport;
  const stage = sport.phase === 'reprise' ? sport.stages[sport.currentStage] : undefined;
  const week = sport.sessions.filter((s) => s.date >= monday && s.date <= addDays(monday, 6) && s.status !== 'repos');
  const proposal = proposeSportWeek(data, monday, () => 'apercu');
  const coachDays = data.schedule.filter((s) => s.coaching).length;
  return (
    <Card tint="rose">
      <CardHead icon="sport" title="Mon sport" />
      {sport.phase === 'recuperation' ? (
        <>
          <p className="small">Tu es en <strong>phase de récupération</strong> : le coach ne programme pas de séance tant que ton médecin ou ton kiné n’a pas validé la reprise. C’est ce qui te permettra d’en faire plus, plus longtemps.</p>
          <p className="small">En attendant, tes {coachDays} soirs de coaching te gardent en mouvement, et la marche (si elle est autorisée) est ta meilleure alliée.</p>
          <a className="btn secondary small" href="#/sport?tab=reprise">Ma reprise</a>
        </>
      ) : !stage ? null : (
        <>
          <p className="small">Le maximum dans ton cadre actuel : <strong>{stage.sessionsPerWeek} séances de {stage.maxMinutes} min</strong> ({stage.intensity}), placées en dehors du travail et des soirs de coaching, avec un jour calme entre deux séances, plus de la marche les autres jours si elle est autorisée.</p>
          {week.length ? (
            <p className="small">Cette semaine : {week.length} activité{week.length > 1 ? 's' : ''} prévue{week.length > 1 ? 's' : ''} ou faite{week.length > 1 ? 's' : ''}. <a href="#/sport">Voir</a></p>
          ) : proposal.length ? (
            <>
              <ul className="small coach-list">
                {proposal.map((s, k) => <li key={k}>{dayName(s.date)} à {formatHHMM(s.time)} : {ACTIVITY_LABEL[s.activity]} {s.durationMin} min</li>)}
              </ul>
              <Btn small icon="plus" onClick={() => { mutate((d) => { d.sport.sessions.push(...proposeSportWeek(d, monday, randomId)); }); toast('Semaine de sport ajoutée — modifiable'); }}>Ajouter à mon planning</Btn>
            </>
          ) : (
            <p className="small">Indique d’abord les activités autorisées par ton médecin ou ton kiné. <a href="#/sport?tab=autorisations">Autorisations</a></p>
          )}
          <p className="tiny muted">Pour en faire plus, passe à l’étape suivante avec l’accord de ton kiné : le coach suivra automatiquement. <Icon name="info" size={14} /></p>
        </>
      )}
    </Card>
  );
}
