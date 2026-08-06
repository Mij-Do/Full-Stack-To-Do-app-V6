import { taskCreateSchema, taskToggleSchema, taskUpdateSchema, taskIdSchema } from '@/lib/validations/task';
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
        title: 'Bad',
        body: 'too short',
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
        body: 'short',
        completed: false,
      })
    ).toThrow();
  });

  it('passes valid delete payload', () => {
    expect(() => taskIdSchema.parse({ id: 'abc123' })).not.toThrow();
  });
});
