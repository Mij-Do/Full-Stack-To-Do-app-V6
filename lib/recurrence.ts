import { MAX_RECURRENCE_INTERVAL, type RecurrenceFrequency } from '@/lib/validations/task';

const DAY_MS = 24 * 60 * 60 * 1000;

const utcDateFromParts = (year: number, month: number, day: number): Date => {
  const result = new Date(0);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCFullYear(year, month, day);
  if (Number.isNaN(result.getTime())) throw new RangeError('Next recurrence date is outside the supported date range.');
  return result;
};

const utcDate = (value: Date): Date => {
  if (Number.isNaN(value.getTime())) throw new RangeError('Invalid recurrence date.');
  return utcDateFromParts(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
};

const dateInMonth = (monthIndex: number, day: number): Date => {
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12;
  const lastDay = utcDateFromParts(year, month + 1, 0).getUTCDate();
  return utcDateFromParts(year, month, Math.min(day, lastDay));
};

/** Calculates the first scheduled date after the current UTC calendar date. */
export const calculateNextRecurrenceDate = (
  scheduledDueDate: Date,
  frequency: RecurrenceFrequency,
  interval: number,
  now: Date = new Date(),
  monthlyAnchorDay = scheduledDueDate.getUTCDate(),
): Date => {
  if (!Number.isSafeInteger(interval) || interval < 1 || interval > MAX_RECURRENCE_INTERVAL) {
    throw new RangeError(`Recurrence interval must be between 1 and ${MAX_RECURRENCE_INTERVAL}.`);
  }

  const scheduled = utcDate(scheduledDueDate);
  const today = utcDate(now);

  if (frequency === 'daily' || frequency === 'weekly') {
    const stepDays = interval * (frequency === 'weekly' ? 7 : 1);
    const stepMs = stepDays * DAY_MS;
    const elapsed = Math.max(0, today.getTime() - scheduled.getTime());
    const steps = Math.max(1, Math.floor(elapsed / stepMs) + 1);
    const candidate = new Date(scheduled.getTime() + steps * stepMs);
    if (!Number.isSafeInteger(candidate.getTime())) throw new RangeError('Next recurrence date is outside the supported date range.');
    return candidate;
  }

  const startMonth = scheduled.getUTCFullYear() * 12 + scheduled.getUTCMonth();
  const currentMonth = today.getUTCFullYear() * 12 + today.getUTCMonth();
  let steps = Math.max(1, Math.floor((currentMonth - startMonth) / interval));
  let candidate = dateInMonth(startMonth + steps * interval, monthlyAnchorDay);
  if (candidate.getTime() <= today.getTime()) {
    steps += 1;
    candidate = dateInMonth(startMonth + steps * interval, monthlyAnchorDay);
  }
  return candidate;
};
