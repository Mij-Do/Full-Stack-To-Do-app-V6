import {
  taskCreateSchema,
  taskEditFormSchema,
  taskToggleSchema,
  taskUpdateSchema,
  taskIdSchema,
} from '@/lib/validations/task';
import { describe, expect, it } from 'vitest';

describe('task validation schemas', () => {
  it('passes valid task creation payload', () => {
    const payload = {
      title: 'Write tests',
      body: 'Write unit tests for the todo app with Vitest.',
      completed: false,
    };

    expect(() => taskCreateSchema.parse(payload)).not.toThrow();
  });

  it('rejects invalid task creation payloads', () => {
    expect(() =>
      taskCreateSchema.parse({
        title: 'Valid title',
        body: 'too short',
        completed: false,
      })
    ).toThrow();

    expect(() =>
      taskCreateSchema.parse({
        title: 'Bad',
        body: 'Long enough body text.',
        completed: false,
      })
    ).toThrow();

    expect(() =>
      taskCreateSchema.parse({
        title: 'Valid title',
        body: 'Long enough body text.',
        completed: true,
      })
    ).not.toThrow();
  });

  it('passes valid toggle payload', () => {
    const payload = { id: 'abc123', completed: true };
    expect(() => taskToggleSchema.parse(payload)).not.toThrow();
  });

  it('rejects toggle payload with missing values', () => {
    expect(() => taskToggleSchema.parse({ id: 'abc123' })).toThrow();
  });

  it('passes valid update payload', () => {
    const payload = {
      id: 'abc123',
      title: 'Updated title',
      body: 'Updated body string is long enough.',
      completed: true,
    };

    expect(() => taskUpdateSchema.parse(payload)).not.toThrow();
  });

  it('rejects invalid update payloads', () => {
    expect(() =>
      taskUpdateSchema.parse({
        id: 'abc123',
        title: 'No',
        body: 'Long enough body text.',
        completed: false,
      })
    ).toThrow();

    expect(() =>
      taskUpdateSchema.parse({
        id: 'abc123',
        title: 'Valid title',
        body: 'x'.repeat(101),
        completed: false,
      })
    ).toThrow();
  });

  it('keeps an explicitly cleared description as an empty string on update', () => {
    const parsed = taskUpdateSchema.parse({
      id: 'abc123',
      title: 'Valid title',
      body: '',
      completed: false,
    });

    expect(parsed.body).toBe('');
  });

  it('allows legacy descriptions shorter than 10 characters on update', () => {
    const parsed = taskUpdateSchema.parse({
      id: 'abc123',
      title: 'Valid title',
      body: 'short',
      completed: false,
    });

    expect(parsed.body).toBe('short');
    expect(() =>
      taskUpdateSchema.parse({ id: 'abc123', title: 'Valid title', body: 'short', completed: false })
    ).not.toThrow();
  });

  it('treats an omitted description as undefined on update', () => {
    const parsed = taskUpdateSchema.parse({
      id: 'abc123',
      title: 'Valid title',
      completed: true,
    });

    expect(parsed.body).toBeUndefined();
  });

  it('applies the same description rules on the edit form schema', () => {
    expect(taskEditFormSchema.parse({ title: 'Valid title', body: '', completed: false }).body).toBe('');
    expect(
      taskEditFormSchema.parse({ title: 'Valid title', body: 'short', completed: false }).body
    ).toBe('short');
    expect(
      taskEditFormSchema.parse({ title: 'Valid title', completed: true }).body
    ).toBeUndefined();
    expect(
      taskEditFormSchema.safeParse({ title: 'Valid title', body: 'x'.repeat(101), completed: false })
        .success
    ).toBe(false);
    expect(taskEditFormSchema.safeParse({ title: 'No', completed: false }).success).toBe(false);
  });

  it('passes valid delete payload', () => {
    expect(() => taskIdSchema.parse({ id: 'abc123' })).not.toThrow();
  });
});
