import { useState, type ReactNode } from 'react';
import type { ActivityKey, AuthStatus } from '../store/types';
import { generateWeekIfEmpty, mutate, useData } from '../store/store';
import { addDays, DAY_NAMES, todayISO, weekStart } from '../lib/dates';
import { formatQty, STATE_LABEL } from '../lib/units';
import { capabilities, requestPermission } from '../lib/push';
import { ACTIVITY_LABEL } from '../lib/reminders';
import { go } from '../lib/router';
import { Btn, Card, Icon, NumberField, Seg, Toggle, toast } from '../components/ui';
import { ACTIVITIES } from '../components/sport';
import { DayScheduleEditor } from './Settings';

const STEPS = ['Bienvenue', 'Toi', 'Repère', 'Petit-déjeuner', 'Horaires', 'Budget', 'Pesée', 'Notifications', 'Sport', 'Recettes', 'Planning'];

export function Onboarding() {
  const d = useData((x) => x);
  const [step, setStep] = useState(0);
  const [day, setDay] = useState(0);
  const next = (confirmKey?: string) => {
    if (confirmKey) mutate((x) => { x.confirmed[confirmKey] = true; });
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo(0, 0);
  };
  const finish = () => {
    const monday = weekStart(todayISO());
    generateWeekIfEmpty(monday);
    generateWeekIfEmpty(addDays(monday, 7));
    mutate((x) => { x.onboardingDone = true; });
    toast('Ton planning est prêt 🌿');
    go('/aujourdhui');
  };
  const nav = (confirmKey?: string, label = 'Confirmer') => (
    <div className="grid2">
      <Btn variant="ghost" onClick={() => next()}>Plus tard</Btn>
      <Btn onClick={() => next(confirmKey)}>{label}</Btn>
    </div>
  );
  const wrap = (title: string, body: ReactNode, footer: ReactNode) => (
    <div className="page">
      <div className="onb-dots" aria-label={`Étape ${step + 1} sur ${STEPS.length}`}>{STEPS.map((s, i) => <span key={s} className={i === step ? 'on' : ''} />)}</div>
      <div className="row">
        {step > 0 && <button className="icon-btn plain" aria-label="Étape précédente" onClick={() => setStep(step - 1)}><Icon name="back" /></button>}
        <h1 className="grow">{title}</h1>
      </div>
      {body}
      {footer}
      {step > 0 && step < STEPS.length - 1 && <button className="btn ghost small" onClick={() => setStep(STEPS.length - 1)}>Terminer la configuration maintenant</button>}
    </div>
  );

  switch (step) {
    case 0:
      return wrap('Bienvenue dans Manges bien !', (
        <Card tint="sage">
          <p>Ton application pour savoir chaque jour quoi manger, quoi préparer le dimanche, quoi acheter et où tu en es — à ton rythme, sans pression.</p>
          <p className="small">Quelques questions rapides pour vérifier tes informations. Tout reste modifiable ensuite, et tu peux passer n’importe quelle étape : les informations non confirmées seront simplement marquées « provisoires ».</p>
        </Card>
      ), <Btn onClick={() => next()}>Commencer</Btn>);
    case 1:
      return wrap('Taille et poids actuel', (
        <Card>
          <NumberField label="Taille" suffix="cm" value={d.profile.heightCm} min={120} max={220} onChange={(v) => v && mutate((x) => { x.profile.heightCm = v; })} />
          <NumberField label="Poids actuel" suffix="kg" value={d.profile.startWeightKg} min={30} max={250} onChange={(v) => v && mutate((x) => { x.profile.startWeightKg = v; const s = x.weights.find((w) => w.id === 'start'); if (s) s.kg = v; })} />
        </Card>
      ), nav('profile'));
    case 2:
      return wrap('Ton repère indicatif', (
        <Card>
          <p className="small">C’est un cap, pas une obligation : l’application ne te poussera jamais à manger trop peu pour l’atteindre.</p>
          <NumberField label="Poids repère" suffix="kg" value={d.profile.targetWeightKg} min={30} max={250} onChange={(v) => v && mutate((x) => { x.profile.targetWeightKg = v; })} />
          <label className="field">Date indicative<input className="input" type="date" value={d.profile.targetDate} onChange={(e) => e.target.value && mutate((x) => { x.profile.targetDate = e.target.value; x.profile.planEnd = e.target.value; })} /></label>
        </Card>
      ), nav('target'));
    case 3:
      return wrap('Ton petit-déjeuner', (
        <Card>
          <p className="small">Il est prévu chaque matin par défaut. Portions de départ :</p>
          {d.breakfast.map((b, k) => (
            <div key={b.id} className="row">
              <span className="grow">{b.name}<div className="tiny muted">{b.state ? STATE_LABEL[b.state] : ''}{b.hint ? ` — ${b.hint}` : ''}</div></span>
              <div style={{ width: 110 }}><NumberField value={b.qty} min={0} suffix={b.unit} onChange={(v) => mutate((x) => { x.breakfast[k].qty = v ?? 0; })} /></div>
            </div>
          ))}
          <p className="tiny muted">Total : {d.breakfast.map((b) => formatQty(b.qty, b.unit)).join(' + ')}</p>
        </Card>
      ), nav('breakfast'));
    case 4:
      return wrap('Tes horaires', (
        <>
          <Seg label="Jour" value={String(day)} options={DAY_NAMES.map((n, i) => ({ value: String(i), label: n.slice(0, 3) }))} onChange={(v) => setDay(Number(v))} />
          <Card>
            <h2 className="cap">{DAY_NAMES[day]}</h2>
            <DayScheduleEditor s={d.schedule[day]} onChange={(fn) => mutate((x) => { fn(x.schedule[day]); })} />
          </Card>
        </>
      ), nav('schedule'));
    case 5:
      return wrap('Ton budget courses', (
        <Card>
          <NumberField label="Budget par semaine" suffix="€" value={d.weeklyBudget} min={0} onChange={(v) => v != null && mutate((x) => { x.weeklyBudget = v; })} />
          <label className="field">Samedi soir
            <select className="input" value={d.saturdayDinner} onChange={(e) => mutate((x) => { x.saturdayDinner = e.target.value as typeof d.saturdayDinner; })}>
              <option value="restaurant">Restaurant</option><option value="free">Repas libre</option><option value="planned">Repas planifié</option>
            </select>
          </label>
        </Card>
      ), nav('budget'));
    case 6:
      return wrap('Ta pesée hebdomadaire', (
        <Card>
          <label className="field">Jour de pesée
            <select className="input" value={d.weighDay} onChange={(e) => mutate((x) => { x.weighDay = Number(e.target.value); })}>{DAY_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
          </label>
          <div className="row between"><span>Me proposer la pesée</span><Toggle label="Proposer la pesée" checked={d.weighReminders} onChange={(v) => mutate((x) => { x.weighReminders = v; })} /></div>
          <p className="tiny muted">Tu pourras toujours la reporter ou l’ignorer, et désactiver ce rappel.</p>
        </Card>
      ), nav('weigh'));
    case 7: {
      const caps = capabilities();
      return wrap('Tes rappels', (
        <Card>
          <p className="small">Repas du jour, portion à sortir du congélateur, batch du dimanche, courses… Tu choisiras les catégories et les heures dans Réglages → Notifications.</p>
          {caps.ios && !caps.standalone && <div className="alert-banner">Sur iPhone, ajoute d’abord l’app à l’écran d’accueil pour recevoir des notifications. <a href="#/reglages/iphone">Comment faire</a></div>}
          <Btn variant="secondary" disabled={!caps.notifications || caps.permission === 'granted'} onClick={async () => { const p = await requestPermission(); toast(p === 'granted' ? 'Notifications autorisées' : 'Pas de souci, tu pourras le faire plus tard'); }}>
            {caps.permission === 'granted' ? 'Notifications autorisées ✓' : 'Autoriser les notifications'}
          </Btn>
        </Card>
      ), nav('notifications', 'Continuer'));
    }
    case 8:
      return wrap('Ton activité sportive', (
        <Card>
          <p className="small"><strong>Ton programme démarre en phase de récupération</strong>, sans séance imposée. Indique seulement ce que ton médecin ou ton kiné a déjà autorisé ; laisse « non renseigné » sinon.</p>
          {ACTIVITIES.map((a: ActivityKey) => (
            <div key={a} className="row between">
              <span>{ACTIVITY_LABEL[a]}</span>
              <select className="input sm" style={{ width: 'auto' }} value={d.sport.authorizations[a].status} onChange={(e) => mutate((x) => { x.sport.authorizations[a] = { ...x.sport.authorizations[a], status: e.target.value as AuthStatus, updatedOn: todayISO() }; })} aria-label={ACTIVITY_LABEL[a]}>
                <option value="inconnu">Non renseigné</option><option value="autorisé">Autorisé</option><option value="restreint">Avec restrictions</option><option value="non autorisé">Non autorisé</option>
              </select>
            </div>
          ))}
          <label className="field">Prochaine évaluation (facultatif)<input className="input" type="date" value={d.sport.nextEvaluation ?? ''} onChange={(e) => mutate((x) => { x.sport.nextEvaluation = e.target.value || undefined; })} /></label>
        </Card>
      ), nav('sport'));
    case 9: {
      const prov = d.recipes.filter((r) => r.provisional).length;
      return wrap('Tes recettes', (
        <Card>
          <p className="small">Ta bibliothèque contient tes {d.recipes.length} recettes (sans doublons). Leurs quantités sont des <strong>portions de départ provisoires</strong> ({prov} à vérifier) : tu pourras saisir tes proportions habituelles quand tu veux, depuis Alimentation → Recettes.</p>
          <a className="btn secondary small" href="#/alimentation?tab=recettes" onClick={() => mutate((x) => { x.onboardingDone = true; })}>Voir mes recettes maintenant</a>
        </Card>
      ), <Btn onClick={() => next()}>Continuer</Btn>);
    }
    default:
      return wrap('Ta première semaine', (
        <Card tint="sage">
          <p>Je prépare ta semaine en cours et la suivante à partir de tes recettes : petit-déjeuner habituel, batch du dimanche pour les jours chargés, recettes rapides le jeudi soir et le week-end, samedi soir libre.</p>
          <p className="small muted">Tu pourras remplacer, déplacer ou ajouter n’importe quel repas.</p>
        </Card>
      ), <Btn onClick={finish}>Générer mon planning</Btn>);
  }
}
