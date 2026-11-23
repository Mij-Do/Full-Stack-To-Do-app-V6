import { prisma } from '@/lib/prisma';

export const getUserTodoList = async (userId: string | null) => {
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
  const subtasks = await prisma.todoSubtask.findMany({
    where: { todoId: { in: todos.map((todo) => todo.id) }, user_id: userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const byTodo = new Map<string, typeof subtasks>();
  for (const subtask of subtasks) byTodo.set(subtask.todoId, [...(byTodo.get(subtask.todoId) ?? []), subtask]);
  return todos.map((todo) => ({
    ...todo,
    // Legacy checklist parents created before the explicit type field remain visible as parents.
    todoType: todo.todoType === 'withSubtasks' || (byTodo.get(todo.id)?.length ?? 0) > 0 ? 'withSubtasks' : 'standalone',
    subtasks: byTodo.get(todo.id) ?? [],
  }));
};
