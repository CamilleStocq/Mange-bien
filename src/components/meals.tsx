import { useMemo, useState } from 'react';
import type { AppData, MealEntry, MealSlot, MealSource, MealStatus } from '../store/types';
import { addMeal, deleteMeal, getData, updateMeal, useData } from '../store/store';
import { SLOT_LABEL, equivalentRecipes, mealId } from '../lib/planning';
import { formatQty, ingredientKey, recipeCost, STATE_LABEL, formatEuro } from '../lib/units';
import { addDays, formatHHMM, formatShort, shiftHHMM, weekdayIndex } from '../lib/dates';
import { Btn, Icon, Provisional, Seg, Sheet, Stepper, TextField, toast, confirmAsk } from './ui';

export const STATUS_LIST: MealStatus[] = ['prévu', 'préparé', 'mangé', 'remplacé', 'reporté'];
const STATUS_TONE: Record<MealStatus, string> = { prévu: '', préparé: 'sky', mangé: 'sage', remplacé: 'peach', reporté: 'rose' };

export function mealTime(m: MealEntry, data: AppData): string {
  if (m.time) return m.time;
  const s = data.schedule[weekdayIndex(m.date)];
  if (m.slot === 'breakfast') return shiftHHMM(s.wake, 20);
  if (m.slot === 'lunch') return s.lunch;
  if (m.slot === 'snack') return s.snack ?? '16:00';
  return s.dinner;
}

export function mealTitle(m: MealEntry, data: AppData): string {
  if (m.kind === 'breakfast') return 'Petit-déjeuner habituel';
  if (m.kind === 'restaurant') return 'Restaurant';
  if (m.kind === 'free') return 'Repas libre';
  if (m.kind === 'custom') return m.customName || 'Repas';
  return data.recipes.find((r) => r.id === m.recipeId)?.name ?? 'Recette supprimée';
}

export function SourceChip({ m }: { m: MealEntry }) {
  if (m.kind !== 'recipe') return null;
  if (m.source === 'batch' && m.storage === 'freezer') return <span className="chip sky"><Icon name="snow" size={14} />batch · congélateur</span>;
  if (m.source === 'batch') return <span className="chip sage"><Icon name="fridge" size={14} />batch · frigo</span>;
  if (m.source === 'stock') return <span className="chip sky"><Icon name="snow" size={14} />stock congélateur</span>;
  if (m.source === 'leftover') return <span className="chip peach">restes</span>;
  return <span className="chip peach"><Icon name="pot" size={14} />à cuisiner le jour même</span>;
}

/** Quantités d'une portion de repas (recette mise à l'échelle, ou petit-déjeuner). */
export function MealQuantities({ m, data, max = 20 }: { m: MealEntry; data: AppData; max?: number }) {
  if (m.kind === 'breakfast') {
    return (
      <div className="meal-qty">
        <ul>
          {data.breakfast.map((b) => (
            <li key={b.id}>
              {b.name} : <strong>{formatQty(b.qty * m.portions, b.unit, data.liquidDisplay)}</strong>
              {b.state && ` (${STATE_LABEL[b.state]})`}
              {b.hint && <span className="muted"> — {b.hint}</span>}
            </li>
          ))}
        </ul>
        {!data.confirmed.breakfast && <Provisional />}
      </div>
    );
  }
  if (m.kind !== 'recipe') return m.note ? <div className="meal-qty">{m.note}</div> : null;
  const r = data.recipes.find((x) => x.id === m.recipeId);
  if (!r) return null;
  const f = m.portions / Math.max(1, r.servings);
  const main = r.ingredients.filter((i) => !i.accomp);
  const acc = r.ingredients.filter((i) => i.accomp);
  return (
    <div className="meal-qty">
      <ul>
        {main.slice(0, max).map((i, k) => (
          <li key={k}>
            {i.name} : <strong>{formatQty(i.qty * f, i.unit, data.liquidDisplay)}</strong>
            {i.state && ` (${STATE_LABEL[i.state]})`}
          </li>
        ))}
      </ul>
      {acc.length > 0 && (
        <>
          <div className="tiny strong" style={{ marginTop: 4 }}>Accompagnement</div>
          <ul>
            {acc.map((i, k) => (
              <li key={k}>
                {i.name} : <strong>{formatQty(i.qty * f, i.unit, data.liquidDisplay)}</strong>
                {i.state && ` (${STATE_LABEL[i.state]})`}
              </li>
            ))}
          </ul>
        </>
      )}
      {r.provisional && <Provisional />}
    </div>
  );
}

