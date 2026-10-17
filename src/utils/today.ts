import { todayLocalDateOnly } from './dateRules';

export function todayDateOnly() {
  return todayLocalDateOnly();
}

export function isTodayOrPast(dateOnly?: string | null) {
  if (!dateOnly) return false;
  return dateOnly <= todayDateOnly();
}
