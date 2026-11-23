import {
  taskCreateSchema,
  taskEditFormSchema,
  taskToggleSchema,
  taskUpdateSchema,
  taskIdSchema,
  taskPrioritySchema,
  mongoObjectIdSchema,
  todoListIdSchema,
} from '@/lib/validations/task';
import { listCreateSchema, listIdActionSchema, listRenameSchema } from '@/lib/validations/list';
import { describe, expect, it } from 'vitest';

const todoId = '0123456789abcdef01234567';

describe('task validation schemas', () => {
  it('passes valid task creation payload', () => {
    const payload = {
      title: 'Write tests',
      body: 'Write unit tests for the todo app with Vitest.',
      completed: false,
    };

    expect(() => taskCreateSchema.parse(payload)).not.toThrow();
  });

  describe('List validation schemas', () => {
    it('trims List names and enforces non-empty and maximum length', () => {
      expect(listCreateSchema.parse({ name: '  Work  ' }).name).toBe('Work');
      expect(listCreateSchema.safeParse({ name: '   ' }).success).toBe(false);
      expect(listCreateSchema.safeParse({ name: 'a'.repeat(41) }).success).toBe(false);
      expect(listRenameSchema.safeParse({ id: '0123456789abcdef01234567', name: 'Renamed' }).success)
        .toBe(true);
    });

    it('rejects invalid List IDs in action payloads', () => {
      expect(todoListIdSchema.safeParse('not-an-object-id').success).toBe(false);
      expect(listIdActionSchema.safeParse({ id: 'not-an-object-id' }).success).toBe(false);
      expect(listRenameSchema.safeParse({ id: 'not-an-object-id', name: 'Valid' }).success).toBe(false);
    });
  });

  it('accepts valid MongoDB ObjectIds and rejects malformed values', () => {
    expect(mongoObjectIdSchema.parse(todoId)).toBe(todoId);

    for (const id of ['abc123', '0123456789abcdef0123456g', `${todoId}\n`]) {
      expect(mongoObjectIdSchema.safeParse(id).success).toBe(false);
    }
  });

  it('defaults creation priority to medium and treats an empty due date as absent', () => {
    expect(
      taskCreateSchema.parse({
        title: 'Write tests',
        completed: false,
        dueDate: '',
      })
    ).toMatchObject({ dueDate: undefined, priority: 'medium' });
    expect(taskPrioritySchema.parse('high')).toBe('high');
  });

  it('accepts valid date-only values and rejects invalid calendar dates', () => {
    expect(
      taskCreateSchema.safeParse({
        title: 'Write tests',
        completed: false,
        dueDate: '2024-02-29',
      }).success
    ).toBe(true);

    for (const dueDate of [
      '0000-02-29',
      '0000-01-01',
      '2026-02-30',
      '2025-02-29',
      '2026-13-01',
      '2026-1-01',
    ]) {
      expect(
        taskCreateSchema.safeParse({ title: 'Write tests', completed: false, dueDate }).success
      ).toBe(false);
    }
  });

  it('rejects null due dates on create and update', () => {
    expect(
      taskCreateSchema.safeParse({
        title: 'Write tests',
        completed: false,
        dueDate: null,
      }).success
    ).toBe(false);

    expect(
      taskUpdateSchema.safeParse({
        id: todoId,
        title: 'Updated title',
        completed: false,
        dueDate: null,
      }).success
    ).toBe(false);
  });

  it('rejects priority values outside the supported options', () => {
    expect(
      taskCreateSchema.safeParse({
        title: 'Write tests',
        completed: false,
        priority: 'urgent',
      }).success
    ).toBe(false);
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
    const payload = { id: todoId, completed: true };
    expect(() => taskToggleSchema.parse(payload)).not.toThrow();
  });

  it('rejects toggle payload with missing values', () => {
    expect(() => taskToggleSchema.parse({ id: todoId })).toThrow();
  });

  it('passes valid update payload', () => {
    const payload = {
      id: todoId,
      title: 'Updated title',
      body: 'Updated body string is long enough.',
      completed: true,
    };

    expect(() => taskUpdateSchema.parse(payload)).not.toThrow();
  });

  it('rejects invalid update payloads', () => {
    expect(() =>
      taskUpdateSchema.parse({
        id: todoId,
        title: 'No',
        body: 'Long enough body text.',
        completed: false,
      })
    ).toThrow();

    expect(() =>
      taskUpdateSchema.parse({
        id: todoId,
        title: 'Valid title',
        body: 'x'.repeat(101),
        completed: false,
      })
    ).toThrow();
  });

  it('keeps an explicitly cleared description as an empty string on update', () => {
    const parsed = taskUpdateSchema.parse({
      id: todoId,
      title: 'Valid title',
      body: '',
      completed: false,
    });

    expect(parsed.body).toBe('');
  });

  it('allows legacy descriptions shorter than 10 characters on update', () => {
    const parsed = taskUpdateSchema.parse({
      id: todoId,
      title: 'Valid title',
      body: 'short',
      completed: false,
    });

    expect(parsed.body).toBe('short');
    expect(() =>
      taskUpdateSchema.parse({ id: todoId, title: 'Valid title', body: 'short', completed: false })
    ).not.toThrow();
  });

  it('treats an omitted description as undefined on update', () => {
    const parsed = taskUpdateSchema.parse({
      id: todoId,
      title: 'Valid title',
      completed: true,
    });

    expect(parsed.body).toBeUndefined();
  });

  it('keeps omitted due date and priority absent on update', () => {
    const parsed = taskUpdateSchema.parse({
      id: todoId,
      title: 'Valid title',
      completed: false,
    });

    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.priority).toBeUndefined();
  });

  it('preserves empty update due dates for explicit clearing', () => {
    expect(
      taskUpdateSchema.parse({
        id: todoId,
        title: 'Valid title',
        completed: false,
        dueDate: '',
      }).dueDate
    ).toBe('');
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
    expect(() => taskIdSchema.parse({ id: todoId })).not.toThrow();
  });
});
