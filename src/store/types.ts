// Modèle de données de l’application « Mange bien ! ». Toutes les dates « jour » sont au format ISO YYYY-MM-DD
// et s'entendent dans le fuseau Europe/Brussels. Les heures sont au format HH:MM.

export type ISODate = string;
export type HHMM = string;

/** Unités de saisie. Les cuillères et pincées sont converties en ml / g pour rester additionnables. */
export type Unit = 'g' | 'ml' | 'pièce';

/** État dans lequel une quantité est pesée. */
export type WeighState = '' | 'cru' | 'sec' | 'cuit' | 'égoutté' | 'comestible';

export type Aisle =
  | 'fruits-legumes'
  | 'feculents'
  | 'proteines'
  | 'laitiers'
  | 'conserves'
  | 'surgeles'
  | 'epicerie'
  | 'autres';

export interface IngredientLine {
  name: string;
  qty: number;
  unit: Unit;
  state: WeighState;
  /** Accompagnement à préparer à part (riz, purée, salade…) */
  accomp?: boolean;
  note?: string;
}

export type RecipeCategory = 'plat' | 'vegetarien' | 'salade' | 'autre';

/** full = cuire intégralement le dimanche ; prep = laver/couper/préportionner seulement, cuisson le jour même */
export type BatchMode = 'full' | 'prep';

export interface Recipe {
  id: string;
  name: string;
  categories: RecipeCategory[];
  photo?: string; // data URL compressée, facultative
  servings: number;
  prepMin: number;
  cookMin: number;
  ingredients: IngredientLine[];
  steps: string[];
  substitutions: string;
  /** Coût saisi manuellement pour la recette entière. Sinon calculé depuis le catalogue de prix. */
  manualCost?: number;
  /** Valeurs saisies par portion (sinon estimation depuis le catalogue) */
  nutrition?: { kcal?: number; protein?: number };
  fridgeDays: number;
  freezable: boolean;
  freezerMonths: number;
  storageNotes: string;
  batchMode: BatchMode;
  /** Recette rapide à cuisiner le jour même (soirée libre, week-end) */
  quick: boolean;
  /** Quantités non encore confirmées par l'utilisatrice */
  provisional: boolean;
  /** Exclue de la génération automatique (reste utilisable manuellement) */
  excludeFromRotation?: boolean;
}

export interface IngredientInfo {
  name: string;
  aisle: Aisle;
  /** Prix estimé, par kg (g), par litre (ml) ou par pièce */
  price?: number;
  /** Format vendu en magasin (ex. 500 g, 1 000 ml, 12 pièces) : on achète un nombre entier de formats */
  pack?: { qty: number; unit: Unit };
  /** Repères nutritionnels approximatifs pour 100 g / 100 ml / 1 pièce */
  kcal?: number;
  protein?: number;
}

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type MealKind = 'recipe' | 'breakfast' | 'free' | 'restaurant' | 'custom';
export type MealStatus = 'prévu' | 'préparé' | 'mangé' | 'remplacé' | 'reporté';
/** Origine de la portion : batch (cuisiné le dimanche), fresh (cuisiné le jour même), stock (déjà au congélateur), leftover (restes) */
export type MealSource = 'batch' | 'fresh' | 'stock' | 'leftover';
/** Où la portion batch est stockée en attendant d'être mangée */
export type Storage = 'fridge' | 'freezer';

export interface MealEntry {
  id: string;
  date: ISODate;
  slot: MealSlot;
  kind: MealKind;
  recipeId?: string;
  customName?: string;
  portions: number;
  source: MealSource;
  storage?: Storage;
  status: MealStatus;
  time?: HHMM; // surcharge de l'horaire habituel
  note?: string;
  /** repas ajouté hors planning */
  unplanned?: boolean;
}

export interface DaySchedule {
  /** 0 = lundi … 6 = dimanche */
  day: number;
  wake: HHMM;
  work?: { start: HHMM; end: HHMM };
  coaching?: { start: HHMM; end: HHMM };
  lunch: HHMM;
  dinner: HHMM;
  bed: HHMM;
  note: string;
  /** Collation facultative proposée ce jour-là */
  snack?: HHMM;
}

export interface BreakfastItem {
  id: string;
  name: string;
  qty: number;
  unit: Unit;
  state: WeighState;
  hint: string;
}

export type NotifCategory =
  | 'morning'
  | 'breakfast'
  | 'lunchPack'
  | 'dinner'
  | 'snack'
  | 'defrost'
  | 'prepEve'
  | 'batch'
  | 'batchRemaining'
  | 'shopping'
  | 'leftovers'
  | 'sport'
  | 'recovery'
  | 'pain'
  | 'weigh'
  | 'progress'
  | 'hydration'
  | 'encouragement';

export interface NotifRule {
  enabled: boolean;
  /** Heure fixe (HH:MM) ou décalage en minutes par rapport à un repère, selon la catégorie */
  time?: HHMM;
  offsetMin?: number;
  day?: number; // 0 = lundi … 6 = dimanche, pour les rappels hebdomadaires
  times?: HHMM[]; // hydratation
}

