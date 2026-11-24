import { describe, expect, it } from 'vitest';
import type { ITodos } from '@/interfaces';
import { calculateTodoDashboardMetrics } from '@/lib/dashboard';

describe('Todo dashboard metrics', () => {
  it('counts top-level occurrences, completed history, active due-date subsets, and completion rate', () => {
    const todos: ITodos[] = [
      { id: 'overdue', title: 'Overdue', body: null, completed: false, dueDate: '2026-03-07', subtasks: [
        { id: 'child-1', todoId: 'overdue', title: 'Child one', completed: false, createdAt: new Date() },
        { id: 'child-2', todoId: 'overdue', title: 'Child two', completed: true, createdAt: new Date() },
      ] },
      { id: 'today', title: 'Due today', body: null, completed: false, dueDate: '2026-03-08' },
      { id: 'next-a', title: 'Next occurrence A', body: null, completed: false, dueDate: '2026-03-09', recurrence: { id: 'series', frequency: 'daily', interval: 1, active: true, isCurrent: false } },
      { id: 'next-b', title: 'Next occurrence B', body: null, completed: false, dueDate: '2026-03-09', recurrence: { id: 'series', frequency: 'daily', interval: 1, active: true, isCurrent: true } },
      { id: 'undated', title: 'Undated', body: null, completed: false, dueDate: null },
      { id: 'history', title: 'Past completed occurrence', body: null, completed: true, dueDate: '2026-02-01' },
      { id: 'completed-today', title: 'Completed today', body: null, completed: true, dueDate: '2026-03-08' },
    ];

    expect(calculateTodoDashboardMetrics(todos, new Date('2026-03-08T17:00:00.000Z'))).toEqual({
      total: 7,
      active: 5,
      completed: 2,
      overdue: 1,
      dueToday: 1,
      upcoming: 2,
      completionRate: 28.6,
    });
  });

  it('uses UTC calendar-day boundaries for due dates', () => {
    const todos: ITodos[] = [
      { id: 'before-midnight', title: 'Before UTC midnight', body: null, completed: false, dueDate: new Date('2026-03-08T23:59:00.000Z') },
      { id: 'today-start', title: 'Today start', body: null, completed: false, dueDate: new Date('2026-03-09T00:00:00.000Z') },
      { id: 'today-end', title: 'Today end', body: null, completed: false, dueDate: new Date('2026-03-09T23:59:00.000Z') },
      { id: 'tomorrow-start', title: 'Tomorrow start', body: null, completed: false, dueDate: new Date('2026-03-10T00:00:00.000Z') },
    ];

    expect(calculateTodoDashboardMetrics(todos, new Date('2026-03-09T00:00:00.000Z'))).toMatchObject({
      overdue: 1,
      dueToday: 2,
      upcoming: 1,
    });
  });

  it('returns zero metrics and a zero completion rate for an empty dataset', () => {
    expect(calculateTodoDashboardMetrics([], new Date('2026-03-08T00:00:00.000Z'))).toEqual({
      total: 0,
      active: 0,
      completed: 0,
      overdue: 0,
      dueToday: 0,
      upcoming: 0,
      completionRate: 0,
    });
  });
});
