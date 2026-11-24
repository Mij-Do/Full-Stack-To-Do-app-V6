import { prisma } from '@/lib/prisma';
import type { ITodos } from '@/interfaces';

export const getUserTodos = async (userId: string | null): Promise<ITodos[]> => {
  if (!userId) {
    return [];
  }

  const todos = await prisma.todo.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (todos.length === 0) return todos;
  const [subtasks, recurrences] = await Promise.all([prisma.todoSubtask.findMany({
    where: { todoId: { in: todos.map((todo) => todo.id) }, user_id: userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  }), prisma.todoRecurrence.findMany({
    where: { id: { in: todos.flatMap((todo) => todo.recurrenceSeriesId ? [todo.recurrenceSeriesId] : []) }, user_id: userId },
  })]);
  const byTodo = new Map<string, typeof subtasks>();
  for (const subtask of subtasks) {
    const grouped = byTodo.get(subtask.todoId);
    if (grouped) grouped.push(subtask);
    else byTodo.set(subtask.todoId, [subtask]);
  }
  const byRecurrence = new Map(recurrences.map((recurrence) => [recurrence.id, recurrence]));
  return todos.map((todo) => ({
    ...todo,
    // Legacy checklist parents created before the explicit type field remain visible as parents.
    todoType: todo.todoType === 'withSubtasks' || (byTodo.get(todo.id)?.length ?? 0) > 0 ? 'withSubtasks' : 'standalone',
    subtasks: byTodo.get(todo.id) ?? [],
    recurrence: todo.recurrenceSeriesId && byRecurrence.has(todo.recurrenceSeriesId)
      ? (() => {
          const recurrence = byRecurrence.get(todo.recurrenceSeriesId)!;
          return { id: recurrence.id, frequency: recurrence.frequency, interval: recurrence.interval, active: recurrence.active, isCurrent: recurrence.currentTodoId === todo.id };
        })()
      : null,
  }));
};
