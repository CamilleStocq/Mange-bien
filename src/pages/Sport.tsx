import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ActivityKey, AuthStatus, PainEntry, ResumeStage, SportSession } from '../store/types';
import { mutate, useData } from '../store/store';
import { addDays, formatDayMonth, formatHHMM, formatLong, formatShort, todayISO, weekDays, weekStart, weekdayIndex } from '../lib/dates';
import { ACTIVITY_LABEL } from '../lib/reminders';
import type { Route } from '../lib/router';
import { randomId } from '../data/defaults';
import { Btn, Card, CardHead, Empty, Icon, NumberField, Seg, TextField, confirmAsk, toast } from '../components/ui';
import { ACTIVITIES, isAllowed, RED_FLAGS, SessionCard, SessionEditor, UrgentAlert } from '../components/sport';

type Tab = 'planning' | 'autorisations' | 'douleurs' | 'notes' | 'reprise';

export function SportPage({ route }: { route: Route }) {
  const [tab, setTab] = useState<Tab>((route.query.get('tab') as Tab) || 'planning');
  const sport = useData((d) => d.sport);
  return (
    <div className="page">
      <div className="topbar"><h1 className="grow">Mon sport</h1></div>
      <Card tint={sport.phase === 'recuperation' ? 'rose' : 'sage'}>
        <CardHead icon={sport.phase === 'recuperation' ? 'heart' : 'sport'} title={sport.phase === 'recuperation' ? 'Phase actuelle : récupération' : 'Phase actuelle : reprise progressive'} />
        {sport.phase === 'recuperation' ? (
          <p className="small">
            Aucune séance n’est programmée automatiquement. Seules les activités que ton médecin ou ton kiné a autorisées peuvent être planifiées, à ton initiative.
            Remplacer une séance par du repos est toujours une bonne option.
          </p>
        ) : (
          <p className="small">
            Reprise validée {sport.resumeValidatedOn ? `le ${formatDayMonth(sport.resumeValidatedOn)}` : ''}{sport.resumeValidatedBy ? ` par ${sport.resumeValidatedBy}` : ''}. Étape actuelle : <strong>{sport.stages[sport.currentStage]?.title}</strong>. La charge n’augmente jamais automatiquement.
          </p>
        )}
        {sport.nextEvaluation && <p className="small"><Icon name="calendar" size={16} /> Prochaine évaluation : <strong>{formatLong(sport.nextEvaluation)}</strong></p>}
        <a className="small" href="#/sport?tab=douleurs" onClick={() => setTab('douleurs')} style={{ color: 'var(--danger)', fontWeight: 600 }}>Symptômes d’alerte : que faire ?</a>
      </Card>
      <Seg label="Section" value={tab} onChange={setTab} options={[{ value: 'planning', label: 'Planning' }, { value: 'autorisations', label: 'Autorisations' }, { value: 'douleurs', label: 'Douleurs' }, { value: 'notes', label: 'Consignes' }, { value: 'reprise', label: 'Reprise' }]} />
      {tab === 'planning' && <SportPlanning />}
      {tab === 'autorisations' && <Authorizations />}
      {tab === 'douleurs' && <Pain />}
      {tab === 'notes' && <Notes />}
      {tab === 'reprise' && <Resume />}
    </div>
  );
}

