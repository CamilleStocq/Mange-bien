import { useEffect, useState } from 'react';
import type { IngredientLine, Recipe, RecipeCategory, Unit, WeighState } from '../store/types';
import { addMeal, getData, loadPhoto, mutate, savePhoto, useData } from '../store/store';
import { formatShort, todayISO } from '../lib/dates';
import { mealId } from '../lib/planning';
import { formatEuro, formatQty, ingredientKey, recipeCost, recipeNutrition, STATE_LABEL } from '../lib/units';
import { go } from '../lib/router';
import { randomId } from '../data/defaults';
import { Btn, Card, CardHead, Empty, Icon, NumberField, Provisional, Seg, Sheet, Stepper, TextField, Toggle, confirmAsk, toast } from '../components/ui';
import type { MealSlot } from '../store/types';

const UNITS: Unit[] = ['g', 'ml', 'pièce'];
const STATES: WeighState[] = ['', 'cru', 'sec', 'cuit', 'égoutté', 'comestible'];
const CATS: { value: RecipeCategory; label: string }[] = [
  { value: 'pates', label: 'Pâtes' },
  { value: 'soupe', label: 'Soupe' },
  { value: 'salade', label: 'Salade' },
  { value: 'riz', label: 'Riz' },
  { value: 'mijote', label: 'Plat mijoté' },
  { value: 'autre', label: 'Autre' }
];

