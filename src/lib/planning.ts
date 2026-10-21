import type { AppData, MealEntry, MealSlot, Recipe, Storage } from '../store/types';
import { addDays, DAY_NAMES, diffDays, todayISO, weekDays, weekdayIndex } from './dates';
import { EFFORT_NOTE, GOOD_RECOVERY, recoveryNeeds, recoveryScore } from './recovery';
import { freezerFree } from './freezer';

let counter = 0;
export function mealId(): string {
  counter = (counter + 1) % 1_000_000;
  return `m${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation (facultative)',
  dinner: 'Dîner'
};
export const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** Le batch cooking d'une semaine (lundi → dimanche) a lieu le dimanche qui précède. */
export function batchDayFor(monday: string): string {
  return addDays(monday, -1);
}

/** Les repas « actifs » comptent pour les courses et le batch (pas remplacés / reportés). */
export function isActive(m: MealEntry): boolean {
  return m.status !== 'remplacé' && m.status !== 'reporté';
}

export function mealsOfWeek(meals: MealEntry[], monday: string): MealEntry[] {
  const end = addDays(monday, 6);
  return meals.filter((m) => m.date >= monday && m.date <= end);
}

export function mealsOfDay(meals: MealEntry[], date: string): MealEntry[] {
  return meals
    .filter((m) => m.date === date)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
}

/** Où stocker une portion cuisinée le dimanche et mangée à `date`. */
export function storageFor(recipe: Recipe, monday: string, date: string, maxFridgeDays: number): { source: 'batch' | 'fresh'; storage?: Storage } {
  const daysAfterBatch = diffDays(date, batchDayFor(monday));
  const fridgeLimit = Math.min(recipe.fridgeDays, maxFridgeDays);
  if (daysAfterBatch <= fridgeLimit) return { source: 'batch', storage: 'fridge' };
  if (recipe.freezable) return { source: 'batch', storage: 'freezer' };
  return { source: 'fresh' };
}

/** Recettes cuisinées (batch ou le jour même) la semaine précédente et la semaine suivante. */
export function recentlyCooked(data: AppData, monday: string): Set<string> {
  const from = addDays(monday, -7);
  const to = addDays(monday, 13);
  const out = new Set<string>();
  for (const m of data.meals) {
    if (m.kind !== 'recipe' || !m.recipeId || (m.source !== 'fresh' && m.source !== 'batch')) continue;
    if ((m.date >= from && m.date < monday) || (m.date > addDays(monday, 6) && m.date <= to)) out.add(m.recipeId);
  }
  return out;
}

/** Choisit n éléments répartis dans la liste (pas consécutifs) pour varier les semaines. */
function pick<T>(list: T[], rot: number, n: number): T[] {
  if (!list.length) return [];
  const stride = Math.max(1, Math.floor(list.length / n));
  const out: T[] = [];
  for (let k = 0; out.length < Math.min(n, list.length) && k < list.length * 2; k++) {
    const item = list[(rot + k * stride + Math.floor(k / n)) % list.length];
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

export interface GenerateResult {
  meals: MealEntry[];
  rotation: number;
}

/**
 * Génère une semaine type à partir de TES recettes (aucune recette inventée) :
 * - petit-déjeuner habituel chaque jour ;
 * - midis : TOUJOURS un repas déjà prêt — les restes du dîner de la veille (ou de l'avant-veille),
 *   sinon une portion du batch du dimanche (frigo ou congélateur). On ne cuisine jamais à midi ;
 * - soirs de coaching : une portion du batch, prête à réchauffer ;
 * - autres soirs : on cuisine une recette rapide en 2 portions, la 2e devient un midi (restes) ;
 * - samedi soir : restaurant / repas libre si configuré.
 * Après une séance de sport (ou de coaching), le repas suivant est choisi pour aider à récupérer.
 * Le dîner cuisiné le dimanche précédent peut fournir le déjeuner du lundi : ce repas (dans `data.meals`)
 * passe alors à 2 portions.
 */
export function generateWeek(data: AppData, monday: string): GenerateResult {
  // Jamais le même plat cuisiné deux fois en deux semaines : on écarte ceux de la semaine d'avant (et d'après, si déjà planifiée).
  const recent = recentlyCooked(data, monday);
  const fresh = (pool: Recipe[], n: number) => {
    const ok = pool.filter((r) => !recent.has(r.id));
    return ok.length >= n ? ok : pool;
  };
  const recipes = data.recipes.filter((r) => !r.excludeFromRotation);
  const batchPool = fresh(recipes.filter((r) => r.batchMode === 'full' && !r.quick), 3);
  const quickPool = fresh(recipes.filter((r) => r.quick), 7);
  const rot = data.rotation;
  const days = weekDays(monday);
  const meals: MealEntry[] = [];
  const base = { portions: 1, status: 'prévu' as const };
  const start = data.profile?.startDate;
  const planned = (date: string) => !start || date >= start;

  for (const date of days) {
    meals.push({ ...base, id: mealId(), date, slot: 'breakfast', kind: 'breakfast', source: 'fresh' });
    const sched = data.schedule[weekdayIndex(date)];
    if (sched?.snack) {
      meals.push({ ...base, id: mealId(), date, slot: 'snack', kind: 'custom', customName: 'Collation facultative avant le coaching', source: 'fresh', note: 'Selon ta faim : un fruit + un yaourt, ou une tartine, ou une poignée de noix.' });
    }
  }

  // Récupération : le repas qui suit une séance doit aider le corps à récupérer.
  const needs = recoveryNeeds(data, days);
  const needAt = (date: string, slot: MealSlot) => needs.find((n) => n.date === date && n.slot === slot);
  const score = (r: Recipe, date: string, slot: MealSlot) => {
    const need = needAt(date, slot);
    return need ? recoveryScore(r, need.effort, data) : 0;
  };
  const suits = (r: Recipe, date: string, slot: MealSlot) => !needAt(date, slot) || score(r, date, slot) >= GOOD_RECOVERY;
  const recoveryFields = (r: Recipe, date: string, slot: MealSlot): Partial<MealEntry> => {
    const need = needAt(date, slot);
    return need && recoveryScore(r, need.effort, data) >= GOOD_RECOVERY ? { recovery: need.effort, note: EFFORT_NOTE[need.effort] } : {};
  };

  // 1. Soirs sans coaching : on cuisine (2 portions si la recette le permet).
  const satDinner = data.saturdayDinner;
  const cookDays = days.map((_, i) => i).filter((i) => !data.schedule[i]?.coaching && !(i === 5 && satDinner !== 'planned'));
  const freshPool = quickPool.length ? quickPool : batchPool;
  const quick = pick(freshPool, rot, cookDays.length);
  const cooks: MealEntry[] = [];
  const cooked = new Set<string>();
  cookDays.forEach((dayIdx, i) => {
    const date = days[dayIdx];
    let recipe = quick[i % Math.max(1, quick.length)];
    if (!recipe) return;
    if (cooked.has(recipe.id)) recipe = freshPool.find((r) => !cooked.has(r.id)) ?? recipe; // un plat différent chaque soir
    if (needAt(date, 'dinner') && !suits(recipe, date, 'dinner')) {
      // une recette qui aide à récupérer, pas encore cuisinée cette semaine de préférence
      const fits = (pool: Recipe[]) => pool.find((r) => !cooked.has(r.id) && suits(r, date, 'dinner'));
      const b = fits(quick) ?? fits(freshPool) ?? [...freshPool].sort((a, c) => score(c, date, 'dinner') - score(a, date, 'dinner'))[0];
      if (score(b, date, 'dinner') > score(recipe, date, 'dinner')) recipe = b;
    }
    cooked.add(recipe.id);
    const m: MealEntry = { ...base, id: mealId(), date, slot: 'dinner', kind: 'recipe', recipeId: recipe.id, source: 'fresh', ...recoveryFields(recipe, date, 'dinner') };
    meals.push(m);
    cooks.push(m);
  });

  // 2. Midis couverts par les restes du dîner de la veille (ou de l'avant-veille).
  const lunchTaken = new Set<string>();
  const keepFor = (r: Recipe) => (r.servings >= 2 ? Math.min(2, r.fridgeDays) : 0);
  const giveLeftover = (cook: MealEntry, r: Recipe) => {
    for (let k = 1; k <= keepFor(r); k++) {
      const date = addDays(cook.date, k);
      const idx = days.indexOf(date);
      if (idx < 0 || lunchTaken.has(date) || !suits(r, date, 'lunch')) continue;
      lunchTaken.add(date);
      cook.portions = 2;
      const when = k === 1 ? 'demain midi' : `${DAY_NAMES[idx]} midi`;
      const before = (cook.note ?? '').replace(/ ?Cuisine 2 portions : [^.]*\./, '');
      cook.note = [before, `Cuisine 2 portions : mets la 2e en boîte au frigo pour ${when}.`].filter(Boolean).join(' ');
      meals.push({
        ...base, id: mealId(), date, slot: 'lunch', kind: 'recipe', recipeId: r.id, source: 'leftover', leftoverOf: cook.id, ...recoveryFields(r, date, 'lunch'),
        note: [`Restes du dîner de ${DAY_NAMES[weekdayIndex(cook.date)]} : la boîte est prête au frigo.`, recoveryFields(r, date, 'lunch').note].filter(Boolean).join(' ')
      });
      return;
    }
  };
  // Dîner cuisiné le dimanche précédent (semaine déjà planifiée) → déjeuner du lundi.
  const prevSunday = data.meals.find((m) => m.date === addDays(monday, -1) && m.slot === 'dinner' && m.kind === 'recipe' && m.source === 'fresh' && m.status === 'prévu' && m.portions <= 2);
  const prevRecipe = prevSunday && data.recipes.find((r) => r.id === prevSunday.recipeId);
  if (prevSunday && prevRecipe && planned(days[0])) giveLeftover(prevSunday, prevRecipe);
  for (const cook of cooks) {
    const r = data.recipes.find((x) => x.id === cook.recipeId);
    if (r && planned(cook.date)) giveLeftover(cook, r);
  }
  // Week-end : un midi sans restes se cuisine (pas de portion du batch) ; sa 2e portion peut servir le lendemain midi.
  for (const dayIdx of [5, 6]) {
    const date = days[dayIdx];
    if (lunchTaken.has(date)) continue;
    let recipe = freshPool.find((r) => !cooked.has(r.id) && suits(r, date, 'lunch')) ?? freshPool.find((r) => !cooked.has(r.id));
    if (!recipe) continue;
    cooked.add(recipe.id);
    lunchTaken.add(date);
    const m: MealEntry = { ...base, id: mealId(), date, slot: 'lunch', kind: 'recipe', recipeId: recipe.id, source: 'fresh', ...recoveryFields(recipe, date, 'lunch') };
    meals.push(m);
    if (planned(date)) giveLeftover(m, recipe);
  }

  // 3. Tout le reste (midis sans restes, soirs de coaching) : portions du batch du dimanche.
  const batchSlots: [number, MealSlot][] = [];
  days.forEach((date, i) => {
    if (!lunchTaken.has(date)) batchSlots.push([i, 'lunch']);
    if (data.schedule[i]?.coaching && !(i === 5 && satDinner !== 'planned')) batchSlots.push([i, 'dinner']);
  });
  const batch = pick(batchPool, rot, 3);
  // Au moins une recette du batch doit convenir si des séances tombent sur ces repas.
  const batchNeeds = needs.filter((n) => batchSlots.some(([d, s]) => days[d] === n.date && s === n.slot));
  if (batchNeeds.length && batch.length && !batch.some((r) => batchNeeds.some((n) => recoveryScore(r, n.effort, data) >= GOOD_RECOVERY))) {
    const e = batchNeeds[0].effort;
    const candidate = batchPool.filter((r) => !batch.includes(r)).sort((a, b) => recoveryScore(b, e, data) - recoveryScore(a, e, data))[0];
    if (candidate && recoveryScore(candidate, e, data) >= GOOD_RECOVERY) batch[batch.length - 1] = candidate;
  }
  const ready = (r: Recipe, date: string) => storageFor(r, monday, date, data.maxFridgeDays).source === 'batch';
  // Un plat qui ne tient sur aucun de ces repas (ni frigo ni congélateur) est remplacé par un plat qui se congèle.
  batch.forEach((r, k) => {
    if (batchSlots.some(([d]) => ready(r, days[d]))) return;
    const rotated = batchPool.map((_, j) => batchPool[(rot * 3 + j) % batchPool.length]);
    const alt = rotated.find((x) => !batch.includes(x) && batchSlots.some(([d]) => ready(x, days[d])));
    if (alt) batch[k] = alt;
  });
  // Plats qui ne se congèlent pas en premier : ils se mangent en début de semaine, tant qu'ils tiennent au frigo.
  batch.sort((x, y) => Number(x.freezable) - Number(y.freezable) || (x.freezable ? 0 : x.fridgeDays - y.fridgeDays));
  const uses = new Map<string, number>();
  batchSlots.forEach(([dayIdx, slot], i) => {
    const date = days[dayIdx];
    // en alternance pour varier, mais toujours une portion prête (frigo ou congélateur), jamais « à cuisiner »
    const order = batch.map((_, k) => batch[(i + k) % batch.length]);
    let recipe = order.find((r) => ready(r, date)) ?? batchPool.find((r) => ready(r, date)) ?? order[0];
    if (!recipe) return;
    if (needAt(date, slot) && !suits(recipe, date, slot)) {
      // parmi les plats du batch qui aident à récupérer, le moins servi jusqu'ici
      const fit = batch.filter((r) => ready(r, date) && suits(r, date, slot)).sort((x, y) => (uses.get(x.id) ?? 0) - (uses.get(y.id) ?? 0))[0];
      if (fit) recipe = fit;
    }
    uses.set(recipe.id, (uses.get(recipe.id) ?? 0) + 1);
    meals.push({ ...base, id: mealId(), date, slot, kind: 'recipe', recipeId: recipe.id, ...storageFor(recipe, monday, date, data.maxFridgeDays), ...recoveryFields(recipe, date, slot) });
  });

  if (satDinner !== 'planned') {
    meals.push({ ...base, id: mealId(), date: days[5], slot: 'dinner', kind: satDinner, source: 'fresh', note: 'Profite de ton repas. Le planning continue normalement demain, sans rien compenser.' });
  }

  return { meals: meals.filter((m) => planned(m.date)), rotation: rot + 1 };
}

/** Premier jour à planifier : aujourd'hui, ou la date de début du programme si elle est à venir. */
export function planningFrom(data: AppData, today: string): string {
  const start = data.profile?.startDate;
  return start && start > today ? start : today;
}

/** Vrai tant que le programme n'a pas commencé. */
export function beforeStart(data: AppData, date: string): boolean {
  const start = data.profile?.startDate;
  return !!start && date < start;
}

/** Recalcule frigo / congélateur d'un repas batch après un déplacement ou un changement de recette. */
export function refreshStorage(meal: MealEntry, recipe: Recipe | undefined, maxFridgeDays: number): MealEntry {
  if (meal.kind !== 'recipe' || !recipe || meal.source !== 'batch') return { ...meal, storage: undefined };
  const monday = addDays(meal.date, -weekdayIndex(meal.date));
  const s = storageFor(recipe, monday, meal.date, maxFridgeDays);
  return { ...meal, source: s.source, storage: s.storage };
}

/** Recettes équivalentes pour remplacer un repas, triées par pertinence. */
export function equivalentRecipes(current: Recipe | undefined, all: Recipe[], ownedKeys: Set<string>, costOf: (r: Recipe) => number): Recipe[] {
  const keyOf = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const score = (r: Recipe) => {
    let s = 0;
    if (current) {
      if (r.batchMode === current.batchMode) s += 2;
      if (r.quick === current.quick) s += 1;
      if (r.categories.some((c) => current.categories.includes(c))) s += 1;
    }
    const owned = r.ingredients.filter((i) => ownedKeys.has(keyOf(i.name))).length;
    s += owned / Math.max(1, r.ingredients.length);
    s -= costOf(r) / 10;
    return s;
  };
  return all.filter((r) => r.id !== current?.id).sort((a, b) => score(b) - score(a));
}

// ---------- Recalcul après un changement (repas modifié, séance ajoutée, horaires…) ----------

const LEFTOVER_COOK_NOTE = / ?Cuisine 2 portions : [^.]*\./g;
const EFFORT_NOTES = Object.values(EFFORT_NOTE);
const stripEffort = (note?: string) => {
  let n = note ?? '';
  for (const e of EFFORT_NOTES) n = n.split(e).join('');
  return n.replace(/\s+/g, ' ').trim() || undefined;
};
const joinNotes = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ') || undefined;

/** Empreinte de ce qui influence restes et récupération, pour savoir quelles semaines recalculer. */
export function planSignature(d: AppData): { meals: Map<string, string>; dates: Map<string, string>; sessions: string; global: string } {
  const meals = new Map<string, string>();
  const dates = new Map<string, string>();
  for (const m of d.meals) {
    meals.set(m.id, [m.date, m.slot, m.kind, m.recipeId, m.source, m.status, m.pinned ? 1 : 0].join('|'));
    dates.set(m.id, m.date);
  }
  const sessions = d.sport.sessions.map((s) => [s.id, s.date, s.time, s.activity, s.durationMin, s.status].join('|')).sort().join(';');
  const global = JSON.stringify([d.schedule.map((s) => [s.coaching, s.lunch, s.dinner]), d.recipes.map((r) => [r.id, r.servings, r.fridgeDays, r.quick])]);
  return { meals, dates, sessions, global };
}

/** Semaines à recalculer entre deux états (à partir de la semaine en cours). */
export function changedWeeks(before: ReturnType<typeof planSignature>, d: AppData, today = todayISO()): string[] {
  const after = planSignature(d);
  const current = addDays(today, -weekdayIndex(today));
  const out = new Set<string>();
  const add = (date?: string) => {
    if (!date) return;
    const w = addDays(date, -weekdayIndex(date));
    if (w >= current) out.add(w);
    // un dîner du dimanche peut fournir le déjeuner du lundi suivant
    if (weekdayIndex(date) === 6 && addDays(w, 7) >= current) out.add(addDays(w, 7));
  };
  for (const [id, sig] of after.meals) if (before.meals.get(id) !== sig) { add(after.dates.get(id)); add(before.dates.get(id)); }
  for (const [id] of before.meals) if (!after.meals.has(id)) add(before.dates.get(id));
  if (before.sessions !== after.sessions) for (const s of d.sport.sessions) add(s.date);
  if (before.global !== after.global) for (const m of d.meals) add(m.date);
  return [...out].sort();
}

/**
 * Remet une semaine en cohérence après un changement, sans toucher à ce que tu as choisi toi-même
 * (repas modifiés à la main, ajoutés hors planning, déjà mangés ou passés) :
 * 1. récupération : le repas qui suit une séance aide à récupérer (étiquette et note mises à jour) ;
 * 2. restes : la portion gardée suit le plat cuisiné la veille ; si ce plat disparaît, le midi reçoit
 *    une portion du batch (le midi reste toujours un repas prêt) ;
 * 3. un plat cuisiné le soir fournit le midi suivant quand c'est possible ; il est cuisiné en 2 portions.
 */
export function rebalanceWeek(d: AppData, monday: string, today = todayISO()): void {
  const days = weekDays(monday);
  const sunday = days[6];
  const inWeek = d.meals.filter((m) => m.date >= monday && m.date <= sunday);
  const recipeOf = (m: MealEntry) => d.recipes.find((r) => r.id === m.recipeId);
  const auto = (m: MealEntry) => m.kind === 'recipe' && m.status === 'prévu' && !m.pinned && !m.unplanned && m.date >= today;
  const needs = recoveryNeeds(d, days);
  const needAt = (date: string, slot: MealSlot) => needs.find((n) => n.date === date && n.slot === slot);
  const recent = recentlyCooked(d, monday);
  const cookedThisWeek = new Set(inWeek.filter((m) => m.kind === 'recipe' && m.source === 'fresh' && isActive(m)).map((m) => m.recipeId!));
  const batchRecipes = [...new Set(inWeek.filter((m) => m.source === 'batch' && m.recipeId).map((m) => m.recipeId!))]
    .map((id) => d.recipes.find((r) => r.id === id)!)
    .filter(Boolean);
  const readyOn = (r: Recipe, date: string) => storageFor(r, monday, date, d.maxFridgeDays).source === 'batch';
  const uses = (id: string) => inWeek.filter((m) => m.recipeId === id && isActive(m)).length;
  const toBatch = (m: MealEntry, r: Recipe) => {
    m.recipeId = r.id;
    m.source = 'batch';
    m.storage = storageFor(r, monday, m.date, d.maxFridgeDays).storage;
    delete m.leftoverOf;
    delete m.cookEve;
  };
  // Le batch du dimanche est déjà cuisiné : on ne peut plus y ajouter ni y échanger de portions.
  const batchCooked = today > batchDayFor(monday) || (today === batchDayFor(monday) && !!d.weeks[monday]?.batchDone);
  const anyReady = (date: string) =>
    batchRecipes.filter((x) => readyOn(x, date)).sort((a, b) => uses(a.id) - uses(b.id))[0] ??
    d.recipes.find((x) => x.batchMode === 'full' && !x.quick && !x.excludeFromRotation && x.freezable && readyOn(x, date));
  /**
   * Un midi qui doit être prêt : restes d'un dîner encore à cuisiner la veille (ou l'avant-veille),
   * sinon portion du batch (s'il n'est pas encore cuisiné), sinon portion du congélateur,
   * sinon plat à préparer la veille au soir.
   */
  const placeLunch = (m: MealEntry) => {
    const note = (text?: string) => {
      m.note = joinNotes(text, m.recovery ? EFFORT_NOTE[m.recovery] : undefined);
      if (!m.note) delete m.note;
    };
    for (let k = 1; k <= 2; k++) {
      const cook = d.meals.find((x) => x.date === addDays(m.date, -k) && x.slot === 'dinner' && x.kind === 'recipe' && x.source === 'fresh' && x.status === 'prévu' && x.date >= today && !d.meals.some((l) => l !== m && l.leftoverOf === x.id && isActive(l)));
      const cr = cook && recipeOf(cook);
      if (!cook || !cr || cr.servings < 2 || k > Math.min(2, cr.fridgeDays)) continue;
      m.recipeId = cr.id;
      m.source = 'leftover';
      m.leftoverOf = cook.id;
      delete m.storage;
      delete m.cookEve;
      note(`Restes du dîner de ${DAY_NAMES[weekdayIndex(cook.date)]} : la boîte est prête au frigo.`);
      return;
    }
    const alt = batchCooked ? undefined : anyReady(m.date);
    if (alt) { toBatch(m, alt); note(); return; }
    const frozen = d.freezer.find((f) => !!f.recipeId && freezerFree(d, f.recipeId, today, m) > 0);
    if (frozen) {
      m.recipeId = frozen.recipeId;
      m.source = 'stock';
      delete m.storage;
      delete m.leftoverOf;
      delete m.cookEve;
      note('Portion déjà au congélateur : la sortir la veille au soir.');
      return;
    }
    m.source = 'fresh';
    m.cookEve = true;
    delete m.storage;
    delete m.leftoverOf;
    note('À préparer la veille au soir et emporter en boîte : pas de cuisine le midi.');
  };

  // 1. Récupération après le sport.
  for (const m of inWeek) {
    if (m.kind !== 'recipe' || !isActive(m)) continue;
    let r = recipeOf(m);
    if (!r) continue;
    const need = needAt(m.date, m.slot);
    if (need && recoveryScore(r, need.effort, d) < GOOD_RECOVERY && auto(m)) {
      if (m.source === 'fresh') {
        const alt = d.recipes.find((x) => x.quick && !x.excludeFromRotation && !recent.has(x.id) && !cookedThisWeek.has(x.id) && recoveryScore(x, need.effort, d) >= GOOD_RECOVERY);
        if (alt) {
          cookedThisWeek.delete(r.id);
          cookedThisWeek.add(alt.id);
          m.recipeId = alt.id;
          r = alt;
        }
      } else if (m.source === 'batch' && !batchCooked) {
        const alt = batchRecipes.filter((x) => readyOn(x, m.date) && recoveryScore(x, need.effort, d) >= GOOD_RECOVERY).sort((a, b) => uses(a.id) - uses(b.id))[0];
        if (alt) {
          toBatch(m, alt);
          r = alt;
        }
      }
    }
    const fits = !!need && recoveryScore(r, need.effort, d) >= GOOD_RECOVERY;
    if (fits) m.recovery = need!.effort;
    else delete m.recovery;
    m.note = joinNotes(stripEffort(m.note), fits ? EFFORT_NOTE[need!.effort] : undefined);
    if (!m.note) delete m.note;
  }

  // Midis du lundi au vendredi : jamais à cuisiner le midi même.
  for (const m of inWeek) {
    if (m.slot !== 'lunch' || weekdayIndex(m.date) > 4 || m.kind !== 'recipe' || m.source !== 'fresh' || m.cookEve || !auto(m)) continue;
    placeLunch(m);
  }

  // 2. Restes : toujours rattachés à un plat cuisiné la veille ou l'avant-veille.
  const byId = new Map(d.meals.map((m) => [m.id, m]));
  for (const l of inWeek.filter((m) => m.source === 'leftover' && m.leftoverOf)) {
    const cook = byId.get(l.leftoverOf!);
    const cr = cook && recipeOf(cook);
    const gap = cook ? diffDays(l.date, cook.date) : 99;
    const ok = !!cook && !!cr && cook.kind === 'recipe' && cook.source === 'fresh' && isActive(cook) && cr.servings >= 2 && gap >= 1 && gap <= Math.min(2, cr.fridgeDays);
    if (ok) {
      if (l.status === 'prévu' && l.recipeId !== cr!.id) l.recipeId = cr!.id;
      continue;
    }
    if (!auto(l)) { delete l.leftoverOf; continue; }
    // le dîner d'origine a changé ou disparu : le midi reste un repas prêt
    delete l.leftoverOf;
    placeLunch(l);
  }

  // 3. Plats cuisinés le soir : 2 portions quand la 2e a un midi, sinon 1.
  const cooks = d.meals.filter((m) => m.date >= addDays(monday, -1) && m.date <= sunday && m.kind === 'recipe' && m.source === 'fresh' && m.slot === 'dinner' && isActive(m));
  for (const cook of cooks) {
    const cr = recipeOf(cook);
    let linked = d.meals.filter((l) => l.leftoverOf === cook.id && isActive(l));
    if (!linked.length && cr && cr.servings >= 2 && cook.date >= today && cook.status === 'prévu') {
      // un midi encore libre (ou une portion du batch pas encore cuisinée) reçoit la 2e portion
      for (let k = 1; k <= Math.min(2, cr.fridgeDays) && !linked.length; k++) {
        const date = addDays(cook.date, k);
        if (date > sunday) break;
        const lunch = d.meals.find((m) => m.date === date && m.slot === 'lunch' && m.status === 'prévu');
        const batchNotCooked = today < batchDayFor(addDays(date, -weekdayIndex(date)));
        if (lunch && !(auto(lunch) && lunch.source === 'batch' && batchNotCooked)) continue;
        if (needAt(date, 'lunch') && recoveryScore(cr, needAt(date, 'lunch')!.effort, d) < GOOD_RECOVERY) continue;
        const l: MealEntry = lunch ?? { id: mealId(), date, slot: 'lunch', kind: 'recipe', portions: 1, source: 'leftover', status: 'prévu' };
        l.recipeId = cr.id;
        l.source = 'leftover';
        delete l.storage;
        l.leftoverOf = cook.id;
        l.note = `Restes du dîner de ${DAY_NAMES[weekdayIndex(cook.date)]} : la boîte est prête au frigo.`;
        if (!lunch) d.meals.push(l);
        linked = [l];
      }
    }
    const want = 1 + linked.length;
    if (cook.status === 'prévu' && cook.portions <= 2) cook.portions = want;
    const base = (cook.note ?? '').replace(LEFTOVER_COOK_NOTE, '').trim();
    const l = linked[0];
    const when = l ? (diffDays(l.date, cook.date) === 1 ? 'demain midi' : `${DAY_NAMES[weekdayIndex(l.date)]} midi`) : '';
    cook.note = joinNotes(base || undefined, l ? `Cuisine 2 portions : mets la 2e en boîte au frigo pour ${when}.` : undefined);
    if (!cook.note) delete cook.note;
  }
}

// ---------- Vérification : chaque repas est cuisiné à un moment précis ----------

export interface CookingIssue { mealId: string; date: string; slot: MealSlot; problem: string }

/**
 * Chaque repas prévu doit avoir un moment où il est réellement cuisiné :
 * - « à cuisiner » : le jour même, jamais un midi du lundi au vendredi ;
 * - restes : un dîner cuisiné la veille ou l'avant-veille, en assez de portions ;
 * - batch : une recette cuite entièrement le dimanche, au frigo ou au congélateur selon sa conservation ;
 * - congélateur : une portion réellement présente dans l'inventaire.
 */
export function cookingIssues(d: AppData, monday: string): CookingIssue[] {
  const out: CookingIssue[] = [];
  const meals = d.meals.filter((m) => m.date >= monday && m.date <= addDays(monday, 6) && m.kind === 'recipe' && isActive(m));
  const issue = (m: MealEntry, problem: string) => out.push({ mealId: m.id, date: m.date, slot: m.slot, problem });
  for (const m of meals) {
    const r = d.recipes.find((x) => x.id === m.recipeId);
    if (!r) { issue(m, 'recette introuvable'); continue; }
    if (m.source === 'fresh') {
      if (m.slot === 'lunch' && weekdayIndex(m.date) < 5 && !m.cookEve) issue(m, 'midi de semaine à cuisiner');
    } else if (m.source === 'leftover') {
      const cook = d.meals.find((x) => x.id === m.leftoverOf);
      const cr = cook && d.recipes.find((x) => x.id === cook.recipeId);
      const gap = cook ? diffDays(m.date, cook.date) : 0;
      if (!cook || !cr || !isActive(cook) || cook.kind !== 'recipe' || cook.source !== 'fresh') issue(m, 'restes sans dîner cuisiné');
      else if (cook.recipeId !== m.recipeId) issue(m, 'restes d’un autre plat');
      else if (gap < 1 || gap > Math.min(2, cr.fridgeDays)) issue(m, 'restes gardés trop longtemps');
      else if (cook.portions < 1 + d.meals.filter((x) => x.leftoverOf === cook.id && isActive(x)).length) issue(m, 'pas assez de portions cuisinées');
    } else if (m.source === 'batch') {
      if (r.batchMode !== 'full') issue(m, 'recette non cuite au batch');
      const s = storageFor(r, monday, m.date, d.maxFridgeDays);
      if (s.source !== 'batch') issue(m, 'portion du batch qui ne se conserve pas jusque-là');
      else if (m.storage !== s.storage) issue(m, 'frigo / congélateur incohérent');
    } else if (m.source === 'stock') {
      if (m.status === 'prévu' && freezerFree(d, m.recipeId!, m.date) < 0) issue(m, 'pas de portion au congélateur');
    }
  }
  return out;
}
