import { useMemo, useState } from 'react';
import type { Aisle } from '../store/types';
import { ensureWeek, mutate, useData } from '../store/store';
import { addDays, formatDayMonth, formatShort, todayISO, weekStart } from '../lib/dates';
import { budgetSuggestions, buildShoppingList } from '../lib/shopping';
import { recordPurchase } from '../lib/stock';
import { AISLE_LABEL, AISLE_ORDER, formatEuro, formatQty, STATE_LABEL, ingredientKey } from '../lib/units';
import type { Route } from '../lib/router';
import { randomId } from '../data/defaults';
import { Btn, Card, CardHead, Check, Empty, Icon, NumberField, Progress, Seg, Toggle, toast } from '../components/ui';

/** Budget de référence quand aucun budget n'est saisi dans Réglages. */
const DEFAULT_BUDGET = 120;

/** Icône de chaque rayon, pour les repérer d'un coup d'œil en magasin. */
const AISLE_ICON: Record<Aisle, string> = {
  'fruits-legumes': 'leaf', proteines: 'food', laitiers: 'drop', feculents: 'pot',
  conserves: 'book', surgeles: 'snow', epicerie: 'sparkle', autres: 'cart'
};

export function ShoppingPage({ route }: { route: Route }) {
  const data = useData((d) => d);
  const [monday, setMonday] = useState(route.query.get('w') || addDays(weekStart(todayISO()), 7));
  const [pricing, setPricing] = useState(false);
  const [view, setView] = useState<'todo' | 'done' | 'all'>('todo');
  const [quick, setQuick] = useState('');
  const [quickHint, setQuickHint] = useState('');
  const list = useMemo(() => buildShoppingList(data, monday), [data, monday]);
  const suggestions = useMemo(() => budgetSuggestions(data, list), [data, list]);
  const toBuy = list.items.filter((i) => i.needed > 0);
  const inStock = list.items.filter((i) => i.needed <= 0);
  const checkedCount = toBuy.filter((i) => i.checked).length + list.manual.filter((m) => data.weeks[monday]?.shoppingChecks[m.id]).length;

  const setCheck = (key: string, v: boolean) => mutate((d) => {
    ensureWeek(d, monday).shoppingChecks[key] = v;
    // surplus du format acheté → stock des semaines suivantes ; basique du placard → « j'en ai »
    const item = list.items.find((i) => i.key === key);
    if (item) recordPurchase(d, monday, ingredientKey(item.name), v, item.buy - item.needed);
  });

  const applySwap = (from: string, to: string) => {
    mutate((d) => {
      for (const m of d.meals) if (m.recipeId === from && m.date >= monday && m.date <= addDays(monday, 6) && m.status === 'prévu') {
        m.recipeId = to;
        m.note = `Remplace : ${d.recipes.find((r) => r.id === from)?.name ?? ''} (budget)`;
      }
    });
    toast('Remplacement appliqué : liste et batch recalculés');
  };

  const budget = list.budget ?? DEFAULT_BUDGET;
  const checkedOf = (key: string) => !!data.weeks[monday]?.shoppingChecks[key];
  /** Dépensé : articles cochés, au prix réel s'il a été saisi, sinon au prix estimé */
  const inCart = toBuy.filter((i) => i.checked).reduce((sum, i) => sum + (i.realPrice ?? i.estCost ?? 0), 0);
  const remaining = budget - list.estimated;
  const total = toBuy.length + list.manual.length;
  const toggle = (key: string, name: string, v: boolean) => {
    setCheck(key, v);
    if (v && view === 'todo') toast(`${name} : dans le panier`);
  };
  const quickAdd = () => {
    const raw = quick.trim();
    if (!raw) return setQuickHint('Écris un article, par exemple « 2 citrons ».');
    const m = raw.match(/^(\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l|x|pc|pièces?)?)\s+(.+)$/i);
    const itemName = (m ? m[2] : raw).trim();
    const itemQty = m ? m[1].trim() : '';
    const k = ingredientKey(itemName);
    const known = data.ingredients[k] ?? data.ingredients[k.replace(/s$/, '')];
    mutate((d) => { ensureWeek(d, monday).manualItems.push({ id: `manual:${randomId()}`, name: itemName, qty: itemQty, aisle: known?.aisle ?? 'autres' }); });
    setQuick('');
    setQuickHint('');
    toast(`${itemName} ajouté${known ? ` (${AISLE_LABEL[known.aisle]})` : ''}`);
  };

  return (
    <div className="page shop">
      <div className="topbar">
        <div className="grow">
          <h1>Mes courses</h1>
          <div className="sub">Semaine du {formatDayMonth(monday)} au {formatDayMonth(addDays(monday, 6))}</div>
        </div>
      </div>

      <div className="shop-budget" role="status" aria-live="polite">
        <div className="row between">
          <span className={`shop-remaining ${inCart > budget ? 'over' : ''}`}>
            Dépensé <strong>{formatEuro(inCart)}</strong>
            <span className="muted"> sur {formatEuro(budget)}</span>
          </span>
          <span className="small muted nowrap">{checkedCount}/{total} au panier</span>
        </div>
        <Progress value={inCart} max={budget} tone={inCart > budget ? 'over' : undefined} />
        <div className="tiny muted">Liste complète ≈ {formatEuro(list.estimated)}{remaining < 0 ? ` (${formatEuro(-remaining)} au-dessus du budget)` : ''}{list.budget == null ? ' · budget indicatif, modifiable dans Réglages' : ''}</div>
      </div>

      <form className="shop-quick" onSubmit={(e) => { e.preventDefault(); quickAdd(); }}>
        <label className="sr-only" htmlFor="shop-quick">Ajouter un article</label>
        <input id="shop-quick" className="input" placeholder="Ajouter : ex. 2 citrons" value={quick} onChange={(e) => { setQuick(e.target.value); setQuickHint(''); }} enterKeyHint="done" autoComplete="off" />
        <button type="submit" className="icon-btn" aria-label="Ajouter l’article"><Icon name="plus" /></button>
      </form>
      {quickHint && <p className="field-hint" role="alert">{quickHint}</p>}

      <div className="row between">
        <Btn small variant="ghost" icon="left" onClick={() => setMonday(addDays(monday, -7))}>Précédente</Btn>
        <Btn small variant="ghost" onClick={() => setMonday(addDays(monday, 7))}>Suivante<Icon name="right" size={18} /></Btn>
      </div>

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

      {total === 0 ? (
        <Card><Empty icon="cart"><p>Rien à acheter pour cette semaine.</p><a className="btn secondary" href={`#/alimentation?w=${monday}`}>Voir le planning</a></Empty></Card>
      ) : (
        <>
          <Seg label="Afficher" value={view} onChange={setView} options={[
            { value: 'todo', label: `À acheter (${total - checkedCount})` },
            { value: 'done', label: `Dans le panier (${checkedCount})` },
            { value: 'all', label: 'Tout' }
          ]} />
          {view === 'todo' && checkedCount === total && (
            <Card tint="sage"><p><strong>Tout est dans le panier.</strong> Bonnes courses !</p></Card>
          )}
          {AISLE_ORDER.map((a) => {
            const keep = (checked: boolean) => view === 'all' || (view === 'done' ? checked : !checked);
            const items = toBuy.filter((i) => i.aisle === a && keep(i.checked));
            const manual = list.manual.filter((m) => m.aisle === a && keep(checkedOf(m.id)));
            if (!items.length && !manual.length) return null;
            const all = toBuy.filter((i) => i.aisle === a).length + list.manual.filter((m) => m.aisle === a).length;
            const done = toBuy.filter((i) => i.aisle === a && i.checked).length + list.manual.filter((m) => m.aisle === a && checkedOf(m.id)).length;
            return (
              <section key={a} className={`card aisle aisle-${a}`} aria-label={AISLE_LABEL[a]}>
                <div className="aisle-head">
                  <Icon name={AISLE_ICON[a]} />
                  <h2 className="grow">{AISLE_LABEL[a]}</h2>
                  <span className="aisle-count">{done}/{all}</span>
                </div>
                <div className="list">
                  {items.map((i) => (
                    <div key={i.key} className={`shop-item ${i.checked ? 'done' : ''}`}>
                      <Check checked={i.checked} onChange={(v) => toggle(i.key, i.name, v)} label={`${i.name}, ${formatQty(i.buy, i.unit, data.liquidDisplay)}`} />
                      <div className="shop-text" onClick={() => !pricing && toggle(i.key, i.name, !i.checked)}>
                        <div className="shop-line"><span className="shop-qty">{i.packs && i.packs > 1 ? `${i.packs} × ${formatQty(i.packQty!, i.unit, data.liquidDisplay)}` : formatQty(i.buy, i.unit, data.liquidDisplay)}</span><span className="shop-name">{i.name}</span></div>
                        <div className="tiny muted">
                          {i.packs != null && Math.abs(i.buy - i.needed) > 0.01 && `besoin : ${formatQty(i.needed, i.unit, data.liquidDisplay)} · `}
                          {i.states.length > 0 && `${i.states.map((st) => STATE_LABEL[st]).join(' / ')} · `}
                          {typeof i.owned === 'number' && i.owned > 0 && `déjà ${formatQty(i.owned, i.unit)} à la maison · `}
                          {i.usedIn.join(', ')}
                        </div>
                      </div>
                      {pricing ? (
                        <div style={{ width: 110 }}>
                          <NumberField ariaLabel={`Prix réel : ${i.name}`} value={i.realPrice} min={0} suffix="€" placeholder={i.estCost != null ? i.estCost.toFixed(2) : ''} onChange={(v) => mutate((d) => { const w = ensureWeek(d, monday); if (v == null) delete w.realPrices[i.key]; else w.realPrices[i.key] = v; })} />
                        </div>
                      ) : (
                        <span className="shop-price nowrap">{i.estCost != null ? formatEuro(i.estCost) : ''}</span>
                      )}
                    </div>
                  ))}
                  {manual.map((m) => (
                    <div key={m.id} className={`shop-item ${checkedOf(m.id) ? 'done' : ''}`}>
                      <Check checked={checkedOf(m.id)} onChange={(v) => toggle(m.id, m.name, v)} label={m.qty ? `${m.name}, ${m.qty}` : m.name} />
                      <div className="shop-text" onClick={() => toggle(m.id, m.name, !checkedOf(m.id))}>
                        <div className="shop-line">{m.qty && <span className="shop-qty">{m.qty}</span>}<span className="shop-name">{m.name}</span></div>
                        <div className="tiny muted">ajouté à la main</div>
                      </div>
                      <button className="icon-btn plain" aria-label={`Retirer ${m.name}`} onClick={() => mutate((d) => { const w = ensureWeek(d, monday); w.manualItems = w.manualItems.filter((x) => x.id !== m.id); })}><Icon name="trash" size={18} /></button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          <div className="row between">
            <span className="small">Saisir les prix réels au fil des courses</span>
            <Toggle label="Saisir les prix réels" checked={pricing} onChange={setPricing} />
          </div>
          <p className="tiny muted">
            Prix Colruyt des formats achetés (ce que tu paies en caisse, hors promotions).
            {list.missingPrices > 0 && ` ${list.missingPrices} article(s) sans prix.`} <a href="#/reglages/ingredients">Modifier les prix</a>
          </p>
        </>
      )}

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
          <tbody>{rows.map((r) => <tr key={r.w}><td>{formatShort(r.w)}</td><td className="right">{formatEuro(r.real)}</td><td className="right muted">{data.weeklyBudget ? formatEuro(data.weeklyBudget) : "—"}</td></tr>)}</tbody>
        </table>
      ) : (
        <p className="small muted">Saisis le total de ton ticket après les courses pour suivre tes dépenses semaine après semaine.</p>
      )}
    </Card>
  );
}
