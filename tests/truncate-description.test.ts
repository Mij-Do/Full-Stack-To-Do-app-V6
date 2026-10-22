import { describe, expect, it } from 'vitest';
import { DESCRIPTION_PREVIEW_MAX_LENGTH, truncateDescription } from '@/lib/utils';

describe('truncateDescription', () => {
  it('returns an empty string unchanged', () => {
    expect(truncateDescription('')).toBe('');
  });

  it('returns descriptions below the limit unchanged', () => {
    expect(truncateDescription('Short description')).toBe('Short description');
    expect(truncateDescription('a'.repeat(49))).toBe('a'.repeat(49));
  });

  it('returns a description of exactly 50 characters without an ellipsis', () => {
    const description = 'x'.repeat(DESCRIPTION_PREVIEW_MAX_LENGTH);
    const result = truncateDescription(description);
    expect(result).toBe(description);
    expect(result).toHaveLength(DESCRIPTION_PREVIEW_MAX_LENGTH);
  });

  it('truncates 51 characters to the first 50 plus an ellipsis', () => {
    const description = 'y'.repeat(51);
    const result = truncateDescription(description);
    expect(result).toBe(`${'y'.repeat(50)}...`);
    expect(result).toHaveLength(53);
  });

  it('truncates 100 characters to the first 50 plus an ellipsis', () => {
    const description = 'z'.repeat(100);
    expect(truncateDescription(description)).toBe(`${'z'.repeat(50)}...`);
  });

  it('does not mutate the original description', () => {
    const description = 'q'.repeat(100);
    const snapshot = description.slice(0);
    truncateDescription(description);
    expect(description).toBe(snapshot);
    expect(description).toHaveLength(100);
  });
});
