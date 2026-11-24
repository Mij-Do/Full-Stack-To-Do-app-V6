import { describe, expect, it } from 'vitest';
import { calculateNextRecurrenceDate } from '@/lib/recurrence';
import { MAX_RECURRENCE_INTERVAL } from '@/lib/validations/task';

describe('recurrence date calculation', () => {
  it('advances daily and weekly from the scheduled date by the configured interval', () => {
    expect(calculateNextRecurrenceDate(new Date('2026-01-01T00:00:00.000Z'), 'daily', 2, new Date('2026-01-02T18:00:00.000Z')))
      .toEqual(new Date('2026-01-05T00:00:00.000Z'));
    expect(calculateNextRecurrenceDate(new Date('2026-01-01T00:00:00.000Z'), 'weekly', 2, new Date('2026-01-01T12:00:00.000Z')))
      .toEqual(new Date('2026-01-15T00:00:00.000Z'));
  });

  it('clamps month ends and preserves the original monthly anchor', () => {
    const jan31 = new Date('2025-01-31T00:00:00.000Z');
    expect(calculateNextRecurrenceDate(jan31, 'monthly', 1, new Date('2025-02-01T00:00:00.000Z'), 31))
      .toEqual(new Date('2025-02-28T00:00:00.000Z'));
    expect(calculateNextRecurrenceDate(new Date('2024-01-31T00:00:00.000Z'), 'monthly', 1, new Date('2024-01-31T12:00:00.000Z'), 31))
      .toEqual(new Date('2024-02-29T00:00:00.000Z'));
    expect(calculateNextRecurrenceDate(jan31, 'monthly', 2, new Date('2025-02-01T00:00:00.000Z'), 31))
      .toEqual(new Date('2025-03-31T00:00:00.000Z'));
  });

  it('skips missed intervals and returns only the next future scheduled date', () => {
    expect(calculateNextRecurrenceDate(new Date('2026-01-01T00:00:00.000Z'), 'daily', 1, new Date('2026-01-10T18:00:00.000Z')))
      .toEqual(new Date('2026-01-11T00:00:00.000Z'));
    expect(calculateNextRecurrenceDate(new Date('2025-01-31T00:00:00.000Z'), 'monthly', 1, new Date('2025-04-01T00:00:00.000Z'), 31))
      .toEqual(new Date('2025-04-30T00:00:00.000Z'));
  });

  it('rejects non-positive or non-integer intervals', () => {
    expect(() => calculateNextRecurrenceDate(new Date('2026-01-01T00:00:00.000Z'), 'daily', 0)).toThrow();
    expect(() => calculateNextRecurrenceDate(new Date('2026-01-01T00:00:00.000Z'), 'weekly', 1.5)).toThrow();
    expect(() => calculateNextRecurrenceDate(new Date('2026-01-01T00:00:00.000Z'), 'daily', MAX_RECURRENCE_INTERVAL + 1)).toThrow();
  });

  it('uses the shifted due date and updated monthly anchor for the next schedule', () => {
    expect(calculateNextRecurrenceDate(
      new Date('2025-01-15T00:00:00.000Z'),
      'monthly',
      1,
      new Date('2025-02-01T00:00:00.000Z'),
      15,
    )).toEqual(new Date('2025-02-15T00:00:00.000Z'));
    expect(calculateNextRecurrenceDate(
      new Date('2025-01-30T00:00:00.000Z'),
      'monthly',
      1,
      new Date('2025-02-01T00:00:00.000Z'),
      30,
    )).toEqual(new Date('2025-02-28T00:00:00.000Z'));
  });
});
