import { useEffect, useMemo, useState } from 'react';
import type { AppData, RecipeCategory, Unit } from '../store/types';
import { generateWeekIfEmpty, loadPhoto, mutate, regenerateWeek, useData } from '../store/store';
import { addDays, formatDayMonth, formatLong, todayISO, weekDays, weekStart } from '../lib/dates';
import { beforeStart, mealsOfDay, mealsOfWeek } from '../lib/planning';
import { buildShoppingList, homeStock } from '../lib/shopping';
import { markLow } from '../lib/stock';
import { formatEuro, formatQty, ingredientKey, recipeCost } from '../lib/units';
import type { Route } from '../lib/router';
import { randomId } from '../data/defaults';
import { Btn, Card, CardHead, Empty, Icon, NumberField, Seg, Stepper, confirmAsk, toast, SubmitBtn } from '../components/ui';
import { MealCard } from '../components/meals';

type Tab = 'planning' | 'recettes' | 'stock';

export function FoodPage({ route }: { route: Route }) {
  const [tab, setTab] = useState<Tab>((route.query.get('tab') as Tab) || 'planning');
  return (
    <div className="page">
      <div className="topbar">
        <h1 className="grow">Alimentation</h1>
      </div>
      <Seg label="Section" value={tab} options={[{ value: 'planning', label: 'Planning' }, { value: 'recettes', label: 'Recettes' }, { value: 'stock', label: 'Stock & restes' }]} onChange={setTab} />
      {tab === 'planning' && <Planning initial={route.query.get('w') ?? undefined} />}
      {tab === 'recettes' && <RecipeList />}
      {tab === 'stock' && <Stock />}
    </div>
  );
}

function Planning({ initial }: { initial?: string }) {
  const data = useData((d) => d);
  const [monday, setMonday] = useState(initial ?? weekStart(todayISO()));
  const meals = mealsOfWeek(data.meals, monday);
  const list = useMemo(() => buildShoppingList(data, monday), [data, monday]);
  return (
    <>
      <div className="row between">
        <button className="icon-btn" aria-label="Semaine précédente" onClick={() => setMonday(addDays(monday, -7))}><Icon name="left" /></button>
        <strong>Semaine du {formatDayMonth(monday)}</strong>
        <button className="icon-btn" aria-label="Semaine suivante" onClick={() => setMonday(addDays(monday, 7))}><Icon name="right" /></button>
      </div>
      {meals.length === 0 ? (
        <Card tint="sage">
          {beforeStart(data, addDays(monday, 6)) ? (
          <Empty>
            <p>Ton programme commence le {formatLong(data.profile.startDate)} : rien n’est prévu cette semaine.</p>
            <Btn onClick={() => setMonday(weekStart(data.profile.startDate))}>Voir ma première semaine</Btn>
          </Empty>
          ) : (
          <Empty icon="calendar">
            <p>Aucun repas planifié cette semaine.</p>
            <Btn onClick={() => { generateWeekIfEmpty(monday); toast('Semaine générée à partir de tes recettes'); }}>Générer la semaine</Btn>
            <p className="tiny">La génération utilise uniquement ta bibliothèque de recettes, en rotation.</p>
          </Empty>
          )}
        </Card>
      ) : (
        <>
          <Card>
            <div className="row between small">
              <span>Courses estimées</span>
              <strong>{formatEuro(list.estimated)}{list.budget ? ` / ${formatEuro(list.budget)}` : ''}</strong>
            </div>
            <div className="row wrap">
              <a className="btn secondary small" href={`#/courses?w=${monday}`}>Liste de courses</a>
              <a className="btn secondary small" href={`#/batch?w=${monday}`}>Batch de la veille</a>
              <Btn small variant="ghost" icon="swap" onClick={async () => { if (await confirmAsk({ title: `Régénérer la semaine du ${formatDayMonth(monday)} ?`, body: 'Les repas déjà préparés, mangés ou ajoutés à la main sont conservés.', confirm: 'Régénérer la semaine' })) { regenerateWeek(monday); toast('Nouvelle proposition générée'); } }}>Régénérer</Btn>
            </div>
          </Card>
          {weekDays(monday).map((d) => {
            const dm = mealsOfDay(data.meals, d);
            return (
              <Card key={d}>
                <a href={`#/jour/${d}`} className="row between" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h2 className="cap">{formatLong(d).replace(/ \d{4}$/, '')}</h2>
                  <Icon name="chevron" size={18} />
                </a>
                {dm.length ? <div className="col">{dm.map((m) => <MealCard key={m.id} m={m} />)}</div> : <p className="small muted">Aucun repas.</p>}
              </Card>
            );
          })}
        </>
      )}
    </>
  );
}

