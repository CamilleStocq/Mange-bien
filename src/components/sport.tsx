import { useState } from 'react';
import type { ActivityKey, SportSession } from '../store/types';
import { mutate, useData } from '../store/store';
import { formatHHMM, formatShort, nowHHMM, todayISO } from '../lib/dates';
import { ACTIVITY_LABEL } from '../lib/reminders';
import { randomId } from '../data/defaults';
import { Btn, Card, Icon, NumberField, Seg, Sheet, TextField, toast, confirmAsk, SubmitBtn } from './ui';

export const ACTIVITIES: ActivityKey[] = ['natation', 'velo', 'course', 'renforcement', 'mobilite', 'marche'];

export const RED_FLAGS = [
  'Nouvelle faiblesse importante dans une jambe (pied qui « tombe », jambe qui lâche)',
  'Perte ou diminution de la sensibilité au niveau du périnée / de l’entrejambe',
  'Difficulté à uriner, fuites ou perte du contrôle de la vessie',
  'Perte du contrôle des intestins',
  'Douleur qui s’aggrave très rapidement, ou accompagnée de fièvre'
];

export function UrgentAlert() {
  return (
    <Card tint="danger" role="alert">
      <div className="row">
        <Icon name="alert" />
        <h2>Obtiens une aide médicale urgente</h2>
      </div>
      <p>
        Ces symptômes peuvent signaler une compression nerveuse qui nécessite un avis médical <strong>sans attendre</strong>. Appelle le <a href="tel:112"><strong>112</strong></a> ou rends-toi aux urgences.
        En dehors d’une urgence vitale, le médecin de garde est joignable au <a href="tel:1733">1733</a>.
      </p>
      <p className="small">L’application ne peut pas évaluer ton état. N’attends pas une notification ou un graphique pour consulter.</p>
    </Card>
  );
}

export function isAllowed(status?: string) {
  return status === 'autorisé' || status === 'restreint';
}

const STATUS_LABEL: Record<SportSession['status'], string> = { prévue: 'prévue', faite: 'faite', reportée: 'reportée', repos: 'remplacée par du repos' };

export function SessionCard({ s }: { s: SportSession }) {
  const [edit, setEdit] = useState(false);
  const auth = useData((d) => d.sport.authorizations[s.activity]);
  const set = (p: Partial<SportSession>) =>
    mutate((d) => {
      const x = d.sport.sessions.find((y) => y.id === s.id);
      if (x) Object.assign(x, p);
    });
  return (
    <div className="ev sport" style={{ alignItems: 'flex-start' }}>
      <span className="ev-time">{formatHHMM(s.time)}</span>
      <div className="grow col" style={{ gap: 4 }}>
        <div className="strong">
          {ACTIVITY_LABEL[s.activity]} · {s.durationMin} min · {s.intensity}
        </div>
        <div className="row wrap">
          <span className={`chip ${s.status === 'faite' ? 'sage' : s.status === 'prévue' ? '' : 'rose'}`}>{STATUS_LABEL[s.status]}</span>
          {!isAllowed(auth?.status) && <span className="chip warn">activité non confirmée comme autorisée</span>}
        </div>
        {s.notes && <div className="small muted">{s.notes}</div>}
        <div className="row wrap">
          {s.status === 'prévue' && (
            <>
              <Btn small variant="secondary" icon="check" onClick={() => { set({ status: 'faite' }); toast('Séance notée'); }}>Faite</Btn>
              <Btn small variant="ghost" icon="moon" onClick={() => { set({ status: 'repos' }); toast('Le repos fait partie du programme'); }}>Repos</Btn>
            </>
          )}
          <Btn small variant="ghost" icon="edit" onClick={() => setEdit(true)}>Modifier</Btn>
        </div>
      </div>
      {edit && <SessionEditor session={s} onClose={() => setEdit(false)} />}
    </div>
  );
}