function SportPlanning() {
  const data = useData((d) => d);
  const [monday, setMonday] = useState(weekStart(todayISO()));
  const [adding, setAdding] = useState<string | null>(null);
  const sessions = data.sport.sessions.filter((s) => s.date >= monday && s.date <= addDays(monday, 6));
  const planned = sessions.filter((s) => s.status === 'prévue').reduce((a, s) => a + s.durationMin, 0);
  const done = sessions.filter((s) => s.status === 'faite').reduce((a, s) => a + s.durationMin, 0);
  const stage = data.sport.phase === 'reprise' ? data.sport.stages[data.sport.currentStage] : undefined;
  const allowed = ACTIVITIES.filter((a) => isAllowed(data.sport.authorizations[a].status));

  const propose = () => {
    if (!stage || !allowed.length) return;
    // Créneaux doux répartis, avec au moins un jour de repos entre deux séances quand c'est possible.
    const slots: [number, string][] = [[6, '10:00'], [3, '18:00'], [5, '10:00'], [0, '18:30']];
    const created: SportSession[] = slots.slice(0, stage.sessionsPerWeek).map(([day, time], k) => ({
      id: randomId(), date: addDays(monday, day), time, activity: allowed[k % allowed.length], durationMin: stage.maxMinutes, intensity: stage.intensity, status: 'prévue', notes: 'Proposition à valider avec ton kiné. Arrête si douleur.'
    }));
    mutate((d) => { d.sport.sessions.push(...created); });
    toast(`${created.length} séance(s) proposée(s) — modifiables`);
  };

  return (
    <>
      <div className="row between">
        <button className="icon-btn" aria-label="Semaine précédente" onClick={() => setMonday(addDays(monday, -7))}><Icon name="left" /></button>
        <strong>Semaine du {formatDayMonth(monday)}</strong>
        <button className="icon-btn" aria-label="Semaine suivante" onClick={() => setMonday(addDays(monday, 7))}><Icon name="right" /></button>
      </div>
      <Card>
        <div className="grid2">
          <div className="col" style={{ gap: 0 }}><span className="tiny muted">Réalisé</span><strong>{done} min</strong></div>
          <div className="col" style={{ gap: 0 }}><span className="tiny muted">Encore prévu</span><strong>{planned} min</strong></div>
        </div>
        {stage && <p className="tiny muted">Repère de l’étape : {stage.sessionsPerWeek} séances de {stage.maxMinutes} min max, intensité {stage.intensity}.</p>}
        <div className="row wrap">
          <Btn small icon="plus" onClick={() => setAdding(todayISO() >= monday && todayISO() <= addDays(monday, 6) ? todayISO() : monday)}>Planifier une séance</Btn>
          {stage && allowed.length > 0 && sessions.length === 0 && <Btn small variant="secondary" onClick={propose}>Proposer une semaine douce</Btn>}
        </div>
        {!allowed.length && <p className="small muted">Aucune activité n’est indiquée comme autorisée : renseigne-les dans l’onglet « Autorisations » après avis de ton médecin ou kiné.</p>}
      </Card>
      {weekDays(monday).map((d) => {
        const ds = sessions.filter((s) => s.date === d);
        const coach = data.schedule[weekdayIndex(d)].coaching;
        if (!ds.length && !coach) return null;
        return (
          <Card key={d}>
            <h2 className="cap">{formatLong(d).replace(/ \d{4}$/, '')}</h2>
            {coach && <div className="ev coach"><span className="ev-time">{formatHHMM(coach.start)}</span>Coaching d’athlétisme — engagement professionnel (pas ta séance)</div>}
            {ds.map((s) => <SessionCard key={s.id} s={s} />)}
          </Card>
        );
      })}
      {adding && <SessionEditor date={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

const AUTH_OPTIONS: { value: AuthStatus; label: string }[] = [
  { value: 'inconnu', label: 'Non renseigné' },
  { value: 'autorisé', label: 'Autorisé' },
  { value: 'restreint', label: 'Autorisé avec restrictions' },
  { value: 'non autorisé', label: 'Non autorisé' }
];

function Authorizations() {
  const sport = useData((d) => d.sport);
  const setAuth = (a: ActivityKey, status: AuthStatus) => {
    if ((status === 'autorisé' || status === 'restreint') && !confirmAsk(`Confirmes-tu que « ${ACTIVITY_LABEL[a]} » a été autorisé(e) par ton médecin ou ton kiné ?`)) return;
    mutate((d) => { d.sport.authorizations[a] = { ...d.sport.authorizations[a], status, updatedOn: todayISO() }; });
  };
  return (
    <>
      <Card>
        <p className="small">Indique uniquement ce qui a été validé par ton médecin ou ton kiné. L’application ne juge pas si une activité est sûre pour toi : elle suit tes indications.</p>
        {ACTIVITIES.map((a) => {
          const au = sport.authorizations[a];
          return (
            <div key={a} className="col" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
              <div className="row between">
                <strong>{ACTIVITY_LABEL[a]}</strong>
                <select className="input sm" style={{ width: 'auto' }} value={au.status} onChange={(e) => setAuth(a, e.target.value as AuthStatus)} aria-label={`Statut ${ACTIVITY_LABEL[a]}`}>
                  {AUTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <input className="input sm" placeholder="Consigne (ex. 15 min, sans battement de jambes)" value={au.note} onChange={(e) => mutate((d) => { d.sport.authorizations[a].note = e.target.value; })} />
              {au.updatedOn && <span className="tiny muted">Mis à jour le {formatShort(au.updatedOn)}</span>}
            </div>
          );
        })}
      </Card>
      <Card>
        <label className="field">Prochaine évaluation médicale / kiné<input className="input" type="date" value={sport.nextEvaluation ?? ''} onChange={(e) => mutate((d) => { d.sport.nextEvaluation = e.target.value || undefined; })} /></label>
        <TextField label="Restrictions temporaires" value={sport.restrictions} onChange={(v) => mutate((d) => { d.sport.restrictions = v; })} multiline placeholder="ex. pas de flexion avant chargée, pas de course…" />
      </Card>
    </>
  );
}

const ZONES = ['Psoas', 'Bas du dos', 'Jambe droite', 'Jambe gauche', 'Fesse / sciatique', 'Autre'];

function Pain() {
  const pain = useData((d) => d.sport.pain);
  const [draft, setDraft] = useState<PainEntry>({ id: randomId(), date: todayISO(), zone: 'Bas du dos', intensity: 3, notes: '', redFlags: [] });
  const [showAlert, setShowAlert] = useState(false);
  const chart = useMemo(() => [...pain].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ date: formatShort(p.date), intensité: p.intensity })), [pain]);
  const save = () => {
    mutate((d) => { d.sport.pain.push(draft); });
    if (draft.redFlags.length) setShowAlert(true);
    toast('Noté, merci');
    setDraft({ id: randomId(), date: todayISO(), zone: draft.zone, intensity: draft.intensity, notes: '', redFlags: [] });
  };
  return (
    <>
      {(showAlert || draft.redFlags.length > 0) && <UrgentAlert />}
      <Card>
        <CardHead icon="heart" title="Noter mes sensations" />
        <div className="grid2">
          <label className="field">Date<input className="input" type="date" value={draft.date} onChange={(e) => e.target.value && setDraft({ ...draft, date: e.target.value })} /></label>
          <label className="field">Zone<select className="input" value={draft.zone} onChange={(e) => setDraft({ ...draft, zone: e.target.value })}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select></label>
        </div>
        <label className="field">
          Intensité : <strong>{draft.intensity} / 10</strong>
          <input type="range" min={0} max={10} value={draft.intensity} onChange={(e) => setDraft({ ...draft, intensity: Number(e.target.value) })} />
        </label>
        <TextField label="Notes (moment, activité, ce qui soulage…)" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} multiline />
        <div className="col">
          <span className="small strong" style={{ color: 'var(--danger)' }}>Symptômes d’alerte — coche s’il y en a :</span>
          {RED_FLAGS.map((f) => (
            <label key={f} className="row small" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={draft.redFlags.includes(f)} onChange={(e) => setDraft({ ...draft, redFlags: e.target.checked ? [...draft.redFlags, f] : draft.redFlags.filter((x) => x !== f) })} />
              {f}
            </label>
          ))}
        </div>
        <Btn onClick={save}>Enregistrer</Btn>
        <p className="tiny muted">Une douleur qui diminue est une bonne nouvelle, mais elle ne suffit pas à valider une reprise : c’est à voir avec ton professionnel de santé.</p>
      </Card>
      {chart.length > 1 && (
        <Card>
          <CardHead icon="chart" title="Évolution" />
          <div className="chart-wrap">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
                <Tooltip />
                <Line type="monotone" dataKey="intensité" stroke="var(--c2)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Card>
        <CardHead icon="list" title="Historique" />
        {pain.length ? (
          <div className="list">
            {[...pain].sort((a, b) => b.date.localeCompare(a.date)).map((p) => (
              <div key={p.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="small"><strong>{formatShort(p.date)}</strong> · {p.zone} · {p.intensity}/10</div>
                  {p.notes && <div className="small muted">{p.notes}</div>}
                  {p.redFlags.length > 0 && <div className="tiny" style={{ color: 'var(--danger)' }}>Alerte : {p.redFlags.join(' ; ')}</div>}
                </div>
                <button className="icon-btn plain" aria-label="Supprimer" onClick={() => confirmAsk('Supprimer cette entrée ?') && mutate((d) => { d.sport.pain = d.sport.pain.filter((x) => x.id !== p.id); })}><Icon name="trash" size={18} /></button>
              </div>
            ))}
          </div>
        ) : <Empty icon="heart">Aucune entrée pour l’instant.</Empty>}
      </Card>
    </>
  );
}

function Notes() {
  const notes = useData((d) => d.sport.notes);
  const [author, setAuthor] = useState('Kiné');
  const [text, setText] = useState('');
  return (
    <>
      <Card>
        <CardHead icon="book" title="Ajouter une consigne" />
        <Seg label="Auteur" value={author} options={[{ value: 'Kiné', label: 'Kiné' }, { value: 'Médecin', label: 'Médecin' }, { value: 'Moi', label: 'Moi' }]} onChange={setAuthor} />
        <TextField label="Consigne ou remarque" value={text} onChange={setText} multiline />
        <Btn disabled={!text.trim()} onClick={() => { mutate((d) => { d.sport.notes.unshift({ id: randomId(), date: todayISO(), author, text: text.trim() }); }); setText(''); }}>Enregistrer</Btn>
      </Card>
      {notes.map((n) => (
        <Card key={n.id}>
          <div className="row between"><span className="chip rose">{n.author}</span><span className="tiny muted">{formatShort(n.date)}</span></div>
          <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{n.text}</p>
          <Btn small variant="ghost" icon="trash" onClick={() => confirmAsk('Supprimer cette note ?') && mutate((d) => { d.sport.notes = d.sport.notes.filter((x) => x.id !== n.id); })}>Supprimer</Btn>
        </Card>
      ))}
    </>
  );
}

function Resume() {
  const sport = useData((d) => d.sport);
  const [confirmed, setConfirmed] = useState(false);
  const [by, setBy] = useState('');
  const setStage = (k: number, p: Partial<ResumeStage>) => mutate((d) => { Object.assign(d.sport.stages[k], p); });
  return (
    <>
      {sport.phase === 'recuperation' ? (
        <Card>
          <CardHead icon="sport" title="Passer en reprise progressive" />
          <p className="small">À faire uniquement quand ton médecin ou ton kiné a validé la reprise. Une simple diminution de la douleur ne suffit pas.</p>
          <label className="row small"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Ma reprise a été validée par mon professionnel de santé.</label>
          <TextField label="Validée par" value={by} onChange={setBy} placeholder="ex. mon kiné" />
          <Btn disabled={!confirmed} onClick={() => { mutate((d) => { d.sport.phase = 'reprise'; d.sport.resumeValidatedOn = todayISO(); d.sport.resumeValidatedBy = by.trim() || undefined; d.sport.currentStage = 0; }); toast('Reprise enregistrée : étape 1'); }}>Confirmer la reprise</Btn>
        </Card>
      ) : (
        <Card>
          <CardHead icon="sport" title="Étape actuelle" />
          <p><strong>{sport.stages[sport.currentStage]?.title}</strong></p>
          <div className="row wrap">
            {sport.currentStage < sport.stages.length - 1 && (
              <Btn small onClick={() => confirmAsk('Passer à l’étape suivante ? À faire seulement après validation avec ton kiné, jamais uniquement parce que des séances ont été cochées.') && mutate((d) => { d.sport.currentStage++; })}>Étape suivante (validée)</Btn>
            )}
            {sport.currentStage > 0 && <Btn small variant="secondary" onClick={() => mutate((d) => { d.sport.currentStage--; })}>Revenir à l’étape précédente</Btn>}
            <Btn small variant="ghost" onClick={() => confirmAsk('Revenir en phase de récupération ? C’est une décision tout à fait normale.') && mutate((d) => { d.sport.phase = 'recuperation'; })}>Revenir en récupération</Btn>
          </div>
        </Card>
      )}
      <Card>
        <CardHead icon="list" title="Étapes de reprise (modifiables)" />
        <p className="small muted">Adapte le nombre de séances, la durée et l’intensité selon les recommandations reçues.</p>
        {sport.stages.map((s, k) => (
          <div key={s.id} className="col" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
            <input className="input" value={s.title} onChange={(e) => setStage(k, { title: e.target.value })} aria-label="Titre de l’étape" />
            <div className="grid2">
              <NumberField label="Séances / semaine" value={s.sessionsPerWeek} min={0} max={7} onChange={(v) => setStage(k, { sessionsPerWeek: v ?? 0 })} />
              <NumberField label="Durée max" suffix="min" value={s.maxMinutes} min={5} max={240} onChange={(v) => setStage(k, { maxMinutes: v ?? 20 })} />
            </div>
            <Seg label="Intensité" value={s.intensity} options={[{ value: 'très douce', label: 'Très douce' }, { value: 'douce', label: 'Douce' }, { value: 'modérée', label: 'Modérée' }]} onChange={(v) => setStage(k, { intensity: v })} />
            <input className="input sm" value={s.notes} onChange={(e) => setStage(k, { notes: e.target.value })} aria-label="Notes de l’étape" />
          </div>
        ))}
        <Btn small variant="secondary" icon="plus" onClick={() => mutate((d) => { d.sport.stages.push({ id: randomId(), title: `Étape ${d.sport.stages.length + 1}`, sessionsPerWeek: 3, maxMinutes: 30, intensity: 'douce', notes: '' }); })}>Ajouter une étape</Btn>
      </Card>
    </>
  );
}
