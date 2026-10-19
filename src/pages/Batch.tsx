import { useMemo, useState } from 'react';
import { ensureWeek, mutate, useData } from '../store/store';
import { addDays, formatHHMM, formatLong, formatShort, todayISO, weekStart } from '../lib/dates';
import { buildBatchPlan, SAFETY_RULES, slotWhen } from '../lib/batch';
import { SLOT_LABEL } from '../lib/planning';
import { formatQty, STATE_LABEL } from '../lib/units';
import type { Route } from '../lib/router';
import { randomId } from '../data/defaults';
import { Btn, Card, CardHead, Check, Empty, Icon, Progress, Stepper, toast } from '../components/ui';

function durationLabel(min: number) {
  const r = Math.round(min / 15) * 15;
  const h = Math.floor(r / 60);
  return h ? `${h} h${r % 60 ? ` ${String(r % 60).padStart(2, '0')}` : ''}` : `${r} min`;
}

export function BatchPage({ route }: { route: Route }) {
  const data = useData((d) => d);
  const [monday, setMonday] = useState(route.query.get('w') || addDays(weekStart(todayISO()), 7));
  const plan = useMemo(() => buildBatchPlan(data, monday), [data, monday]);
  const meta = data.weeks[monday];
  const checks = meta?.batchChecks ?? {};
  const done = plan.steps.filter((s) => checks[s.id]).length;
  const toggle = (id: string, v: boolean) =>
    mutate((d) => {
      const w = ensureWeek(d, monday);
      w.batchChecks[id] = v;
      // Plat portionné → repas de la semaine marqués « préparé »
      if (id.startsWith('portion:') && v) {
        const rid = id.slice(8);
        for (const m of d.meals) if (m.recipeId === rid && m.source === 'batch' && m.status === 'prévu' && m.date >= monday && m.date <= addDays(monday, 6)) m.status = 'préparé';
      }
    });
  const finish = () => {
    mutate((d) => {
      const w = ensureWeek(d, monday);
      if (w.batchDone) return;
      w.batchDone = true;
      for (const c of plan.cookFull) if (c.extra > 0) d.freezer.push({ id: randomId(), recipeId: c.recipe.id, name: c.recipe.name, portions: c.extra, frozenOn: plan.batchDay });
    });
    toast('Bravo pour ta préparation 🌿');
  };

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={() => history.back()} aria-label="Retour"><Icon name="back" /></button>
        <div className="grow">
          <h1 style={{ fontSize: '1.3rem' }}>Mon batch cooking du dimanche</h1>
          <div className="sub cap">{formatLong(plan.batchDay)} · pour la semaine du {formatShort(monday)}</div>
        </div>
      </div>
      <div className="row between">
        <Btn small variant="ghost" icon="left" onClick={() => setMonday(addDays(monday, -7))}>Précédent</Btn>
        <Btn small variant="ghost" onClick={() => setMonday(addDays(monday, 7))}>Suivant<Icon name="right" size={18} /></Btn>
      </div>

      {plan.empty ? (
        <Card>
          <Empty icon="pot">
            <p>Aucun repas « batch » prévu pour cette semaine.</p>
            <a className="btn secondary" href={`#/alimentation?w=${monday}`}>Voir le planning de la semaine</a>
          </Empty>
        </Card>
      ) : (
        <>
          <Card tint="sage">
            <div className="grid3">
              <div className="col" style={{ gap: 0 }}><span className="tiny muted">Durée estimée</span><strong>≈ {durationLabel(plan.durationMin)}</strong></div>
              <div className="col" style={{ gap: 0 }}><span className="tiny muted">Au frigo</span><strong>{plan.fridgeCount} portion(s)</strong></div>
              <div className="col" style={{ gap: 0 }}><span className="tiny muted">Au congélateur</span><strong>{plan.freezerCount} portion(s)</strong></div>
            </div>
            <Progress value={done} max={plan.steps.length} />
            <span className="small">{done} / {plan.steps.length} étapes faites · début conseillé {formatHHMM(data.batchStart)}</span>
          </Card>

          <Card>
            <CardHead icon="pot" title="1. Plats à cuire entièrement" />
            {plan.cookFull.map((c) => (
              <div key={c.recipe.id} className="col" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                <div className="row between">
                  <a className="strong" href={`#/recette/${c.recipe.id}`}>{c.recipe.name}</a>
                  <span className="chip sage">{c.total} portion{c.total > 1 ? 's' : ''}</span>
                </div>
                <div className="small muted">
                  {c.planned} prévue(s) au planning{c.extra ? ` + ${c.extra} en plus pour le congélateur` : ''} · recette de base {c.recipe.servings} portions (× {String(Math.round((c.total / c.recipe.servings) * 100) / 100).replace('.', ',')})
                </div>
                <div className="row between small">
                  <span>Portions en plus à congeler</span>
                  <Stepper label={`Portions supplémentaires de ${c.recipe.name}`} value={c.extra} min={0} max={8} onChange={(v) => mutate((d) => { const w = ensureWeek(d, monday); w.extraPortions = { ...(w.extraPortions ?? {}), [c.recipe.id]: v }; })} />
                </div>
                {c.fridge.length > 0 && <div className="small"><Icon name="fridge" size={16} /> Frigo : {c.fridge.map(slotWhen).join(' · ')}</div>}
                {c.freezer.length > 0 && <div className="small"><Icon name="snow" size={16} /> Congélateur : {c.freezer.map(slotWhen).join(' · ')}</div>}
              </div>
            ))}
            {!plan.cookFull.length && <p className="small muted">Aucun plat à cuire entièrement.</p>}
          </Card>

          <Card>
            <CardHead icon="list" title="2. Quantités totales à utiliser" />
            <p className="tiny muted">Additionnées pour toutes les portions ci-dessus, sans double comptage.</p>
            <table className="simple">
              <tbody>
                {plan.totals.map((t) => (
                  <tr key={t.key}>
                    <td>{t.name}<div className="tiny muted">{t.usedIn.join(', ')}</div></td>
                    <td className="right nowrap"><strong>{formatQty(t.qty, t.unit, data.liquidDisplay)}</strong>{t.states.length > 0 && <div className="tiny muted">{t.states.map((s) => STATE_LABEL[s]).join(' / ')}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {plan.accompaniments.length > 0 && (
            <Card>
              <CardHead icon="food" title="3. Accompagnements" />
              {plan.accompaniments.map((a) => (
                <div key={a.key} className="col" style={{ gap: 2 }}>
                  <div className="row between"><span className="strong">{a.name}</span><span>{formatQty(a.qty, a.unit, data.liquidDisplay)}{a.states[0] ? ` (${STATE_LABEL[a.states[0]]})` : ''}</span></div>
                  <span className="small muted">{a.tip}</span>
                </div>
              ))}
            </Card>
          )}

          {(plan.prepOnly.length > 0 || plan.freshPrep.length > 0) && (
            <Card>
              <CardHead icon="leaf" title="4. À laver, couper ou préportionner seulement" />
              {plan.prepOnly.map((p) => <p key={p.recipe.id} className="small"><strong>{p.recipe.name}</strong> — {p.meals.map(slotWhen).join(', ')}</p>)}
              {plan.freshPrep.map((f) => <p key={f.id} className="small">{f.text}</p>)}
            </Card>
          )}

          <Card tint="sky">
            <CardHead icon="snow" title="5. À sortir du congélateur" />
            {plan.defrost.length ? (
              <div className="list">
                {plan.defrost.map((t) => (
                  <div key={t.id} className="list-item">
                    <Icon name="snow" size={18} />
                    <div className="grow small"><strong>{formatShort(t.on)} soir</strong> → frigo : {t.label}<div className="tiny muted">pour le {SLOT_LABEL[t.slot].toLowerCase()} du {formatShort(t.mealDate)}</div></div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="small muted">Rien à décongeler cette semaine.</p>
            )}
            <p className="tiny muted">Un rappel te sera envoyé la veille au soir si les notifications sont activées.</p>
          </Card>

          <Card>
            <CardHead icon="check" title="6. Ordre conseillé — checklist" />
            <div className="list">
              {plan.steps.map((s, k) => (
                <div key={s.id} className={`list-item ${checks[s.id] ? 'done' : ''}`} style={{ alignItems: 'flex-start' }}>
                  <Check checked={!!checks[s.id]} onChange={(v) => toggle(s.id, v)} label={s.title} />
                  <div className="grow li-text">
                    <div className="strong small">{k + 1}. {s.title}</div>
                    {s.detail && <div className="small muted">{s.detail}</div>}
                  </div>
                  <span className="tiny muted nowrap">{s.minutes} min</span>
                </div>
              ))}
            </div>
            {done === plan.steps.length && !meta?.batchDone && <Btn onClick={finish}>Terminer le batch{plan.cookFull.some((c) => c.extra) ? ' et ajouter les portions au congélateur' : ''}</Btn>}
            {meta?.batchDone && <p className="small strong" style={{ color: 'var(--sage-strong)' }}>Batch terminé 🌿</p>}
          </Card>

          <Card tint="peach">
            <CardHead icon="info" title="Règles de conservation" />
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{SAFETY_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
          </Card>
          <a className="btn secondary" href={`#/courses?w=${monday}`}><Icon name="cart" />Liste de courses de cette semaine</a>
        </>
      )}
    </div>
  );
}