export function MealCard({ m, expanded: initial = false }: { m: MealEntry; expanded?: boolean }) {
  const data = useData((d) => d);
  const [open, setOpen] = useState(initial);
  const [edit, setEdit] = useState(false);
  const title = mealTitle(m, data);
  const done = m.status === 'mangé';
  return (
    <div className={`meal status-${m.status}`}>
      <div className="meal-body">
        <div className="meal-head">
          <span className="meal-time">{formatHHMM(mealTime(m, data))}</span>
          <span className="tiny muted strong">{SLOT_LABEL[m.slot]}{m.portions !== 1 ? ` · ${String(m.portions).replace('.', ',')} portions` : ''}</span>
        </div>
        <div className="meal-name">
          {m.kind === 'recipe' && m.recipeId ? <a href={`#/recette/${m.recipeId}`}>{title}</a> : title}
        </div>
        <div className="row wrap">
          <SourceChip m={m} />
          {m.status !== 'prévu' && <span className={`chip ${STATUS_TONE[m.status]}`}>{m.status}</span>}
          {m.unplanned && <span className="chip">ajouté</span>}
        </div>
        {open && <MealQuantities m={m} data={data} />}
        {m.note && m.kind === 'recipe' && <div className="small muted">{m.note}</div>}
        <div className="row wrap meal-actions">
          {(m.kind === 'recipe' || m.kind === 'breakfast') && (
            <Btn variant="ghost" small onClick={() => setOpen(!open)} aria-expanded={open}>
              {open ? 'Masquer' : 'Quantités'}
            </Btn>
          )}
          <Btn
            variant={done ? 'secondary' : 'ghost'}
            small
            icon="check"
            aria-pressed={done}
            onClick={() => {
              updateMeal(m.id, { status: done ? 'prévu' : 'mangé' });
              if (!done) toast('Noté 🌿');
            }}
          >
            {done ? 'Mangé' : 'Mangé ?'}
          </Btn>
          <Btn variant="ghost" small icon="edit" onClick={() => setEdit(true)}>
            Modifier
          </Btn>
        </div>
      </div>
      {edit && <MealEditor meal={m} onClose={() => setEdit(false)} />}
    </div>
  );
}

const SLOT_OPTIONS: { value: MealSlot; label: string }[] = [
  { value: 'breakfast', label: 'Petit-déj.' },
  { value: 'lunch', label: 'Déjeuner' },
  { value: 'snack', label: 'Collation' },
  { value: 'dinner', label: 'Dîner' }
];

