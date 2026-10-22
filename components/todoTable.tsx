'use client';

import { startTransition, useOptimistic, useRef, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type StatusFilter = 'all' | 'active' | 'completed';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

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
  const pendingIdsRef = useRef<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const setPending = (id: string, value: boolean) => {
    pendingIdsRef.current = {
      ...pendingIdsRef.current,
      [id]: value,
    };
    setPendingIds((current) => ({
      ...current,
      [id]: value,
    }));
  };

  const handleToggle = async (todo: ITodos) => {
    if (pendingIdsRef.current[todo.id]) return;

    const previousTodos = todos;
    const nextCompleted = !todo.completed;
    setError(null);
    setPending(todo.id, true);

    try {
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          updateTodos({ type: 'toggle', id: todo.id, completed: nextCompleted });

          try {
            await toggleTodoListAction({ id: todo.id, completed: nextCompleted });
          } catch (actionError) {
            console.error('Failed to update completion status', actionError);
            updateTodos({ type: 'rollback', nextState: previousTodos });
            setError('Failed to update the task status. The change was reverted, please try again.');
          } finally {
            resolve();
          }
        });
      });
    } finally {
      setPending(todo.id, false);
    }
  };

  const handleDelete = async (id: string) => {
    if (pendingIdsRef.current[id]) return;

    const previousTodos = todos;
    setError(null);
    setPending(id, true);

    try {
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          updateTodos({ type: 'delete', id });

          try {
            await deleteTodoListAction({ id });
          } catch (actionError) {
            console.error('Failed to delete todo', actionError);
            updateTodos({ type: 'rollback', nextState: previousTodos });
            setError('Failed to delete the task. It is still in your list, please try again.');
          } finally {
            resolve();
          }
        });
      });
    } finally {
      setPending(id, false);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTodos = todos.filter((todo) => {
    const matchesStatus =
      status === 'all' || (status === 'active' ? !todo.completed : todo.completed);
    const matchesQuery =
      normalizedQuery.length === 0 ||
      todo.title.toLowerCase().includes(normalizedQuery) ||
      (todo.body ?? '').toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });

  const activeCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - activeCount;

  const errorBanner = error ? (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <span>{error}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto shrink-0 px-2 py-1 text-destructive"
        onClick={() => setError(null)}
        aria-label="Dismiss error"
      >
        Dismiss
      </Button>
    </div>
  ) : null;

  if (!todos.length) {
    return (
      <div className="w-full space-y-4">
        {errorBanner}
        <div className="w-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          You don&apos;t have any todos yet.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {errorBanner}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <Label htmlFor="todo-search" className="sr-only">
            Search tasks
          </Label>
          <Input
            id="todo-search"
            type="search"
            placeholder="Search title or description"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div role="group" aria-label="Filter tasks by status" className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              size="sm"
              variant={status === filter.value ? 'default' : 'outline'}
              aria-pressed={status === filter.value}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">Showing {filteredTodos.length} of {todos.length} tasks · {activeCount} active · {completedCount} completed (all tasks)</p>

      {filteredTodos.length === 0 ? (
        <div
          role="status"
          className="w-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"
        >
          <p>No tasks match your search and filter.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setQuery('');
              setStatus('all');
            }}
          >
            Clear search and filters
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {filteredTodos.map((todo) => (
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
              <span>Visible</span>
              <span>{filteredTodos.length} of {todos.length}</span>
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
                {filteredTodos.map((todo) => (
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
                  <TableCell colSpan={3}>Visible</TableCell>
                  <TableCell className="text-right">{filteredTodos.length} of {todos.length}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
