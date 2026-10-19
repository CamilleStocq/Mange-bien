import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WeightEntry } from '../store/types';
import { mutate, useData } from '../store/store';
import { addDays, formatDayMonth, formatShort, todayISO } from '../lib/dates';
import { habitWeeks, trendMessage, weightTrend } from '../lib/stats';
import { formatNumber } from '../lib/units';
import { randomId } from '../data/defaults';
import { Btn, Card, CardHead, Empty, Icon, NumberField, Seg, Sheet, TextField, confirmAsk, toast, SubmitBtn } from '../components/ui';

const axis = { fontSize: 11, fill: 'var(--text-2)' };
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 13, color: 'var(--text)' };

export function ProgressPage() {
  const [tab, setTab] = useState<'poids' | 'habitudes' | 'mesures'>('poids');
  return (
    <div className="page">
      <div className="topbar"><h1 className="grow">Ma progression</h1></div>
      <Seg label="Section" value={tab} onChange={setTab} options={[{ value: 'poids', label: 'Poids' }, { value: 'habitudes', label: 'Habitudes' }, { value: 'mesures', label: 'Mensurations' }]} />
      {tab === 'poids' && <Weight />}
      {tab === 'habitudes' && <Habits />}
      {tab === 'mesures' && <Measures />}
    </div>
  );
}

