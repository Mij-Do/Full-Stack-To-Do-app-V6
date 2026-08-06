'use client';

import { useOptimistic, useState } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ITodos } from '@/interfaces';
import { Badge } from './ui/badge';
import TodosTableActions from './TodosTableActions';
import { deleteTodoListAction, toggleTodoListAction } from '@/prisma/actions/todo.action';

interface IProps {
  todos: ITodos[];
}

type TodoAction =
  | { type: 'delete'; id: string }
  | { type: 'toggle'; id: string; completed: boolean }
  | { type: 'rollback'; nextState: ITodos[] };

export default function TodoTable({ todos: initialTodos }: IProps) {
  const [todos, updateTodos] = useOptimistic<ITodos[], TodoAction>(initialTodos, (state, action) => {
    switch (action.type) {
      case 'delete':
        return state.filter((todo) => todo.id !== action.id);
      case 'toggle':
        return state.map((todo) =>
          todo.id === action.id ? { ...todo, completed: action.completed } : todo
        );
      case 'rollback':
        return action.nextState;
      default:
        return state;
    }
  });

  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});

  const setPending = (id: string, value: boolean) => {
    setPendingIds((current) => ({
      ...current,
      [id]: value,
    }));
  };

  const handleToggle = async (todo: ITodos) => {
    const previousTodos = todos;
    const nextCompleted = !todo.completed;

    updateTodos({ type: 'toggle', id: todo.id, completed: nextCompleted });
    setPending(todo.id, true);

    try {
      await toggleTodoListAction({ id: todo.id, completed: nextCompleted });
    } catch (error) {
      console.error('Failed to update completion status', error);
      updateTodos({ type: 'rollback', nextState: previousTodos });
    } finally {
      setPending(todo.id, false);
    }
  };

  const handleDelete = async (id: string) => {
    const previousTodos = todos;

    updateTodos({ type: 'delete', id });
    setPending(id, true);

    try {
      await deleteTodoListAction({ id });
    } catch (error) {
      console.error('Failed to delete todo', error);
      updateTodos({ type: 'rollback', nextState: previousTodos });
    } finally {
      setPending(id, false);
    }
  };

  if (!todos.length) {
    return (
      <div className="w-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        You don&apos;t have any todos yet.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="grid gap-4 md:hidden">
        {todos.map((todo) => (
          <div key={todo.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <h3 className="truncate font-semibold">{todo.title}</h3>
                {todo.body && <p className="text-sm text-muted-foreground">{todo.body}</p>}
              </div>
              {todo.completed ? <Badge>Completed</Badge> : <Badge variant="destructive">Uncompleted</Badge>}
            </div>
            <div className="mt-4 flex justify-end border-t pt-3">
              <TodosTableActions
                todo={todo}
                onDelete={handleDelete}
                onToggle={handleToggle}
                isPending={Boolean(pendingIds[todo.id])}
              />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm font-medium">
          <span>Total</span>
          <span>{todos.length}</span>
        </div>
      </div>

      <div className="hidden w-full md:block">
        <Table>
          <TableCaption>A list of your todos.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Body</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {todos.map((todo) => (
              <TableRow key={todo.id}>
                <TableCell className="font-medium">{todo.title}</TableCell>
                <TableCell>{todo.body}</TableCell>
                <TableCell>
                  {todo.completed ? <Badge>Completed</Badge> : <Badge variant="destructive">Uncompleted</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <TodosTableActions
                    todo={todo}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    isPending={Boolean(pendingIds[todo.id])}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right">{todos.length}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}