const CAT_LABEL: Record<RecipeCategory, string> = { pates: 'Pâtes', soupe: 'Soupes', salade: 'Salades', riz: 'Riz', mijote: 'Plats mijotés', autre: 'Autres' };

export function RecipeThumb({ id, has }: { id: string; has?: boolean }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let alive = true;
    if (has !== false) loadPhoto(id).then((p) => alive && setSrc(p)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, has]);
  return src ? <img className="thumb" src={src} alt="" /> : <div className="thumb"><Icon name="food" /></div>;
}

function RecipeList() {
  const data = useData((d) => d);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<RecipeCategory | 'all'>('all');
  const recipes = data.recipes
    .filter((r) => cat === 'all' || r.categories.includes(cat))
    .filter((r) => !q || ingredientKey(r.name).includes(ingredientKey(q)) || r.ingredients.some((i) => ingredientKey(i.name).includes(ingredientKey(q))))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const provisional = data.recipes.filter((r) => r.provisional).length;
  return (
    <>
      <a className="btn" href="#/recette-nouvelle"><Icon name="plus" />Nouvelle recette</a>
      {provisional > 0 && <p className="small muted">{provisional} recette(s) ont encore des quantités provisoires : ouvre-les pour saisir tes proportions habituelles.</p>}
      <input className="input" type="search" aria-label="Rechercher une recette ou un ingrédient" placeholder="ex. poulet, chili…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Seg label="Catégorie" value={cat} options={[{ value: 'all', label: 'Toutes' }, { value: 'pates', label: 'Pâtes' }, { value: 'soupe', label: 'Soupes' }, { value: 'salade', label: 'Salades' }, { value: 'riz', label: 'Riz' }, { value: 'mijote', label: 'Mijotés' }, { value: 'autre', label: 'Autres' }]} onChange={setCat} />
      <Card>
        {cat !== 'all' && <h2>{CAT_LABEL[cat]}</h2>}
        <div className="list">
          {recipes.map((r) => {
            const c = recipeCost(r, data.ingredients);
            return (
              <a key={r.id} className={`recipe-card cat-${r.categories[0] ?? 'autre'}`} href={`#/recette/${r.id}`}>
                <RecipeThumb id={r.id} has={!!r.photo} />
                <div className="grow col" style={{ gap: 6 }}>
                  <div className="recipe-card-title">{r.name}</div>
                  <div className="tiny muted">{r.servings} portions{r.provisional ? ' · quantités provisoires' : ''}</div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {r.categories[0] && <span className={`chip cat-chip cat-${r.categories[0]}`}>{CAT_LABEL[r.categories[0]]}</span>}
                    <span className="chip lilac"><Icon name="clock" size={14} />{r.prepMin + r.cookMin} min</span>
                    <span className="chip warn"><Icon name="euro" size={14} />≈ {formatEuro(c.perPortion)}</span>
                    <span className={`chip ${r.batchMode === 'full' ? 'peach' : 'sage'}`}>{r.batchMode === 'full' ? 'batch' : 'jour même'}</span>
                  </div>
                </div>
              </a>
            );
          })}
          {!recipes.length && (
            <Empty>
              <h3>Aucune recette trouvée</h3>
              <p className="small">Rien ne correspond à cette recherche ou à cette catégorie pour l’instant.</p>
              <Btn variant="secondary" onClick={() => { setQ(''); setCat('all'); }}>Effacer la recherche</Btn>
            </Empty>
          )}
        </div>
      </Card>
    </>
  );
}

