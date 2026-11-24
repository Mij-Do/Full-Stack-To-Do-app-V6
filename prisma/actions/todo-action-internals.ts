import type { Prisma } from '@/generated/prisma';
import { calculateNextRecurrenceDate } from '@/lib/recurrence';
import { ActionDomainError } from '@/prisma/actions/action-errors';

export type RecurrenceSource = {
  id: string;
  title: string;
  body: string | null;
  completed: boolean;
  user_id: string;
  dueDate: Date | null;
  priority: 'low' | 'medium' | 'high' | null;
  todoType: 'standalone' | 'withSubtasks';
  recurrenceSeriesId: string | null;
};

/**
 * Transaction-scoped recurrence generation shared by each completion path.
 * The cursor compare-and-set is intentionally last so a miss rolls back the
 * candidate Todo and copied Subtasks with the transaction.
 */
export const createNextOccurrence = async (
  transaction: Prisma.TransactionClient,
  current: RecurrenceSource,
  userId: string,
  now = new Date(),
) => {
  if (!current.completed || !current.recurrenceSeriesId) return;

  const series = await transaction.todoRecurrence.findFirst({
    where: { id: current.recurrenceSeriesId, user_id: userId, active: true, currentTodoId: current.id },
  });
  if (!series) return;
  if (!current.dueDate) throw new ActionDomainError('A due date is required for recurring Todos.');

  const dueDate = calculateNextRecurrenceDate(current.dueDate, series.frequency, series.interval, now, series.anchorDay ?? current.dueDate.getUTCDate());
  const children = await transaction.todoSubtask.findMany({
    where: { todoId: current.id, user_id: userId },
    select: { title: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const todoType = current.todoType === 'withSubtasks' || children.length > 0 ? 'withSubtasks' : 'standalone';
  const next = await transaction.todo.create({
    data: {
      title: current.title,
      body: current.body,
      completed: false,
      user_id: userId,
      dueDate,
      priority: current.priority,
      todoType,
      recurrenceSeriesId: series.id,
    },
  });

  if (todoType === 'withSubtasks') {
    for (const child of children) {
      await transaction.todoSubtask.create({
        data: { todoId: next.id, user_id: userId, title: child.title, completed: false },
      });
    }
  }

  const advanced = await transaction.todoRecurrence.updateMany({
    where: { id: series.id, user_id: userId, active: true, currentTodoId: current.id },
    data: { currentTodoId: next.id },
  });
  if (advanced.count !== 1) throw new ActionDomainError('Recurrence changed concurrently. Please retry.');
};

/** The transaction body shared by toggleTodoAction and its replica-set test. */
export const toggleTodoInTransaction = async (
  transaction: Prisma.TransactionClient,
  id: string,
  completed: boolean,
  userId: string,
  now = new Date(),
) => {
  const parent = await transaction.todo.findFirst({
    where: { id, user_id: userId },
    select: { id: true, title: true, body: true, user_id: true, completed: true, dueDate: true, priority: true, todoType: true, recurrenceSeriesId: true },
  });
  if (!parent) throw new ActionDomainError('Todo not found');
  if (parent.completed === completed) return;

  const guard = await transaction.todo.updateMany({
    where: { id, user_id: userId, completed: parent.completed },
    data: { completed: !parent.completed },
  });
  if (guard.count !== 1) throw new ActionDomainError('Todo changed concurrently. Please retry.');
  await transaction.todoSubtask.updateMany({ where: { todoId: id, user_id: userId }, data: { completed } });
  await transaction.todo.updateMany({ where: { id, user_id: userId }, data: { completed } });

  if (!parent.completed && completed) {
    await createNextOccurrence(transaction, { ...parent, completed: true }, userId, now);
  }
};