export interface NotifPrefs {
  rules: Record<NotifCategory, NotifRule>;
  pausedUntil?: ISODate; // suspendre tous les rappels jusqu'à cette date incluse
  quietStart: HHMM; // pas de rappel entre quietStart et quietEnd
  quietEnd: HHMM;
  /** Masque les noms de repas dans les messages envoyés via le serveur */
  discreet: boolean;
}

export interface PushState {
  deviceId: string;
  token: string;
  subscribed: boolean;
  lastSync?: string; // ISO datetime
  lastError?: string;
  syncedUntil?: ISODate;
}

export type AuthStatus = 'inconnu' | 'autorisé' | 'restreint' | 'non autorisé';
export type ActivityKey = 'natation' | 'velo' | 'course' | 'renforcement' | 'mobilite' | 'marche';

export interface Authorization {
  status: AuthStatus;
  note: string;
  updatedOn?: ISODate;
}

export type SessionStatus = 'prévue' | 'faite' | 'reportée' | 'repos';

export interface SportSession {
  id: string;
  date: ISODate;
  time: HHMM;
  activity: ActivityKey;
  durationMin: number;
  intensity: 'très douce' | 'douce' | 'modérée';
  status: SessionStatus;
  notes: string;
  painAfter?: number;
}

export interface PainEntry {
  id: string;
  date: ISODate;
  zone: string;
  intensity: number; // 0-10
  notes: string;
  redFlags: string[];
}

export interface ProNote {
  id: string;
  date: ISODate;
  author: string; // kiné, médecin, moi
  text: string;
}

export interface ResumeStage {
  id: string;
  title: string;
  sessionsPerWeek: number;
  maxMinutes: number;
  intensity: 'très douce' | 'douce' | 'modérée';
  notes: string;
}

export interface SportState {
  phase: 'recuperation' | 'reprise';
  authorizations: Record<ActivityKey, Authorization>;
  nextEvaluation?: ISODate;
  restrictions: string;
  notes: ProNote[];
  sessions: SportSession[];
  pain: PainEntry[];
  resumeValidatedOn?: ISODate;
  resumeValidatedBy?: string;
  stages: ResumeStage[];
  currentStage: number;
}

export interface WeightEntry {
  id: string;
  date: ISODate;
  kg: number;
  note?: string;
}

export interface Measurement {
  id: string;
  date: ISODate;
  waist?: number;
  hips?: number;
  thigh?: number;
  arm?: number;
}

export interface ShoppingManual {
  id: string;
  name: string;
  qty: string;
  aisle: Aisle;
  price?: number;
}

export interface WeekMeta {
  batchChecks: Record<string, boolean>;
  shoppingChecks: Record<string, boolean>;
  manualItems: ShoppingManual[];
  realPrices: Record<string, number>;
  /** Portions supplémentaires cuisinées pour le congélateur, par recette */
  extraPortions?: Record<string, number>;
  /** Batch terminé : portions supplémentaires ajoutées au congélateur */
  batchDone?: boolean;
  /** Total réellement payé (ticket de caisse), prioritaire sur la somme des prix réels */
  realTotal?: number;
  weighing?: 'ignoré';
  /** Pesée reportée : redemander à partir de cette date */
  weighPostponedTo?: ISODate;
}

export interface FreezerItem {
  id: string;
  recipeId?: string;
  name: string;
  portions: number;
  frozenOn: ISODate;
}

export interface Profile {
  heightCm?: number;
  startWeightKg?: number;
  /** Début du programme : aucun repas ni suivi n'est proposé avant cette date */
  startDate: ISODate;
  targetWeightKg?: number;
  targetDate?: ISODate;
  planEnd?: ISODate;
  hideWeightOnHome: boolean;
}

export interface AppData {
  version: number;
  onboardingDone: boolean;
  /** Clés des informations confirmées pendant la configuration ; les autres sont « provisoires » */
  confirmed: Record<string, boolean>;
  profile: Profile;
  schedule: DaySchedule[];
  breakfast: BreakfastItem[];
  /** Non défini tant que l'utilisatrice ne l'a pas saisi */
  weeklyBudget?: number;
  saturdayDinner: 'restaurant' | 'free' | 'planned';
  maxFridgeDays: number;
  batchStart: HHMM;
  weighDay: number;
  weighReminders: boolean;
  hydration: { goalMl: number; log: Record<ISODate, { t: string; ml: number }[]>; keepHistory: boolean };
  notif: NotifPrefs;
  push: PushState;
  recipes: Recipe[];
  ingredients: Record<string, IngredientInfo>;
  /** Ingrédients déjà en stock : quantité possédée (même unité que les recettes) ou « tout » */
  pantry: Record<string, { qty?: number; all?: boolean }>;
  meals: MealEntry[];
  weeks: Record<ISODate, WeekMeta>;
  freezer: FreezerItem[];
  sport: SportState;
  weights: WeightEntry[];
  measurements: Measurement[];
  rotation: number;
  theme: 'auto' | 'light' | 'dark';
  liquidDisplay: 'ml' | 'auto';
}