/** Modifier / remplacer / reporter / supprimer un repas, ou en ajouter un nouveau. */
export function MealEditor({ meal, date, slot, onClose }: { meal?: MealEntry; date?: string; slot?: MealSlot; onClose: () => void }) {
  const data = useData((d) => d);
  const isNew = !meal;
  const [draft, setDraft] = useState<MealEntry>(
    meal ?? { id: mealId(), date: date!, slot: slot ?? 'dinner', kind: 'custom', customName: '', portions: 1, source: 'fresh', status: 'prévu', unplanned: true }
  );
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'main' | 'replace' | 'move'>('main');
  const [moveDate, setMoveDate] = useState(addDays(draft.date, 1));
  const [moveSlot, setMoveSlot] = useState<MealSlot>(draft.slot);
  const current = data.recipes.find((r) => r.id === draft.recipeId);
  const owned = useMemo(() => new Set(Object.entries(data.pantry).filter(([, v]) => v.all || (v.qty ?? 0) > 0).map(([k]) => k)), [data.pantry]);
  const suggestions = useMemo(() => {
    const list = equivalentRecipes(current, data.recipes, owned, (r) => recipeCost(r, data.ingredients).perPortion);
    const q = ingredientKey(search);
    return q ? list.filter((r) => ingredientKey(r.name).includes(q) || r.ingredients.some((i) => ingredientKey(i.name).includes(q))) : list;
  }, [current, data.recipes, data.ingredients, owned, search]);
  const set = (p: Partial<MealEntry>) => setDraft((d) => ({ ...d, ...p }));

  const save = () => {
    if (draft.kind === 'custom' && !draft.customName?.trim()) {
      toast('Donne un nom à ce repas');
      return;
    }
    if (draft.kind === 'recipe' && !draft.recipeId) {
      toast('Choisis une recette');
      return;
    }
    if (isNew) {
      addMeal(draft);
      toast('Repas ajouté');
    } else {
      updateMeal(draft.id, draft);
      toast('Repas mis à jour');
    }
    onClose();
  };

  if (mode === 'replace') {
    return (
      <Sheet title="Remplacer par…" onClose={onClose}>
        <input className="input" placeholder="Rechercher une recette ou un ingrédient" value={search} onChange={(e) => setSearch(e.target.value)} />
        <p className="small muted">Classement : recettes du même type, ingrédients déjà en stock, puis coût par portion.</p>
        <div className="list">
          {suggestions.map((r) => {
            const c = recipeCost(r, data.ingredients);
            return (
              <button
                key={r.id}
                className="link-row"
                onClick={() => {
                  const prev = current?.name ?? mealTitle(draft, data);
                  const next: MealEntry = { ...draft, kind: 'recipe', recipeId: r.id, note: isNew ? draft.note : `Remplace : ${prev}`, source: draft.source === 'stock' || draft.source === 'leftover' ? 'fresh' : draft.source };
                  if (isNew) setDraft(next);
                  else {
                    updateMeal(draft.id, { kind: 'recipe', recipeId: r.id, note: next.note, source: next.source });
                    toast(`Remplacé par ${r.name}`);
                    onClose();
                    return;
                  }
                  setMode('main');
                }}
              >
                <div className="grow">
                  <div className="strong">{r.name}</div>
                  <div className="tiny muted">
                    {r.batchMode === 'full' ? 'batch' : 'à cuisiner le jour même'} · ≈ {formatEuro(c.perPortion)}/portion · {r.prepMin + r.cookMin} min
                  </div>
                </div>
                <Icon name="chevron" />
              </button>
            );
          })}
        </div>
        <Btn variant="ghost" onClick={() => setMode('main')}>Retour</Btn>
      </Sheet>
    );
  }

  if (mode === 'move') {
    return (
      <Sheet title="Reporter ce repas" onClose={onClose}>
        <p className="small">Tu choisis : déplacer ce repas à une autre date, ou simplement le retirer du planning.</p>
        <label className="field">
          Nouvelle date
          <input className="input" type="date" value={moveDate} onChange={(e) => e.target.value && setMoveDate(e.target.value)} />
        </label>
        <Seg label="Moment" value={moveSlot} options={SLOT_OPTIONS} onChange={setMoveSlot} />
        <Btn
          onClick={() => {
            updateMeal(draft.id, { date: moveDate, slot: moveSlot, status: 'prévu' });
            toast(`Déplacé au ${formatShort(moveDate)}`);
            onClose();
          }}
        >
          Déplacer
        </Btn>
        <Btn
          variant="secondary"
          onClick={() => {
            updateMeal(draft.id, { status: 'reporté' });
            toast('Marqué comme reporté');
            onClose();
          }}
        >
          Marquer « reporté » sans le déplacer
        </Btn>
        <Btn
          variant="danger"
          icon="trash"
          onClick={() => {
            deleteMeal(draft.id);
            toast('Repas retiré du planning');
            onClose();
          }}
        >
          Le supprimer du planning
        </Btn>
        <Btn variant="ghost" onClick={() => setMode('main')}>Retour</Btn>
      </Sheet>
    );
  }

  return (
    <Sheet title={isNew ? 'Ajouter un repas' : mealTitle(draft, data)} onClose={onClose}>
      {isNew && <p className="small muted">Un repas imprévu fait partie de la vie : il s’ajoute simplement au planning.</p>}
      <div className="col">
        <span className="small muted strong">Type</span>
        <Seg
          label="Type de repas"
          value={draft.kind}
          options={[
            { value: 'recipe', label: 'Recette' },
            { value: 'breakfast', label: 'Petit-déj.' },
            { value: 'custom', label: 'Autre' },
            { value: 'free', label: 'Libre' },
            { value: 'restaurant', label: 'Resto' }
          ]}
          onChange={(k) => set({ kind: k })}
        />
      </div>
      {draft.kind === 'recipe' && (
        <div className="card">
          <div className="row between">
            <div className="grow">
              <div className="strong">{current?.name ?? 'Aucune recette choisie'}</div>
              {current && <div className="tiny muted">{current.servings} portions dans la recette</div>}
            </div>
            <Btn small variant="secondary" icon="swap" onClick={() => setMode('replace')}>
              {current ? 'Remplacer' : 'Choisir'}
            </Btn>
          </div>
        </div>
      )}
      {draft.kind === 'custom' && <TextField label="Nom du repas" value={draft.customName ?? ''} onChange={(v) => set({ customName: v })} placeholder="ex. sandwich, soupe maison…" />}
      {isNew && (
        <>
          <label className="field">
            Date
            <input className="input" type="date" value={draft.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
          </label>
          <Seg label="Moment" value={draft.slot} options={SLOT_OPTIONS} onChange={(s) => set({ slot: s })} />
        </>
      )}
      <div className="row between">
        <span>Portions</span>
        <Stepper label="Portions" value={draft.portions} min={0.5} max={12} step={0.5} onChange={(v) => set({ portions: v })} />
      </div>
      {draft.kind === 'recipe' && (
        <label className="field">
          Origine de la portion
          <select className="input" value={draft.source} onChange={(e) => set({ source: e.target.value as MealSource })}>
            <option value="batch">Batch du dimanche</option>
            <option value="fresh">Cuisiné le jour même</option>
            <option value="stock">Stock du congélateur</option>
            <option value="leftover">Restes</option>
          </select>
          <span className="tiny muted">Stock du congélateur et restes ne sont pas ajoutés aux courses.</span>
        </label>
      )}
      {!isNew && (
        <div className="col">
          <span className="small muted strong">Statut</span>
          <div className="row wrap">
            {STATUS_LIST.map((s) => (
              <button key={s} type="button" className={`chip ${draft.status === s ? 'sage' : ''}`} style={{ border: 0, padding: '8px 12px', cursor: 'pointer' }} aria-pressed={draft.status === s} onClick={() => set({ status: s })}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="field">
        Heure (laisser vide = horaire habituel)
        <input className="input" type="time" value={draft.time ?? ''} onChange={(e) => set({ time: e.target.value || undefined })} />
      </label>
      <TextField label="Note" value={draft.note ?? ''} onChange={(v) => set({ note: v })} />
      <Btn onClick={save} block>{isNew ? 'Ajouter' : 'Enregistrer'}</Btn>
      {!isNew && (
        <div className="grid2">
          <Btn variant="secondary" icon="swap" onClick={() => setMode('replace')}>Remplacer</Btn>
          <Btn variant="secondary" icon="calendar" onClick={() => setMode('move')}>Reporter</Btn>
        </div>
      )}
      {!isNew && (
        <Btn
          variant="danger"
          icon="trash"
          onClick={() => {
            if (confirmAsk('Supprimer ce repas du planning ?')) {
              deleteMeal(draft.id);
              onClose();
            }
          }}
        >
          Supprimer
        </Btn>
      )}
    </Sheet>
  );
}

export function useRecipeName() {
  return (id?: string) => getData().recipes.find((r) => r.id === id)?.name ?? '';
}
