import { create } from 'zustand';
import { del, get, set } from 'idb-keyval';
import type { AppData, MealEntry, MealStatus, WeekMeta } from './types';
import { createDefaultData, migrate } from '../data/defaults';
import { generateWeek, mealsOfWeek, refreshStorage } from '../lib/planning';
import { todayISO } from '../lib/dates';

const KEY = 'mangebien:data';

interface AppState {
  data: AppData;
  hydrated: boolean;
  storageError?: string;
  /** Applique une modification sur une copie des données puis enregistre. */
  mutate: (fn: (d: AppData) => void) => void;
  replaceAll: (d: AppData) => void;
}

export const useApp = create<AppState>((setState, getState) => ({
  data: createDefaultData(),
  hydrated: false,
  mutate: (fn) => {
    const d = structuredClone(getState().data);
    fn(d);
    setState({ data: d });
  },
  replaceAll: (d) => setState({ data: d })
}));

export const useData = <T,>(sel: (d: AppData) => T): T => useApp((s) => sel(s.data));
export const mutate = (fn: (d: AppData) => void) => useApp.getState().mutate(fn);
export const getData = () => useApp.getState().data;

let saveTimer: ReturnType<typeof setTimeout> | undefined;
async function save() {
  saveTimer = undefined;
  try {
    await set(KEY, getData());
    if (useApp.getState().storageError) useApp.setState({ storageError: undefined });
  } catch (e) {
    useApp.setState({ storageError: 'Impossible d’enregistrer sur cet appareil (stockage plein ou bloqué). Pense à exporter tes données.' });
    console.error(e);
  }
}
export function flushSave() {
  if (saveTimer) clearTimeout(saveTimer);
  return save();
}

export async function loadData(): Promise<void> {
  try {
    const raw = await get(KEY);
    useApp.setState({ data: raw ? migrate(raw) : createDefaultData(), hydrated: true });
  } catch (e) {
    console.error(e);
    useApp.setState({ hydrated: true, storageError: 'Le stockage local est indisponible : tes modifications ne seront pas conservées. (Navigation privée ?)' });
  }
  useApp.subscribe((s, prev) => {
    if (s.data !== prev.data && s.hydrated) {
      // Enregistrement immédiat (regroupé par tâche) : rien n'est perdu si l'app est fermée juste après un geste.
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 0);
    }
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushSave();
    });
    // iPhone : fermer l'app en la balayant déclenche parfois seulement « pagehide ».
    window.addEventListener('pagehide', () => void flushSave());
  }
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* facultatif */
  }
}

export async function resetAll() {
  await del(KEY);
  useApp.setState({ data: createDefaultData() });
}

// ---------- Photos de recettes (stockées à part pour garder les données légères) ----------
export const photoKey = (recipeId: string) => `mangebien:photo:${recipeId}`;
export async function savePhoto(recipeId: string, dataUrl: string | undefined) {
  if (dataUrl) await set(photoKey(recipeId), dataUrl);
  else await del(photoKey(recipeId));
}
export const loadPhoto = (recipeId: string) => get<string>(photoKey(recipeId));

// ---------- Actions métier ----------

export function ensureWeek(d: AppData, monday: string): WeekMeta {
  if (!d.weeks[monday]) d.weeks[monday] = { batchChecks: {}, shoppingChecks: {}, manualItems: [], realPrices: {}, extraPortions: {} };
  return d.weeks[monday];
}

/** Génère la semaine si elle ne contient encore aucun repas. Retourne true si générée. */
export function generateWeekIfEmpty(monday: string): boolean {
  if (mealsOfWeek(getData().meals, monday).length) return false;
  mutate((d) => {
    const res = generateWeek(d, monday);
    d.meals.push(...res.meals);
    d.rotation = res.rotation;
    ensureWeek(d, monday);
  });
  return true;
}

/** Régénère une semaine : les repas déjà mangés / préparés / ajoutés à la main sont conservés. */
export function regenerateWeek(monday: string) {
  mutate((d) => {
    const inWeek = mealsOfWeek(d.meals, monday);
    const keep = inWeek.filter((m) => m.status !== 'prévu' || m.unplanned);
    const keepSlots = new Set(keep.map((m) => `${m.date}|${m.slot}`));
    d.meals = d.meals.filter((m) => !inWeek.includes(m) || keep.includes(m));
    const res = generateWeek(d, monday);
    d.meals.push(...res.meals.filter((m) => !keepSlots.has(`${m.date}|${m.slot}`)));
    d.rotation = res.rotation;
  });
}

export function updateMeal(id: string, patch: Partial<MealEntry>) {
  mutate((d) => {
    const i = d.meals.findIndex((m) => m.id === id);
    if (i < 0) return;
    let m = { ...d.meals[i], ...patch };
    if ('date' in patch || 'recipeId' in patch || 'source' in patch) {
      m = refreshStorage(m, d.recipes.find((r) => r.id === m.recipeId), d.maxFridgeDays);
    }
    d.meals[i] = m;
  });
}

export function setMealStatus(id: string, status: MealStatus) {
  updateMeal(id, { status });
}

export function deleteMeal(id: string) {
  mutate((d) => {
    d.meals = d.meals.filter((m) => m.id !== id);
  });
}

export function addMeal(m: MealEntry) {
  mutate((d) => {
    const recipe = d.recipes.find((r) => r.id === m.recipeId);
    d.meals.push(refreshStorage(m, recipe, d.maxFridgeDays));
  });
}

export function addWater(ml: number, date = todayISO()) {
  mutate((d) => {
    const log = d.hydration.log[date] ?? [];
    log.push({ t: new Date().toISOString(), ml });
    d.hydration.log[date] = log;
    if (!d.hydration.keepHistory) {
      for (const k of Object.keys(d.hydration.log)) if (k !== date) delete d.hydration.log[k];
    }
  });
}

export function undoWater(date = todayISO()) {
  mutate((d) => {
    d.hydration.log[date]?.pop();
  });
}
