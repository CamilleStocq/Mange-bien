import { useEffect, useMemo, useState } from 'react';
import type { AppData, RecipeCategory } from '../store/types';
import { generateWeekIfEmpty, loadPhoto, mutate, regenerateWeek, useData } from '../store/store';
import { addDays, formatDayMonth, formatLong, todayISO, weekDays, weekStart } from '../lib/dates';
import { mealsOfDay, mealsOfWeek } from '../lib/planning';
import { buildShoppingList } from '../lib/shopping';
import { buildBatchPlan } from '../lib/batch';
import { formatEuro, ingredientKey, recipeCost } from '../lib/units';
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
      <Shortcuts />
      <Seg label="Section" value={tab} options={[{ value: 'planning', label: 'Planning' }, { value: 'recettes', label: 'Recettes' }, { value: 'stock', label: 'Stock & restes' }]} onChange={setTab} />
      {tab === 'planning' && <Planning initial={route.query.get('w') ?? undefined} />}
      {tab === 'recettes' && <RecipeList />}
      {tab === 'stock' && <Stock />}
    </div>
  );
}

function Shortcuts() {
  const data = useData((d) => d);
  const nextMonday = addDays(weekStart(todayISO()), 7);
  const list = useMemo(() => buildShoppingList(data, nextMonday), [data, nextMonday]);
  const plan = useMemo(() => buildBatchPlan(data, nextMonday), [data, nextMonday]);
  return (
    <div className="grid2">
      <a className="card tile tint-warn" href={`#/batch?w=${nextMonday}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <Icon name="pot" />
        <strong>Batch du dimanche</strong>
        <span className="small muted">{plan.empty ? 'Rien à préparer' : `${plan.cookFull.length} plat(s) · ≈ ${Math.round(plan.durationMin / 15) * 15} min`}</span>
      </a>
      <a className="card tile tint-rose" href={`#/courses?w=${nextMonday}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <Icon name="cart" />
        <strong>Mes courses</strong>
        <span className="small muted">≈ {formatEuro(list.estimated)} / {formatEuro(list.budget)}</span>
      </a>
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
          <Empty icon="calendar">
            <p>Aucun repas planifié cette semaine.</p>
            <Btn onClick={() => { generateWeekIfEmpty(monday); toast('Semaine générée à partir de tes recettes'); }}>Générer la semaine</Btn>
            <p className="tiny">La génération utilise uniquement ta bibliothèque de recettes, en rotation.</p>
          </Empty>
        </Card>
      ) : (
        <>
          <Card>
            <div className="row between small">
              <span>Courses estimées</span>
              <strong>{formatEuro(list.estimated)} / {formatEuro(list.budget)}</strong>
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

const CAT_LABEL: Record<RecipeCategory, string> = { plat: 'Plats principaux', vegetarien: 'Végétarien / légumineuses', salade: 'Salades', autre: 'Autres repas' };

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
      <Seg label="Catégorie" value={cat} options={[{ value: 'all', label: 'Toutes' }, { value: 'plat', label: 'Plats' }, { value: 'vegetarien', label: 'Végé' }, { value: 'salade', label: 'Salades' }, { value: 'autre', label: 'Autres' }]} onChange={setCat} />
      <Card>
        {cat !== 'all' && <h2>{CAT_LABEL[cat]}</h2>}
        <div className="list">
          {recipes.map((r, idx) => {
            const c = recipeCost(r, data.ingredients);
            return (
              <a key={r.id} className={`recipe-card tone-${idx % 4}`} href={`#/recette/${r.id}`}>
                <RecipeThumb id={r.id} has={!!r.photo} />
                <div className="grow col" style={{ gap: 6 }}>
                  <div className="recipe-card-title">{r.name}</div>
                  <div className="tiny muted">{r.servings} portions{r.provisional ? ' · quantités provisoires' : ''}</div>
                  <div className="row wrap" style={{ gap: 6 }}>
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
  const leftovers = data.meals.filter((m) => m.source === 'leftover' && m.date >= todayISO());
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
        {leftovers.length ? leftovers.map((m) => <MealCard key={m.id} m={m} />) : <p className="small muted">Aucun reste planifié. Pour en ajouter : « Ajouter » un repas et choisir l’origine « Restes ».</p>}
      </Card>
      <Card>
        <CardHead icon="list" title="Ce que j’ai déjà" />
        <p className="small muted">Les quantités en stock sont déduites de la liste de courses. Par défaut : ingrédients des deux semaines à venir.</p>
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
                    <NumberField value={p?.qty} onChange={(v) => mutate((d) => { d.pantry[k] = { qty: v }; })} ariaLabel={`Quantité en stock : ${info?.name ?? k}`} placeholder="0" min={0} suffix={unitHint(data, k)} />
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

function unitHint(data: AppData, key: string): string {
  for (const r of data.recipes) for (const i of r.ingredients) if (ingredientKey(i.name) === key) return i.unit === 'pièce' ? 'pc' : i.unit;
  return 'g';
}
