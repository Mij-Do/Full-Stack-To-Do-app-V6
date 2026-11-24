import type { ITodos } from '@/interfaces';
import { dateOnlyToUtcDate, formatDateForInput } from '@/lib/utils';

export interface TodoDashboardMetrics {
  total: number;
  active: number;
  completed: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  completionRate: number;
}

export const calculateTodoDashboardMetrics = (todos: readonly ITodos[], now = new Date()): TodoDashboardMetrics => {
  const total = todos.length;
  let active = 0;
  let completed = 0;
  let overdue = 0;
  let dueToday = 0;
  let upcoming = 0;

  const todayValue = formatDateForInput(now);
  const today = dateOnlyToUtcDate(todayValue);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  for (const todo of todos) {
    if (todo.completed) {
      completed += 1;
      continue;
    }

    active += 1;
    const dueDateValue = formatDateForInput(todo.dueDate);
    if (!dueDateValue) continue;

    const dueDate = dateOnlyToUtcDate(dueDateValue);
    if (Number.isNaN(dueDate.getTime())) continue;
    if (dueDate.getTime() < today.getTime()) overdue += 1;
    else if (dueDate.getTime() < tomorrow.getTime()) dueToday += 1;
    else upcoming += 1;
  }

  return {
    total,
    active,
    completed,
    overdue,
    dueToday,
    upcoming,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 1000) / 10,
  };
};