function Stock() {
  const data = useData((d) => d);
  const [recipeId, setRecipeId] = useState('');
  const [portions, setPortions] = useState(2);
  const [q, setQ] = useState('');
  const nextMonday = addDays(weekStart(todayISO()), 7);
  const usedKeys = useMemo(() => {
    const l = [...buildShoppingList(data, weekStart(todayISO())).items, ...buildShoppingList(data, nextMonday).items];
    return [...new Set(l.map((i) => ingredientKey(i.name)))];
  }, [data, nextMonday]);
  const allKeys = Object.keys(data.ingredients).sort((a, b) => a.localeCompare(b, 'fr'));
  const shown = (q ? allKeys.filter((k) => k.includes(ingredientKey(q))) : usedKeys.length ? usedKeys : allKeys).slice(0, 60);
  // Reste des courses : ce qui sera encore à la maison au début des deux prochaines semaines
  const home = useMemo(() => {
    const w = weekStart(todayISO());
    const merged = new Map<string, number>();
    for (const v of [addDays(w, 7), addDays(w, 14)]) for (const [k, q] of homeStock(data, v)) if (!data.pantry[k]?.qty) merged.set(k, Math.max(merged.get(k) ?? 0, q));
    return [...merged].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [data]);
  const placard = Object.entries(data.pantry).filter(([, p]) => p.staple && p.all).map(([k]) => k).sort((a, b) => a.localeCompare(b, 'fr'));
  const leftovers = data.meals.filter((m) => m.source === 'leftover' && m.date >= todayISO() && m.status === 'prévu').sort((a, b) => a.date.localeCompare(b.date) || (a.slot === 'lunch' ? -1 : 1));
  return (
    <>
      <Card tint="sky">
        <CardHead icon="snow" title="Mon congélateur" />
        <p className="small muted">Portions déjà prêtes. Pour en utiliser une, modifie un repas et choisis « Déjà au congélateur » : il ne sera pas compté dans les courses.</p>
        {data.freezer.length ? (
          <div className="list">
            {data.freezer.map((f) => (
              <div key={f.id} className="list-item">
                <div className="grow">
                  <div className="strong">{f.name}</div>
                  <div className="tiny muted">congelé le {formatDayMonth(f.frozenOn)}</div>
                </div>
                <Stepper label={`Portions de ${f.name}`} value={f.portions} min={0} onChange={(v) => mutate((d) => { const x = d.freezer.find((y) => y.id === f.id); if (x) x.portions = v; d.freezer = d.freezer.filter((y) => y.portions > 0); })} />
              </div>
            ))}
          </div>
        ) : (
          <p className="small">Le congélateur est vide pour l’instant.</p>
        )}
        <div className="row">
          <select className="input grow" value={recipeId} onChange={(e) => setRecipeId(e.target.value)} aria-label="Recette à ajouter au congélateur">
            <option value="">Ajouter une portion…</option>
            {data.recipes.filter((r) => r.freezable).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <Stepper label="Portions" value={portions} min={1} onChange={setPortions} />
        </div>
        <SubmitBtn variant="secondary" missing={!recipeId && 'Choisis d’abord la recette à mettre au congélateur.'} onClick={() => { const r = data.recipes.find((x) => x.id === recipeId)!; mutate((d) => { d.freezer.push({ id: randomId(), recipeId, name: r.name, portions, frozenOn: todayISO() }); }); setRecipeId(''); toast('Ajouté au congélateur'); }}>
          Ajouter au congélateur
        </SubmitBtn>
      </Card>
      <Card>
        <CardHead icon="fridge" title="Restes à consommer" />
        {leftovers.length ? leftovers.map((m) => <MealCard key={m.id} m={m} showDate />) : <p className="small muted">Aucun reste planifié. Pour en ajouter : « Ajouter » un repas et choisir l’origine « Restes ».</p>}
      </Card>
      <Card>
        <CardHead icon="cart" title="Reste des courses" />
        <p className="small muted">Le surplus des formats achetés (le reste du filet d’oignons, de la courge…) est gardé ici et déduit des prochaines listes de courses. Le frais ne compte qu’une semaine.</p>
        {home.length ? (
          <div className="list">
            {home.map(([k, qty]) => (
              <div key={k} className="list-item">
                <span className="grow">{data.ingredients[k]?.name ?? k}</span>
                <span className="small strong nowrap">{formatQty(qty, unitOf(data, k), data.liquidDisplay)}</span>
              </div>
            ))}
          </div>
        ) : <p className="small">Rien pour l’instant : coche tes articles dans la liste de courses et le surplus apparaîtra ici.</p>}
      </Card>
      <Card>
        <CardHead icon="list" title="Mon placard" />
        <p className="small muted">Les basiques (huile, épices, sauces, bouillon…) achetés une fois ne reviennent plus sur la liste. Quand l’un d’eux est presque fini, dis-le : il sera sur la prochaine liste.</p>
        {placard.length ? (
          <div className="list">
            {placard.map((k) => (
              <div key={k} className="list-item">
                <span className="grow">{data.ingredients[k]?.name ?? k}</span>
                <Btn small variant="secondary" onClick={() => { mutate((d) => markLow(d, k)); toast(`${data.ingredients[k]?.name ?? k} : sur la prochaine liste`); }}>Presque fini</Btn>
              </div>
            ))}
          </div>
        ) : <p className="small">Ton placard se remplira au fil des courses.</p>}
      </Card>
      <Card>
        <CardHead icon="list" title="Ce que j’ai déjà" />
        <p className="small muted">Ce que tu as déjà à la maison : déduit de tes prochaines listes, puis utilisé au fil des repas. « Assez » : ne plus jamais l’acheter.</p>
        <input className="input" type="search" aria-label="Chercher un ingrédient" placeholder="ex. carotte" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="list">
          {shown.map((k) => {
            const info = data.ingredients[k];
            const p = data.pantry[k];
            return (
              <div key={k} className="list-item" style={{ flexWrap: 'wrap' }}>
                <div className="grow" style={{ minWidth: 140 }}>{info?.name ?? k}</div>
                <label className="row small">
                  <input type="checkbox" checked={!!p?.all} onChange={(e) => mutate((d) => { d.pantry[k] = e.target.checked ? { all: true } : {}; })} />
                  assez
                </label>
                {!p?.all && (
                  <div style={{ width: 130 }}>
                    <NumberField value={p?.qty} onChange={(v) => mutate((d) => { d.pantry[k] = { qty: v, since: todayISO() }; })} ariaLabel={`Quantité en stock : ${info?.name ?? k}`} placeholder="0" min={0} suffix={unitHint(data, k)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {Object.values(data.pantry).some((p) => p.all || p.qty) && (
          <p className="tiny muted">
            En stock : {Object.entries(data.pantry).filter(([, p]) => p.all || p.qty).map(([k, p]) => `${data.ingredients[k]?.name ?? k}${p.qty ? ` (${p.qty} ${unitHint(data, k)})` : ''}`).join(', ')}
          </p>
        )}
      </Card>
    </>
  );
}

function unitOf(data: AppData, key: string): Unit {
  for (const r of data.recipes) for (const i of r.ingredients) if (ingredientKey(i.name) === key) return i.unit;
  return 'g';
}

function unitHint(data: AppData, key: string): string {
  for (const r of data.recipes) for (const i of r.ingredients) if (ingredientKey(i.name) === key) return i.unit === 'pièce' ? 'pc' : i.unit;
  return 'g';
}
