import { describe, expect, it } from 'vitest';
import { dateOnlyToUtcDate, formatDateForInput, formatDueDate } from '@/lib/utils';

describe('due date utilities', () => {
  it('formats Date values and serialized timestamps for date inputs in UTC', () => {
    const dueDate = new Date('2026-03-08T00:00:00.000Z');

    expect(formatDateForInput(dueDate)).toBe('2026-03-08');
    expect(formatDateForInput('2026-03-08T00:00:00.000Z')).toBe('2026-03-08');
    expect(formatDateForInput('2026-03-08')).toBe('2026-03-08');
  });

  it('formats displayed dates in UTC and uses an em dash when absent', () => {
    expect(formatDueDate(new Date('2026-03-08T00:00:00.000Z'))).toBe('Mar 8, 2026');
    expect(formatDueDate(undefined)).toBe('—');
    expect(formatDueDate(null)).toBe('—');
  });

  it('converts a date-only value to UTC midnight', () => {
    expect(dateOnlyToUtcDate('2026-03-08').toISOString()).toBe('2026-03-08T00:00:00.000Z');
  });
});
