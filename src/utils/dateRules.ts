export type IncubationRule = {
  incubationDays: number;
  transferDay: number;
};

export type BatchDateResult = {
  transferDate: string | null;
  expectedHatchDate: string | null;
};

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

export function parseDateOnly(value?: string | null) {
  if (!value) return null;

  const match = dateOnlyPattern.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function isValidDateOnly(value?: string | null) {
  return Boolean(parseDateOnly(value));
}

export function formatDateForStorage(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatDateOnlyUTC(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function todayLocalDateOnly() {
  return formatDateForStorage(new Date());
}

export function dateOnlyToLocalDate(value?: string | null) {
  const date = parseDateOnly(value);
  if (!date) return null;
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function formatDateForDisplay(dateOnly?: string | null) {
  const date = parseDateOnly(dateOnly);
  if (!date) return '-';
  return `${pad2(date.getUTCDate())}.${pad2(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
}

export function addDays(dateOnly: string, days: number) {
  const date = parseDateOnly(dateOnly);
  if (!date || !Number.isFinite(days)) return null;

  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnlyUTC(date);
}

export function calculateBatchDates(incubationDate?: string | null, rule?: IncubationRule | null): BatchDateResult {
  if (!rule || !isValidDateOnly(incubationDate)) {
    return { transferDate: null, expectedHatchDate: null };
  }

  const transferDate = addDays(incubationDate as string, rule.transferDay);
  const expectedHatchDate = addDays(incubationDate as string, rule.incubationDays);

  return { transferDate, expectedHatchDate };
}

export const formatDateTR = formatDateForDisplay;