export function SessionEditor({ session, date, onClose }: { session?: SportSession; date?: string; onClose: () => void }) {
  const sport = useData((d) => d.sport);
  const allowed = ACTIVITIES.filter((a) => isAllowed(sport.authorizations[a].status));
  const [draft, setDraft] = useState<SportSession>(
    session ?? { id: randomId(), date: date ?? todayISO(), time: '10:00', activity: allowed[0] ?? 'mobilite', durationMin: 20, intensity: 'très douce', status: 'prévue', notes: '' }
  );
  const [moveTo, setMoveTo] = useState('');
  const stage = sport.phase === 'reprise' ? sport.stages[sport.currentStage] : undefined;
  const set = (p: Partial<SportSession>) => setDraft((d) => ({ ...d, ...p }));
  const save = () => {
    if (!isAllowed(sport.authorizations[draft.activity].status)) {
      toast('Cette activité n’est pas indiquée comme autorisée');
      return;
    }
    mutate((d) => {
      const i = d.sport.sessions.findIndex((x) => x.id === draft.id);
      if (i >= 0) d.sport.sessions[i] = draft;
      else d.sport.sessions.push(draft);
    });
    onClose();
  };
  return (
    <Sheet title={session ? 'Modifier la séance' : 'Planifier une séance'} onClose={onClose}>
      {!allowed.length ? (
        <>
          <p>Aucune activité n’est indiquée comme autorisée pour l’instant. Renseigne d’abord ce que ton médecin ou ton kiné a validé.</p>
          <a className="btn" href="#/sport?tab=autorisations" onClick={onClose}>Mes autorisations</a>
        </>
      ) : (
        <>
          <label className="field">
            Activité
            <select className="input" value={draft.activity} onChange={(e) => set({ activity: e.target.value as ActivityKey })}>
              {ACTIVITIES.map((a) => (
                <option key={a} value={a} disabled={!isAllowed(sport.authorizations[a].status)}>
                  {ACTIVITY_LABEL[a]}{!isAllowed(sport.authorizations[a].status) ? ' (non autorisée)' : sport.authorizations[a].status === 'restreint' ? ' (avec restrictions)' : ''}
                </option>
              ))}
            </select>
          </label>
          {sport.authorizations[draft.activity].note && <p className="small muted">Consigne : {sport.authorizations[draft.activity].note}</p>}
          <div className="grid2">
            <label className="field">
              Date
              <input className="input" type="date" value={draft.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
            </label>
            <label className="field">
              Heure
              <input className="input" type="time" value={draft.time} onChange={(e) => e.target.value && set({ time: e.target.value })} />
            </label>
          </div>
          <NumberField label="Durée" suffix="min" value={draft.durationMin} min={5} max={300} onChange={(v) => set({ durationMin: v ?? 20 })} />
          {stage && draft.durationMin > stage.maxMinutes && <p className="small" style={{ color: 'var(--warn)' }}>Plus long que le repère de ton étape actuelle ({stage.maxMinutes} min). À valider avec ton kiné.</p>}
          <Seg label="Intensité" value={draft.intensity} options={[{ value: 'très douce', label: 'Très douce' }, { value: 'douce', label: 'Douce' }, { value: 'modérée', label: 'Modérée' }]} onChange={(v) => set({ intensity: v })} />
          {session && (
            <Seg label="Statut" value={draft.status} options={[{ value: 'prévue', label: 'Prévue' }, { value: 'faite', label: 'Faite' }, { value: 'reportée', label: 'Reportée' }, { value: 'repos', label: 'Repos' }]} onChange={(v) => set({ status: v })} />
          )}
          {draft.status === 'faite' && <NumberField label="Douleur après la séance (0 à 10, facultatif)" value={draft.painAfter} min={0} max={10} onChange={(v) => set({ painAfter: v })} />}
          <TextField label="Notes" value={draft.notes} onChange={(v) => set({ notes: v })} multiline />
          <Btn onClick={save} block>Enregistrer</Btn>
          {session && (
            <Card>
              <span className="small strong">Reporter : déplacer ou supprimer, c’est toi qui choisis</span>
              <div className="row">
                <input className="input grow" type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Nouvelle date" />
                <SubmitBtn small variant="secondary" missing={!moveTo && 'Choisis la nouvelle date.'} onClick={() => { mutate((d) => { const x = d.sport.sessions.find((y) => y.id === draft.id); if (x) { x.date = moveTo; x.status = 'prévue'; } }); toast(`Séance déplacée au ${formatShort(moveTo)}`); onClose(); }}>Déplacer la séance</SubmitBtn>
              </div>
              <Btn small variant="danger" icon="trash" onClick={async () => { if (await confirmAsk({ title: `Supprimer la séance « ${ACTIVITY_LABEL[draft.activity]} » du ${formatShort(draft.date)} ?`, confirm: 'Supprimer la séance', danger: true })) { mutate((d) => { d.sport.sessions = d.sport.sessions.filter((x) => x.id !== draft.id); }); onClose(); } }}>Supprimer la séance</Btn>
            </Card>
          )}
        </>
      )}
    </Sheet>
  );
}

/**
 * « J'ai fait du sport aujourd'hui » : noter une séance déjà faite, même imprévue.
 * Le repas suivant est alors choisi pour aider à récupérer (si ce n'est pas un repas choisi à la main).
 */
export function DoneSessionSheet({ onClose }: { onClose: () => void }) {
  const auth = useData((d) => d.sport.authorizations);
  const [activity, setActivity] = useState<ActivityKey>(ACTIVITIES.find((a) => isAllowed(auth[a].status)) ?? 'marche');
  const [time, setTime] = useState(nowHHMM());
  const [duration, setDuration] = useState<number | undefined>(45);
  const [intensity, setIntensity] = useState<SportSession['intensity']>('douce');
  const save = () => {
    const minutes = duration ?? 30;
    const [h, m] = time.split(':').map(Number);
    const start = Math.max(0, h * 60 + m - minutes);
    const startHHMM = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
    mutate((d) => {
      d.sport.sessions.push({ id: randomId(), date: todayISO(), time: startHHMM, activity, durationMin: minutes, intensity, status: 'faite', notes: 'Notée après coup' });
    });
    const cardio = activity === 'course' || activity === 'velo' || activity === 'natation';
    toast(cardio || activity === 'renforcement' ? 'Séance notée : ton prochain repas t’aide à récupérer' : 'Séance notée');
    onClose();
  };
  return (
    <Sheet title="J’ai fait du sport aujourd’hui" onClose={onClose}>
      <label className="field">
        Activité
        <select className="input" value={activity} onChange={(e) => setActivity(e.target.value as ActivityKey)}>
          {ACTIVITIES.map((a) => <option key={a} value={a}>{ACTIVITY_LABEL[a]}{isAllowed(auth[a].status) ? '' : ' (non confirmée comme autorisée)'}</option>)}
        </select>
      </label>
      {!isAllowed(auth[activity].status) && <p className="small muted">Cette activité n’est pas indiquée comme autorisée par ton médecin ou ton kiné : elle est notée, et tu pourras en parler lors de ta prochaine évaluation.</p>}
      <div className="grid2">
        <label className="field">
          Terminée à
          <input className="input" type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
        </label>
        <NumberField label="Durée" suffix="min" value={duration} min={5} max={300} onChange={setDuration} />
      </div>
      <Seg label="Intensité" value={intensity} options={[{ value: 'très douce', label: 'Très douce' }, { value: 'douce', label: 'Douce' }, { value: 'modérée', label: 'Modérée' }]} onChange={setIntensity} />
      <Btn onClick={save} block>Noter la séance</Btn>
    </Sheet>
  );
}

/** Premier pas : dire, activité par activité, ce que ton médecin ou ton kiné a validé. */
export function AuthQuickSetup() {
  const auth = useData((d) => d.sport.authorizations);
  const set = async (a: ActivityKey, status: 'autorisé' | 'non autorisé') => {
    if (status === 'autorisé' && !(await confirmAsk({ title: `« ${ACTIVITY_LABEL[a]} » a été autorisé par ton médecin ou ton kiné ?`, confirm: 'Oui, c’est autorisé' }))) return;
    mutate((d) => { d.sport.authorizations[a] = { ...d.sport.authorizations[a], status, updatedOn: todayISO() }; });
  };
  return (
    <Card tint="warn">
      <h2>Commence ici : ce qui t’est autorisé</h2>
      <p className="small">Pour planifier tes séances (et avoir un repas de récupération après le cardio), indique ce que ton médecin ou ton kiné a validé. Pour des restrictions précises, utilise l’onglet « Autorisations ».</p>
      <div className="list">
        {ACTIVITIES.map((a) => (
          <div key={a} className="list-item" style={{ flexWrap: 'wrap' }}>
            <span className="grow strong">{ACTIVITY_LABEL[a]}</span>
            {isAllowed(auth[a].status) ? <span className="chip sage">autorisé</span> : auth[a].status === 'non autorisé' ? <span className="chip rose">pas pour l’instant</span> : (
              <>
                <Btn small variant="secondary" onClick={() => set(a, 'autorisé')}>Autorisé</Btn>
                <Btn small variant="ghost" onClick={() => set(a, 'non autorisé')}>Pas encore</Btn>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
