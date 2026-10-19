import { useMemo, useState } from 'react';
import type { Aisle } from '../store/types';
import { ensureWeek, mutate, useData } from '../store/store';
import { addDays, formatDayMonth, formatShort, todayISO, weekStart } from '../lib/dates';
import { budgetSuggestions, buildShoppingList } from '../lib/shopping';
import { AISLE_LABEL, AISLE_ORDER, formatEuro, formatQty, STATE_LABEL, ingredientKey } from '../lib/units';
import type { Route } from '../lib/router';
import { randomId } from '../data/defaults';
import { Btn, Card, CardHead, Check, Empty, Icon, NumberField, Progress, Toggle, toast, SubmitBtn } from '../components/ui';

export function ShoppingPage({ route }: { route: Route }) {
  const data = useData((d) => d);
  const [monday, setMonday] = useState(route.query.get('w') || addDays(weekStart(todayISO()), 7));
  const [pricing, setPricing] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [aisle, setAisle] = useState<Aisle>('autres');
  const list = useMemo(() => buildShoppingList(data, monday), [data, monday]);
  const suggestions = useMemo(() => budgetSuggestions(data, list), [data, list]);
  const toBuy = list.items.filter((i) => i.needed > 0);
  const inStock = list.items.filter((i) => i.needed <= 0);
  const checkedCount = toBuy.filter((i) => i.checked).length + list.manual.filter((m) => data.weeks[monday]?.shoppingChecks[m.id]).length;
  const over = list.estimated > list.budget;
  const real = list.realTotal ?? (list.realSum || undefined);

  const setCheck = (key: string, v: boolean) => mutate((d) => { ensureWeek(d, monday).shoppingChecks[key] = v; });

  const applySwap = (from: string, to: string) => {
    mutate((d) => {
      for (const m of d.meals) if (m.recipeId === from && m.date >= monday && m.date <= addDays(monday, 6) && m.status === 'prévu') {
        m.recipeId = to;
        m.note = `Remplace : ${d.recipes.find((r) => r.id === from)?.name ?? ''} (budget)`;
      }
    });
    toast('Remplacement appliqué : liste et batch recalculés');
  };

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={() => history.back()} aria-label="Retour"><Icon name="back" /></button>
        <div className="grow">
          <h1>Mes courses</h1>
          <div className="sub">Semaine du {formatDayMonth(monday)} au {formatDayMonth(addDays(monday, 6))}</div>
        </div>
      </div>
      <div className="row between">
        <Btn small variant="ghost" icon="left" onClick={() => setMonday(addDays(monday, -7))}>Précédente</Btn>
        <Btn small variant="ghost" onClick={() => setMonday(addDays(monday, 7))}>Suivante<Icon name="right" size={18} /></Btn>
      </div>

      <Card tint={over ? 'warn' : 'sage'}>
        <div className="row between">
          <span>Estimation</span>
          <strong>{formatEuro(list.estimated)} / {formatEuro(list.budget)}</strong>
        </div>
        <Progress value={list.estimated} max={list.budget} tone={over ? 'over' : undefined} />
        <p className="tiny muted">
          Prix indicatifs saisis dans l’application (pas des prix de marché vérifiés), proportionnels aux quantités utilisées.
          {list.missingPrices > 0 && ` ${list.missingPrices} article(s) sans prix.`} <a href="#/reglages/ingredients">Modifier les prix</a>
        </p>
        {real != null && (
          <div className="row between"><span>Dépense réelle</span><strong>{formatEuro(real)}</strong></div>
        )}
      </Card>

      {suggestions.length > 0 && (
        <Card tint="peach">
          <CardHead icon="euro" title="Pistes pour rester dans le budget" />
          {suggestions.map((s, k) => (
            <div key={k} className="col" style={{ gap: 4 }}>
              <p className="small">{s.text}{s.saving ? ` Économie estimée : ${formatEuro(s.saving)}.` : ''}</p>
              {s.kind === 'swap' && s.from && s.to && <Btn small variant="secondary" onClick={() => applySwap(s.from!, s.to!)}>Appliquer ce remplacement</Btn>}
            </div>
          ))}
        </Card>
      )}

      {toBuy.length + list.manual.length === 0 ? (
        <Card><Empty icon="cart"><p>Rien à acheter pour cette semaine.</p><a className="btn secondary" href={`#/alimentation?w=${monday}`}>Voir le planning</a></Empty></Card>
      ) : (
        <>
          <div className="row between">
            <span className="small strong">{checkedCount} / {toBuy.length + list.manual.length} dans le panier</span>
            <div className="row small">Masquer les cochés <Toggle label="Masquer les articles cochés" checked={hideChecked} onChange={setHideChecked} /></div>
          </div>
          <div className="row between">
            <span className="small">Saisir les prix réels</span>
            <Toggle label="Saisir les prix réels" checked={pricing} onChange={setPricing} />
          </div>
          {AISLE_ORDER.map((a) => {
            const items = toBuy.filter((i) => i.aisle === a && !(hideChecked && i.checked));
            const manual = list.manual.filter((m) => m.aisle === a && !(hideChecked && data.weeks[monday]?.shoppingChecks[m.id]));
            if (!items.length && !manual.length) return null;
            return (
              <Card key={a}>
                <h2>{AISLE_LABEL[a]}</h2>
                <div className="list">
                  {items.map((i) => (
                    <div key={i.key} className={`list-item ${i.checked ? 'done' : ''}`} style={{ flexWrap: 'wrap' }}>
                      <Check checked={i.checked} onChange={(v) => setCheck(i.key, v)} label={i.name} />
                      <div className="grow li-text" style={{ minWidth: 120 }}>
                        <div><strong>{formatQty(i.buy, i.unit, data.liquidDisplay)}</strong> {i.name}</div>
                        <div className="tiny muted">
                          {i.states.length > 0 && `${i.states.map((s) => STATE_LABEL[s]).join(' / ')} · `}
                          {typeof i.owned === 'number' && i.owned > 0 && `déjà ${formatQty(i.owned, i.unit)} en stock · `}
                          {i.usedIn.join(', ')}
                        </div>
                      </div>
                      {pricing ? (
                        <div style={{ width: 110 }}>
                          <NumberField value={i.realPrice} min={0} suffix="€" placeholder={i.estCost != null ? i.estCost.toFixed(2) : ''} onChange={(v) => mutate((d) => { const w = ensureWeek(d, monday); if (v == null) delete w.realPrices[i.key]; else w.realPrices[i.key] = v; })} />
                        </div>
                      ) : (
                        <span className="small muted nowrap">{i.estCost != null ? `≈ ${formatEuro(i.estCost)}` : '—'}</span>
                      )}
                    </div>
                  ))}
                  {manual.map((m) => (
                    <div key={m.id} className={`list-item ${data.weeks[monday]?.shoppingChecks[m.id] ? 'done' : ''}`}>
                      <Check checked={!!data.weeks[monday]?.shoppingChecks[m.id]} onChange={(v) => setCheck(m.id, v)} label={m.name} />
                      <div className="grow li-text">{m.qty && <strong>{m.qty} </strong>}{m.name} <span className="chip">ajouté</span></div>
                      <button className="icon-btn plain" aria-label={`Retirer ${m.name}`} onClick={() => mutate((d) => { const w = ensureWeek(d, monday); w.manualItems = w.manualItems.filter((x) => x.id !== m.id); })}><Icon name="trash" size={18} /></button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </>
      )}

      <Card>
        <CardHead icon="plus" title="Ajouter un article" />
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow">Article<input className="input" placeholder="ex. liquide vaisselle" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field" style={{ width: 96 }}>Quantité<input className="input" placeholder="ex. 2" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        </div>
        <label className="field">Rayon
          <select className="input" value={aisle} onChange={(e) => setAisle(e.target.value as Aisle)}>
            {AISLE_ORDER.map((a) => <option key={a} value={a}>{AISLE_LABEL[a]}</option>)}
          </select>
        </label>
        <SubmitBtn variant="secondary" missing={!name.trim() && 'Écris le nom de l’article à ajouter.'} onClick={() => { mutate((d) => { ensureWeek(d, monday).manualItems.push({ id: `manual:${randomId()}`, name: name.trim(), qty: qty.trim(), aisle }); }); setName(''); setQty(''); }}>Ajouter l’article</SubmitBtn>
      </Card>

      {inStock.length > 0 && (
        <Card>
          <CardHead icon="fridge" title="Déjà en stock (non acheté)" />
          <p className="small muted">{inStock.map((i) => `${i.name} (${formatQty(i.qty, i.unit)})`).join(', ')}</p>
          <a className="small" href="#/alimentation?tab=stock">Gérer mon stock</a>
        </Card>
      )}

      <Card>
        <CardHead icon="euro" title="Après les courses" />
        <NumberField label="Total du ticket de caisse (facultatif)" suffix="€" value={list.realTotal} min={0} onChange={(v) => mutate((d) => { ensureWeek(d, monday).realTotal = v; })} />
        {list.realSum > 0 && <p className="small muted">Somme des prix saisis article par article : {formatEuro(list.realSum)}</p>}
        <Btn small variant="ghost" onClick={() => { mutate((d) => { for (const i of list.items) { const real = d.weeks[monday]?.realPrices[i.key]; const k = ingredientKey(i.name); const info = d.ingredients[k]; if (real != null && info && i.buy > 0) info.price = Math.round((i.unit === 'pièce' ? real / i.buy : (real / i.buy) * 1000) * 100) / 100; } }); toast('Prix du catalogue mis à jour avec tes prix réels'); }}>
          Mettre à jour mes prix avec ces prix réels
        </Btn>
      </Card>

      <SpendingHistory current={monday} />
    </div>
  );
}

function SpendingHistory({ current }: { current: string }) {
  const data = useData((d) => d);
  const rows = Array.from({ length: 8 }, (_, k) => addDays(current, -7 * (7 - k)))
    .map((w) => {
      const meta = data.weeks[w];
      const real = meta?.realTotal ?? (meta ? Object.values(meta.realPrices).reduce((s, x) => s + x, 0) : 0);
      return { w, real };
    })
    .filter((r) => r.real > 0);
  return (
    <Card>
      <CardHead icon="chart" title="Historique des dépenses" />
      {rows.length ? (
        <table className="simple">
          <thead><tr><th>Semaine</th><th className="right">Dépensé</th><th className="right">Budget</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.w}><td>{formatShort(r.w)}</td><td className="right">{formatEuro(r.real)}</td><td className="right muted">{formatEuro(data.weeklyBudget)}</td></tr>)}</tbody>
        </table>
      ) : (
        <p className="small muted">Saisis le total de ton ticket après les courses pour suivre tes dépenses semaine après semaine.</p>
      )}
    </Card>
  );
}
