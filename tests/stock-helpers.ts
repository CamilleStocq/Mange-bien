import type { AppData } from '../src/store/types';
export function ensureWeekIn(d: AppData, monday: string) {
  d.weeks[monday] ??= { batchChecks: {}, shoppingChecks: {}, manualItems: [], realPrices: {}, extraPortions: {} };
}