export function RecipePage({ id }: { id: string }) {
  const data = useData((d) => d);
  const r = data.recipes.find((x) => x.id === id);
  const [portions, setPortions] = useState(r?.servings ?? 1);
  const [photo, setPhoto] = useState<string>();
  const [planning, setPlanning] = useState(false);
  useEffect(() => {
    if (r?.photo) loadPhoto(r.id).then(setPhoto).catch(() => undefined);
  }, [r?.id, r?.photo]);
  if (!r) return <div className="page"><Empty>Recette introuvable. <a href="#/alimentation?tab=recettes">Retour aux recettes</a></Empty></div>;
  const f = portions / Math.max(1, r.servings);
  const cost = recipeCost(r, data.ingredients);
  const nut = recipeNutrition(r, data.ingredients);
  const upcoming = data.meals.filter((m) => m.recipeId === r.id && m.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={() => history.back()} aria-label="Retour"><Icon name="back" /></button>
        <div className="grow" />
        <a className="icon-btn" href={`#/recette/${r.id}/modifier`} aria-label="Modifier la recette"><Icon name="edit" /></a>
      </div>
      {photo && <img className="recipe-photo" src={photo} alt={`Photo : ${r.name}`} />}
      <h1>{r.name}</h1>
      <div className="row wrap">
        {r.categories.map((c) => <span key={c} className={`chip cat-chip cat-${c}`}>{CATS.find((x) => x.value === c)?.label}</span>)}
        <span className="chip">{r.batchMode === 'full' ? 'Batch : cuire le dimanche' : 'Préparer seulement / cuire le jour même'}</span>
        <Provisional show={r.provisional} />
      </div>
      {r.provisional && (
        <Card tint="warn">
          <p className="small">Les quantités de cette recette sont des <strong>portions de départ provisoires</strong>, pas tes proportions réelles. Corrige-les, puis confirme.</p>
          <div className="row wrap">
            <a className="btn small" href={`#/recette/${r.id}/modifier`}>Corriger les quantités</a>
            <Btn small variant="secondary" onClick={() => { mutate((d) => { const x = d.recipes.find((y) => y.id === r.id); if (x) x.provisional = false; }); toast('Quantités confirmées'); }}>Elles me conviennent</Btn>
          </div>
        </Card>
      )}
      <dl className="stat-table">
        <div><dt>Préparation</dt><dd>{r.prepMin} min</dd></div>
        <div><dt>Cuisson</dt><dd>{r.cookMin} min</dd></div>
        <div><dt>Coût / portion</dt><dd>≈ {formatEuro(cost.perPortion)}</dd></div>
      </dl>
      <Card>
        <CardHead icon="list" title="Ingrédients" right={<Stepper label="Portions" value={portions} min={1} max={20} onChange={setPortions} />} />
        <p className="tiny muted">Pour {portions} portion{portions > 1 ? 's' : ''} (recette de base : {r.servings}).</p>
        <table className="simple">
          <tbody>
            {r.ingredients.map((i, k) => (
              <tr key={k}>
                <td>{i.name}{i.accomp && <span className="tiny muted"> · accompagnement</span>}{i.note && <div className="tiny muted">{i.note}</div>}</td>
                <td className="right nowrap"><strong>{formatQty(i.qty * f, i.unit, data.liquidDisplay)}</strong>{i.state && <div className="tiny muted">{STATE_LABEL[i.state]}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <CardHead icon="book" title="Préparation" />
        {r.steps.length ? <ol className="steps-list">{r.steps.map((s, k) => <li key={k}>{s}</li>)}</ol> : <p className="small muted">Aucune étape saisie.</p>}
      </Card>
      {r.substitutions && (
        <Card>
          <CardHead icon="swap" title="Substitutions" />
          <p className="small">{r.substitutions}</p>
        </Card>
      )}
      <Card tint="sky">
        <CardHead icon="snow" title="Conservation" />
        <p className="small">Frigo : {r.fridgeDays} jour{r.fridgeDays > 1 ? 's' : ''} maximum · Congélation : {r.freezable ? `oui, ${r.freezerMonths || '?'} mois` : 'déconseillée'}</p>
        {r.storageNotes && <p className="small">{r.storageNotes}</p>}
      </Card>
      <Card>
        <CardHead icon="info" title="Repères nutritionnels" />
        <p className="small">
          ≈ {Math.round(nut.kcal)} kcal · {Math.round(nut.protein)} g de protéines par portion{!nut.complete && ' (partiel : certains ingrédients n’ont pas de données)'}.
        </p>
        <p className="tiny muted">{nut.manual ? 'Valeurs saisies par toi.' : 'Estimation approximative à partir de tables générales. Ce n’est pas une limite à respecter.'} Coût : {cost.manual ? 'saisi manuellement' : `estimé depuis tes prix${cost.missing.length ? ` (prix manquant : ${cost.missing.join(', ')})` : ''}`}.</p>
      </Card>
      <Card>
        <CardHead icon="calendar" title="Prévue au calendrier" right={<Btn small variant="secondary" icon="plus" onClick={() => setPlanning(true)}>Planifier</Btn>} />
        {upcoming.length ? (
          <div className="row wrap">{upcoming.map((m) => <a key={m.id} className="chip sage" href={`#/jour/${m.date}`}>{formatShort(m.date)}</a>)}</div>
        ) : (
          <p className="small muted">Pas encore prévue dans les jours à venir.</p>
        )}
      </Card>
      <div className="grid2">
        <Btn variant="secondary" onClick={() => { const copy: Recipe = { ...structuredClone(r), id: randomId(), name: `${r.name} (copie)`, photo: undefined }; mutate((d) => { d.recipes.push(copy); }); go(`/recette/${copy.id}/modifier`); }}>Dupliquer</Btn>
        <Btn variant="danger" icon="trash" onClick={() => deleteRecipe(r)}>Supprimer la recette</Btn>
      </div>
      {planning && <PlanSheet recipe={r} onClose={() => setPlanning(false)} />}
    </div>
  );
}

async function deleteRecipe(r: Recipe) {
  const future = getData().meals.filter((m) => m.recipeId === r.id && m.date >= todayISO());
  const body = future.length
    ? `Cette recette est prévue ${future.length} fois. Ces repas resteront dans ton planning sous forme de repas « ${r.name} » sans ingrédients (retirés des courses).`
    : undefined;
  if (!(await confirmAsk({ title: `Supprimer la recette « ${r.name} » ?`, body, confirm: 'Supprimer la recette', danger: true }))) return;
  mutate((d) => {
    d.recipes = d.recipes.filter((x) => x.id !== r.id);
    for (const m of d.meals) if (m.recipeId === r.id) Object.assign(m, { kind: 'custom', customName: r.name, recipeId: undefined, storage: undefined });
  });
  void savePhoto(r.id, undefined);
  toast('Recette supprimée');
  go('/alimentation?tab=recettes');
}

function PlanSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState<MealSlot>('dinner');
  const [portions, setPortions] = useState(1);
  return (
    <Sheet title={`Planifier : ${recipe.name}`} onClose={onClose}>
      <label className="field">Date<input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
      <Seg label="Moment" value={slot} options={[{ value: 'lunch', label: 'Déjeuner' }, { value: 'dinner', label: 'Dîner' }, { value: 'breakfast', label: 'Petit-déj.' }, { value: 'snack', label: 'Collation' }]} onChange={setSlot} />
      <div className="row between"><span>Portions</span><Stepper label="Portions" value={portions} min={0.5} step={0.5} onChange={setPortions} /></div>
      <Btn onClick={() => { addMeal({ id: mealId(), date, slot, kind: 'recipe', recipeId: recipe.id, portions, source: recipe.batchMode === 'full' ? 'batch' : 'fresh', status: 'prévu', unplanned: true }); toast(`Ajoutée au ${formatShort(date)}`); onClose(); }}>Ajouter au planning</Btn>
    </Sheet>
  );
}

async function resizeImage(file: File, max = 900): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Image illisible'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function emptyRecipe(): Recipe {
  return {
    id: randomId(), name: '', categories: ['autre'], servings: 4, prepMin: 15, cookMin: 30, ingredients: [{ name: '', qty: 0, unit: 'g', state: '' }],
    steps: [], substitutions: '', fridgeDays: 3, freezable: true, freezerMonths: 3, storageNotes: '', batchMode: 'full', quick: false, provisional: false
  };
}

export function RecipeEditor({ id }: { id?: string }) {
  const existing = useData((d) => d.recipes.find((r) => r.id === id));
  const catalog = useData((d) => d.ingredients);
  const [r, setR] = useState<Recipe>(() => (existing ? structuredClone(existing) : emptyRecipe()));
  const [stepsText, setStepsText] = useState(r.steps.join('\n'));
  const [photo, setPhoto] = useState<string | undefined>();
  const [photoChanged, setPhotoChanged] = useState(false);
  useEffect(() => {
    if (existing?.photo) loadPhoto(existing.id).then(setPhoto).catch(() => undefined);
  }, [existing?.id, existing?.photo]);
  if (id && !existing) return <div className="page"><Empty>Recette introuvable.</Empty></div>;
  const set = (p: Partial<Recipe>) => setR((x) => ({ ...x, ...p }));
  const setIng = (k: number, p: Partial<IngredientLine>) => setR((x) => ({ ...x, ingredients: x.ingredients.map((i, j) => (j === k ? { ...i, ...p } : i)) }));

  const save = async () => {
    const name = r.name.trim();
    if (!name) return toast('Le nom de la recette est obligatoire');
    const ingredients = r.ingredients.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim() }));
    if (ingredients.some((i) => !(i.qty > 0))) return toast('Chaque ingrédient doit avoir une quantité supérieure à 0');
    if (!(r.servings > 0)) return toast('Nombre de portions invalide');
    const final: Recipe = { ...r, name, ingredients, steps: stepsText.split('\n').map((s) => s.trim()).filter(Boolean), photo: photoChanged ? (photo ? 'oui' : undefined) : r.photo };
    try {
      if (photoChanged) await savePhoto(final.id, photo);
    } catch {
      toast('La photo n’a pas pu être enregistrée');
    }
    mutate((d) => {
      const i = d.recipes.findIndex((x) => x.id === final.id);
      if (i >= 0) d.recipes[i] = final;
      else d.recipes.push(final);
      // Nouveaux ingrédients : ajoutés au catalogue (rayon et prix à compléter dans les réglages).
      for (const ing of final.ingredients) {
        const k = ingredientKey(ing.name);
        if (!d.ingredients[k]) d.ingredients[k] = { name: ing.name, aisle: 'autres' };
      }
    });
    toast('Recette enregistrée — planning, courses et batch sont à jour');
    go(`/recette/${final.id}`);
  };

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={() => history.back()} aria-label="Annuler"><Icon name="x" /></button>
        <h1 className="grow">{existing ? 'Modifier la recette' : 'Nouvelle recette'}</h1>
      </div>
      <Card>
        <TextField label="Nom" value={r.name} onChange={(v) => set({ name: v })} />
        <div className="col">
          <span className="small muted strong">Photo (facultative)</span>
          {photo && <img className="recipe-photo" src={photo} alt="" />}
          <div className="row wrap">
            <label className="btn secondary small">
              <Icon name="photo" size={18} />{photo ? 'Changer' : 'Ajouter une photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { setPhoto(await resizeImage(file)); setPhotoChanged(true); } catch { toast('Image illisible'); } }} />
            </label>
            {photo && <Btn small variant="ghost" onClick={() => { setPhoto(undefined); setPhotoChanged(true); }}>Retirer</Btn>}
          </div>
        </div>
        <div className="col">
          <span className="small muted strong">Catégories</span>
          <div className="row wrap">
            {CATS.map((c) => {
              const on = r.categories.includes(c.value);
              return <button key={c.value} type="button" className={`chip ${on ? 'sage' : ''}`} style={{ border: 0, padding: '8px 12px', cursor: 'pointer' }} aria-pressed={on} onClick={() => set({ categories: on ? r.categories.filter((x) => x !== c.value) : [...r.categories, c.value] })}>{c.label}</button>;
            })}
          </div>
        </div>
        <div className="grid3">
          <NumberField label="Portions" value={r.servings} min={1} max={50} onChange={(v) => set({ servings: v ?? 1 })} />
          <NumberField label="Prépa" suffix="min" value={r.prepMin} min={0} onChange={(v) => set({ prepMin: v ?? 0 })} />
          <NumberField label="Cuisson" suffix="min" value={r.cookMin} min={0} onChange={(v) => set({ cookMin: v ?? 0 })} />
        </div>
      </Card>

      <Card>
        <CardHead icon="list" title="Ingrédients (pour la recette entière)" />
        <p className="tiny muted">Indique l’état de pesée : sec (pâtes, riz, lentilles…), cru (viande, poisson, pommes de terre), égoutté (conserves), partie comestible (fruits / légumes épluchés).</p>
        <datalist id="ing-list">{Object.values(catalog).map((i) => <option key={i.name} value={i.name} />)}</datalist>
        {r.ingredients.map((i, k) => (
          <div key={k} className="col" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
            <div className="row">
              <input className="input grow" list="ing-list" placeholder="ex. carotte" value={i.name} onChange={(e) => setIng(k, { name: e.target.value })} aria-label="Nom de l’ingrédient" />
              <button className="icon-btn plain" aria-label="Retirer l’ingrédient" onClick={() => setR((x) => ({ ...x, ingredients: x.ingredients.filter((_, j) => j !== k) }))}><Icon name="trash" size={20} /></button>
            </div>
            <div className="row">
              <div style={{ width: 96 }}><NumberField value={i.qty || undefined} min={0} onChange={(v) => setIng(k, { qty: v ?? 0 })} ariaLabel={`Quantité de ${i.name || 'l’ingrédient'}`} placeholder="0" /></div>
              <select className="input sm" style={{ width: 84 }} value={i.unit} onChange={(e) => setIng(k, { unit: e.target.value as Unit })} aria-label="Unité">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <select className="input sm grow" value={i.state} onChange={(e) => setIng(k, { state: e.target.value as WeighState })} aria-label="État de pesée">
                {STATES.map((s) => <option key={s} value={s}>{s ? STATE_LABEL[s] : '—'}</option>)}
              </select>
            </div>
            <label className="row small"><input type="checkbox" checked={!!i.accomp} onChange={(e) => setIng(k, { accomp: e.target.checked || undefined })} />Accompagnement (riz, purée, salade…)</label>
          </div>
        ))}
        <Btn variant="secondary" icon="plus" onClick={() => set({ ingredients: [...r.ingredients, { name: '', qty: 0, unit: 'g', state: '' }] })}>Ajouter un ingrédient</Btn>
      </Card>

      <Card>
        <label className="field">Étapes (une par ligne)<textarea className="input" rows={6} value={stepsText} onChange={(e) => setStepsText(e.target.value)} /></label>
        <TextField label="Substitutions possibles" value={r.substitutions} onChange={(v) => set({ substitutions: v })} multiline />
      </Card>

      <Card>
        <CardHead icon="snow" title="Conservation & batch" />
        <Seg label="Mode batch" value={r.batchMode} options={[{ value: 'full', label: 'Cuire le dimanche' }, { value: 'prep', label: 'Préparer seulement' }]} onChange={(v) => set({ batchMode: v })} />
        <div className="grid2">
          <NumberField label="Frigo (jours max)" value={r.fridgeDays} min={0} max={7} onChange={(v) => set({ fridgeDays: v ?? 1 })} />
          <NumberField label="Congélation (mois)" value={r.freezerMonths} min={0} max={12} onChange={(v) => set({ freezerMonths: v ?? 0 })} />
        </div>
        <div className="list">
          <div className="list-item"><span className="grow">Se congèle bien</span><Toggle label="Se congèle bien" checked={r.freezable} onChange={(v) => set({ freezable: v })} /></div>
          <div className="list-item"><span className="grow">Recette rapide (soirs libres, week-end)</span><Toggle label="Recette rapide" checked={r.quick} onChange={(v) => set({ quick: v })} /></div>
          <div className="list-item"><span className="grow">Exclure de la génération automatique</span><Toggle label="Exclure de la génération" checked={!!r.excludeFromRotation} onChange={(v) => set({ excludeFromRotation: v })} /></div>
          <div className="list-item"><span className="grow">Quantités encore provisoires</span><Toggle label="Quantités provisoires" checked={r.provisional} onChange={(v) => set({ provisional: v })} /></div>
        </div>
        <TextField label="Notes de conservation" value={r.storageNotes} onChange={(v) => set({ storageNotes: v })} multiline />
      </Card>

      <Card>
        <CardHead icon="euro" title="Coût & nutrition (facultatif)" />
        <NumberField label="Coût réel de la recette entière (sinon estimé depuis tes prix)" suffix="€" value={r.manualCost} min={0} onChange={(v) => set({ manualCost: v })} />
        <div className="grid2">
          <NumberField label="kcal / portion" value={r.nutrition?.kcal} min={0} onChange={(v) => set({ nutrition: { ...r.nutrition, kcal: v } })} />
          <NumberField label="Protéines / portion" suffix="g" value={r.nutrition?.protein} min={0} onChange={(v) => set({ nutrition: { ...r.nutrition, protein: v } })} />
        </div>
      </Card>
      <Btn block onClick={save}>Enregistrer la recette</Btn>
    </div>
  );
}
