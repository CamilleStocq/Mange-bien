import type { ActivityKey, AppData, Authorization, DaySchedule, NotifCategory, NotifRule } from '../store/types';
import { addDefaultPacks, defaultCatalog, refreshDefaultPrices } from './ingredients';
import { defaultRecipes } from './recipes';
import { todayISO } from '../lib/dates';

export const DATA_VERSION = 3;

export function randomId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Horaires neutres de départ : à compléter par l'utilisatrice pendant l'accueil. */
export function defaultSchedule(): DaySchedule[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, wake: day < 5 ? '07:00' : '08:30', lunch: '12:30', dinner: '19:00', bed: '22:30', note: '' }));
}

const rule = (r: Partial<NotifRule> & { enabled: boolean }): NotifRule => r;

export function defaultNotifRules(): Record<NotifCategory, NotifRule> {
  return {
    morning: rule({ enabled: true, offsetMin: 10 }),
    breakfast: rule({ enabled: false, offsetMin: 25 }),
    lunchPack: rule({ enabled: true, offsetMin: 30 }),
    dinner: rule({ enabled: true, offsetMin: 60 }),
    snack: rule({ enabled: true }),
    defrost: rule({ enabled: true, time: '20:30' }),
    prepEve: rule({ enabled: true, time: '20:00' }),
    batch: rule({ enabled: true, offsetMin: 30 }),
    batchRemaining: rule({ enabled: true, time: '17:00' }),
    shopping: rule({ enabled: true, day: 5, time: '10:00' }),
    leftovers: rule({ enabled: true, day: 3, time: '18:30' }),
    sport: rule({ enabled: true, offsetMin: 30 }),
    recovery: rule({ enabled: true, time: '10:00' }),
    pain: rule({ enabled: false, time: '21:30' }),
    weigh: rule({ enabled: true, offsetMin: 15 }),
    progress: rule({ enabled: false, day: 6, time: '19:00' }),
    hydration: rule({ enabled: true, times: ['10:30', '15:00'] }),
    encouragement: rule({ enabled: false, time: '13:15' })
  };
}

const ACTIVITIES: ActivityKey[] = ['natation', 'velo', 'course', 'renforcement', 'mobilite', 'marche'];

export function createDefaultData(today = todayISO()): AppData {
  const authorizations = Object.fromEntries(
    ACTIVITIES.map((a) => [a, { status: 'inconnu', note: '' } satisfies Authorization])
  ) as Record<ActivityKey, Authorization>;
  return {
    version: DATA_VERSION,
    onboardingDone: false,
    confirmed: {},
    profile: {
      startDate: today,
      hideWeightOnHome: true
    },
    schedule: defaultSchedule(),
    breakfast: [],
    saturdayDinner: 'planned',
    maxFridgeDays: 3,
    batchStart: '14:30',
    weighDay: 6,
    weighReminders: true,
    hydration: { goalMl: 1800, log: {}, keepHistory: true },
    notif: { rules: defaultNotifRules(), quietStart: '22:30', quietEnd: '05:30', discreet: false },
    push: { deviceId: randomId(), token: randomId() + randomId(), subscribed: false },
    recipes: defaultRecipes(),
    ingredients: defaultCatalog(),
    pantry: { 'epices': { all: true } },
    meals: [],
    weeks: {},
    freezer: [],
    sport: {
      phase: 'recuperation',
      authorizations,
      restrictions: '',
      notes: [],
      sessions: [],
      pain: [],
      stages: [
        { id: 's1', title: 'Étape 1 — Reprise très douce', sessionsPerWeek: 2, maxMinutes: 20, intensity: 'très douce', notes: 'Uniquement les activités autorisées. Aucune douleur pendant la séance ni dans les 24 h qui suivent.' },
        { id: 's2', title: 'Étape 2 — Consolidation', sessionsPerWeek: 3, maxMinutes: 30, intensity: 'douce', notes: 'À valider avec ton kiné avant de passer à cette étape.' },
        { id: 's3', title: 'Étape 3 — Retour progressif aux trois disciplines', sessionsPerWeek: 3, maxMinutes: 40, intensity: 'douce', notes: 'La course à pied ne revient que si elle est explicitement autorisée.' },
        { id: 's4', title: 'Étape 4 — Construction triathlon', sessionsPerWeek: 4, maxMinutes: 50, intensity: 'modérée', notes: 'Volume et intensité à fixer avec ton professionnel de santé / entraîneur.' }
      ],
      currentStage: 0
    },
    weights: [],
    measurements: [],
    rotation: 0,
    theme: 'auto',
    liquidDisplay: 'auto'
  };
}

/** Complète des données anciennes / importées avec les champs manquants. */
export function migrate(raw: unknown): AppData {
  const base = createDefaultData();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Partial<AppData>;
  const merged: AppData = {
    ...base,
    ...d,
    profile: { ...base.profile, ...d.profile },
    notif: {
      ...base.notif,
      ...d.notif,
      rules: { ...base.notif.rules, ...(d.notif?.rules ?? {}) }
    },
    hydration: { ...base.hydration, ...d.hydration },
    push: { ...base.push, ...d.push },
    sport: {
      ...base.sport,
      ...d.sport,
      authorizations: { ...base.sport.authorizations, ...(d.sport?.authorizations ?? {}) }
    },
    version: DATA_VERSION
  };
  if (!Array.isArray(merged.schedule) || merged.schedule.length !== 7) merged.schedule = base.schedule;
  // Version 2 : prix Colruyt relevés (octobre 2026), sans toucher aux prix saisis à la main.
  if ((d.version ?? 1) < 2 && merged.ingredients) {
    merged.ingredients = structuredClone(merged.ingredients);
    refreshDefaultPrices(merged.ingredients);
  }
  // Version 3 : formats vendus en magasin (la liste de courses achète des formats entiers).
  if ((d.version ?? 1) < 3 && merged.ingredients) {
    if ((d.version ?? 1) >= 2) merged.ingredients = structuredClone(merged.ingredients);
    addDefaultPacks(merged.ingredients);
    // Carottes achetées en vrac (format choisi) : prix du vrac plutôt que du sac de 2 kg, sauf prix saisi à la main.
    const carrot = merged.ingredients['carotte'];
    if (carrot?.price === 0.72) carrot.price = 1.09;
  }
  return merged;
}