function Weight() {
  const data = useData((d) => d);
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const [kg, setKg] = useState<number | undefined>();
  const [date, setDate] = useState(todayISO());
  const points = useMemo(() => weightTrend(data.weights), [data.weights]);
  const { targetWeightKg: target, targetDate, startWeightKg } = data.profile;
  const chart = points.map((p) => ({ date: formatShort(p.date), Pesée: p.kg, Tendance: p.trend }));
  const values = points.flatMap((p) => [p.kg, p.trend]).concat(target);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const last = points[points.length - 1];
  return (
    <>
      <Card>
        <CardHead icon="scale" title="Ajouter une pesée" />
        <div className="grid2">
          <label className="field">Date<input className="input" type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
          <NumberField label="Poids" suffix="kg" value={kg} min={30} max={250} onChange={setKg} />
        </div>
        <SubmitBtn missing={!kg && 'Indique ton poids pour enregistrer la pesée.'} onClick={() => { mutate((d) => { d.weights.push({ id: randomId(), date, kg: kg! }); }); setKg(undefined); toast('Pesée enregistrée'); }}>Enregistrer la pesée</SubmitBtn>
        <p className="tiny muted">Idéalement une fois par semaine, le même jour, le matin, dans des conditions comparables. Tu peux aussi ne pas te peser : rien n’est bloqué.</p>
      </Card>

      <Card>
        <CardHead icon="chart" title="Évolution du poids" />
        {points.length >= 2 ? (
          <>
            <div className="chart-wrap" role="img" aria-label={`Graphique du poids : dernière pesée ${last ? formatNumber(last.kg) : ''} kg, tendance ${last ? formatNumber(last.trend) : ''} kg, objectif indicatif ${formatNumber(target)} kg.`}>
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ top: 16, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} minTickGap={16} />
                  <YAxis domain={[lo, hi]} tick={axis} tickLine={false} axisLine={false} unit=" kg" width={64} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${formatNumber(Number(v))} kg`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={target} stroke="var(--text-2)" strokeDasharray="5 4" label={{ value: `Repère indicatif ${formatNumber(target)} kg · ${formatDayMonth(targetDate)}`, position: 'insideBottomRight', fill: 'var(--text-2)', fontSize: 11 }} />
                  <Line type="monotone" dataKey="Pesée" stroke="var(--c2)" strokeWidth={0} dot={{ r: 4, fill: 'var(--c2)', stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Tendance" stroke="var(--c1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="tiny muted">Points : pesées. Ligne pleine : tendance lissée. Tirets : repère indicatif (pas une échéance, pas une prédiction).</p>
          </>
        ) : (
          <Empty icon="chart">La courbe apparaîtra après ta deuxième pesée.</Empty>
        )}
        <p className="small">{trendMessage(points)}</p>
        <div className="grid3">
          <div className="col" style={{ gap: 0 }}><span className="tiny muted">Départ</span><strong>{formatNumber(startWeightKg)} kg</strong></div>
          <div className="col" style={{ gap: 0 }}><span className="tiny muted">Tendance</span><strong>{last ? `${formatNumber(last.trend)} kg` : '—'}</strong></div>
          <div className="col" style={{ gap: 0 }}><span className="tiny muted">Repère</span><strong>{formatNumber(target)} kg</strong></div>
        </div>
        <p className="tiny muted">Le poids varie d’un jour à l’autre (eau, sel, cycle, digestion, entraînement) : ces écarts ne correspondent pas forcément à de la masse grasse. Ton énergie, ton sommeil et ta récupération comptent tout autant.</p>
      </Card>

      <Card>
        <CardHead icon="list" title="Historique des pesées" />
        <div className="list">
          {[...data.weights].sort((a, b) => b.date.localeCompare(a.date)).map((w) => (
            <div key={w.id} className="list-item">
              <span className="grow">{formatShort(w.date)}{w.note && <span className="tiny muted"> · {w.note}</span>}</span>
              <strong>{formatNumber(w.kg)} kg</strong>
              <button className="icon-btn plain" aria-label="Modifier la pesée" onClick={() => setEditing(w)}><Icon name="edit" size={18} /></button>
            </div>
          ))}
        </div>
      </Card>
      {editing && <WeightEditor w={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function WeightEditor({ w, onClose }: { w: WeightEntry; onClose: () => void }) {
  const [kg, setKg] = useState<number | undefined>(w.kg);
  const [date, setDate] = useState(w.date);
  const [note, setNote] = useState(w.note ?? '');
  return (
    <Sheet title="Modifier la pesée" onClose={onClose}>
      <label className="field">Date<input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
      <NumberField label="Poids" suffix="kg" value={kg} min={30} max={250} onChange={setKg} />
      <TextField label="Note" value={note} onChange={setNote} />
      <SubmitBtn missing={!kg && 'Indique un poids pour enregistrer la modification.'} onClick={() => { mutate((d) => { const x = d.weights.find((y) => y.id === w.id); if (x) Object.assign(x, { kg, date, note: note || undefined }); }); onClose(); }}>Enregistrer la modification</SubmitBtn>
      <Btn variant="danger" icon="trash" onClick={async () => { if (await confirmAsk({ title: `Supprimer la pesée du ${formatShort(w.date)} (${formatNumber(w.kg)} kg) ?`, confirm: 'Supprimer la pesée', danger: true })) { mutate((d) => { d.weights = d.weights.filter((x) => x.id !== w.id); }); onClose(); } }}>Supprimer la pesée</Btn>
    </Sheet>
  );
}

function SingleBars({ data, dataKey, unit, label }: { data: Record<string, string | number>[]; dataKey: string; unit: string; label: string }) {
  return (
    <div className="chart-wrap" style={{ height: 180 }} role="img" aria-label={label}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="sem" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => `${v}${unit}`} />
          <Bar dataKey={dataKey} fill="var(--c1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Habits() {
  const data = useData((d) => d);
  const today = todayISO();
  const weeks = useMemo(() => habitWeeks(data, today, 8), [data, today]);
  const rows = weeks.map((w) => ({
    sem: formatShort(w.monday).split(' ')[1],
    'Repas cochés': w.planned ? Math.round((w.done / w.planned) * 100) : 0,
    'Jours hydratés': w.hydrationDays,
    'Minutes de sport': w.sportMinutes
  }));
  const hydra = Array.from({ length: 14 }, (_, k) => addDays(today, k - 13)).map((d) => ({ sem: formatShort(d).split(' ')[1], Bu: (data.hydration.log[d] ?? []).reduce((s, x) => s + x.ml, 0) }));
  const anySport = weeks.some((w) => w.sportMinutes > 0);
  return (
    <>
      <Card tint="sage">
        <p className="small">Ces graphiques montrent tes habitudes, sans note ni score. Une semaine plus chargée ou différente fait partie de la vie.</p>
      </Card>
      <Card>
        <CardHead icon="food" title="Repas préparés ou mangés comme prévu" />
        <p className="tiny muted">Pourcentage des repas cochés « préparé » ou « mangé » par semaine (lundi indiqué).</p>
        <SingleBars data={rows} dataKey="Repas cochés" unit=" %" label="Pourcentage de repas cochés par semaine" />
      </Card>
      <Card>
        <CardHead icon="pot" title="Batch cooking" />
        <table className="simple">
          <thead><tr><th>Semaine</th><th className="right">Étapes cochées</th></tr></thead>
          <tbody>{weeks.map((w) => <tr key={w.monday}><td>{formatShort(w.monday)}</td><td className="right">{w.batchSteps ? `${w.batchDone} / ${w.batchSteps}` : '—'}</td></tr>)}</tbody>
        </table>
      </Card>
      <Card>
        <CardHead icon="drop" title="Hydratation — 14 derniers jours" />
        <div className="chart-wrap" style={{ height: 180 }} role="img" aria-label="Quantité bue par jour">
          <ResponsiveContainer>
            <BarChart data={hydra} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="sem" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => `${v} ml`} />
              <ReferenceLine y={data.hydration.goalMl} stroke="var(--text-2)" strokeDasharray="5 4" />
              <Bar dataKey="Bu" fill="var(--c1)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="tiny muted">Tirets : ton repère du jour ({data.hydration.goalMl} ml).</p>
      </Card>
      <Card>
        <CardHead icon="sport" title="Volume d’activité" />
        {anySport ? <SingleBars data={rows} dataKey="Minutes de sport" unit=" min" label="Minutes de sport réalisées par semaine" /> : <p className="small muted">Le volume d’entraînement apparaîtra ici quand des séances autorisées seront réalisées. En phase de récupération, c’est normal qu’il soit vide.</p>}
      </Card>
    </>
  );
}

function Measures() {
  const ms = useData((d) => d.measurements);
  const [draft, setDraft] = useState<{ waist?: number; hips?: number; thigh?: number; arm?: number }>({});
  return (
    <>
      <Card>
        <CardHead icon="scale" title="Mensurations (facultatif)" />
        <div className="grid2">
          <NumberField label="Taille" suffix="cm" value={draft.waist} min={30} max={200} onChange={(v) => setDraft({ ...draft, waist: v })} />
          <NumberField label="Hanches" suffix="cm" value={draft.hips} min={30} max={200} onChange={(v) => setDraft({ ...draft, hips: v })} />
          <NumberField label="Cuisse" suffix="cm" value={draft.thigh} min={20} max={120} onChange={(v) => setDraft({ ...draft, thigh: v })} />
          <NumberField label="Bras" suffix="cm" value={draft.arm} min={10} max={80} onChange={(v) => setDraft({ ...draft, arm: v })} />
        </div>
        <SubmitBtn missing={!Object.values(draft).some(Boolean) && 'Indique au moins une mesure pour l’enregistrer.'} onClick={() => { mutate((d) => { d.measurements.push({ id: randomId(), date: todayISO(), ...draft }); }); setDraft({}); toast('Mensurations enregistrées'); }}>Enregistrer les mensurations</SubmitBtn>
      </Card>
      {ms.length > 0 && (
        <Card>
          <table className="simple">
            <thead><tr><th>Date</th><th>Taille</th><th>Hanches</th><th>Cuisse</th><th>Bras</th><th /></tr></thead>
            <tbody>
              {[...ms].sort((a, b) => b.date.localeCompare(a.date)).map((m) => (
                <tr key={m.id}>
                  <td>{formatShort(m.date)}</td><td>{m.waist ?? '—'}</td><td>{m.hips ?? '—'}</td><td>{m.thigh ?? '—'}</td><td>{m.arm ?? '—'}</td>
                  <td><button className="icon-btn plain" aria-label={`Supprimer les mensurations du ${formatShort(m.date)}`} onClick={async () => (await confirmAsk({ title: `Supprimer les mensurations du ${formatShort(m.date)} ?`, confirm: 'Supprimer les mensurations', danger: true })) && mutate((d) => { d.measurements = d.measurements.filter((x) => x.id !== m.id); })}><Icon name="trash" size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
