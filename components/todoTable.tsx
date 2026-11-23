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
import { formatDueDate, truncateDescription } from '@/lib/utils';
import type { TaskPriority } from '@/lib/validations/task';
import { deleteTodoListAction, toggleTodoListAction } from '@/prisma/actions/todo.action';

interface IProps {
  todos: ITodos[];
}

type TodoAction =
  | { type: 'delete'; id: string }
  | { type: 'toggle'; id: string; completed: boolean }
  | { type: 'rollback-toggle'; id: string; completed: boolean }
  | { type: 'restore'; todo: ITodos; index: number };

type StatusFilter = 'all' | 'active' | 'completed';

type SortOrder = 'newest' | 'oldest';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const PRIORITY_VARIANTS = {
  low: 'secondary',
  medium: 'outline',
  high: 'destructive',
} as const;

const getCreatedAtTime = (value?: Date | string): number | null => {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

const sortByCreatedAt = (items: ITodos[], order: SortOrder): ITodos[] => {
  const dated: { item: ITodos; time: number }[] = [];
  const undated: ITodos[] = [];

  items.forEach((item) => {
    const time = getCreatedAtTime(item.createdAt);
    if (time === null) {
      undated.push(item);
    } else {
      dated.push({ item, time });
    }
  });

  dated.sort((a, b) => (order === 'newest' ? b.time - a.time : a.time - b.time));

  return [...dated.map(({ item }) => item), ...undated];
};

export default function TodoTable({ todos: initialTodos }: IProps) {
  const [todos, updateTodos] = useOptimistic<ITodos[], TodoAction>(initialTodos, (state, action) => {
    switch (action.type) {
      case 'delete':
        return state.filter((todo) => todo.id !== action.id);
      case 'toggle':
        return state.map((todo) =>
          todo.id === action.id ? { ...todo, completed: action.completed } : todo
        );
      case 'rollback-toggle':
        return state.map((todo) =>
          todo.id === action.id ? { ...todo, completed: action.completed } : todo
        );
      case 'restore': {
        if (state.some((todo) => todo.id === action.todo.id)) return state;
        const index = Math.min(action.index, state.length);
        return [...state.slice(0, index), action.todo, ...state.slice(index)];
      }
      default:
        return state;
    }
  });

  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const pendingIdsRef = useRef<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortOrder>('newest');

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

    const previousCompleted = todo.completed;
    const nextCompleted = !previousCompleted;
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
            updateTodos({
              type: 'rollback-toggle',
              id: todo.id,
              completed: previousCompleted,
            });
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

    const todoIndex = todos.findIndex((todo) => todo.id === id);
    if (todoIndex === -1) return;
    const deletedTodo = todos[todoIndex];
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
            updateTodos({ type: 'restore', todo: deletedTodo, index: todoIndex });
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

  const visibleTodos = sortByCreatedAt(filteredTodos, sort);
  const priorityBadge = (priority?: TaskPriority | null) => {
    const value = priority ?? 'medium';
    return <Badge variant={PRIORITY_VARIANTS[value]}>{PRIORITY_LABELS[value]}</Badge>;
  };

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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs sm:shrink-0">
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
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Filter tasks by status" className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                className="min-h-11 lg:min-h-0"
                variant={status === filter.value ? 'default' : 'outline'}
                aria-pressed={status === filter.value}
                onClick={() => setStatus(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <div role="group" aria-label="Sort tasks" className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                className="min-h-11 lg:min-h-0"
                variant={sort === option.value ? 'default' : 'outline'}
                aria-pressed={sort === option.value}
                onClick={() => setSort(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
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
            {visibleTodos.map((todo) => (
              <div key={todo.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <h3 className="wrap-anywhere font-semibold">{todo.title}</h3>
                    {todo.body && (
                      <p className="wrap-anywhere text-sm text-muted-foreground">
                        {truncateDescription(todo.body)}
                      </p>
                    )}
                  </div>
                  {todo.completed ? <Badge>Completed</Badge> : <Badge variant="destructive">Uncompleted</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span>Due: {formatDueDate(todo.dueDate)}</span>
                  <span className="flex items-center gap-2">
                    Priority: {priorityBadge(todo.priority)}
                  </span>
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
                  <TableHead>Due Date</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTodos.map((todo) => (
                  <TableRow key={todo.id}>
                    <TableCell className="wrap-anywhere whitespace-normal font-medium">{todo.title}</TableCell>
                    <TableCell className="wrap-anywhere whitespace-normal">
                      {todo.body ? truncateDescription(todo.body) : null}
                    </TableCell>
                    <TableCell>
                      {todo.completed ? <Badge>Completed</Badge> : <Badge variant="destructive">Uncompleted</Badge>}
                    </TableCell>
                    <TableCell>{formatDueDate(todo.dueDate)}</TableCell>
                    <TableCell>{priorityBadge(todo.priority)}</TableCell>
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
                  <TableCell colSpan={5}>Visible</TableCell>
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
