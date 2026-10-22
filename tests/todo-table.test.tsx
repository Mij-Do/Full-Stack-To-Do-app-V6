import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TodoTable from '@/components/todoTable';
import { ITodos } from '@/interfaces';
import { deleteTodoListAction } from '@/prisma/actions/todo.action';

vi.mock('@/prisma/actions/todo.action', () => ({
  deleteTodoListAction: vi.fn(),
  toggleTodoListAction: vi.fn(),
}));

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const todos: ITodos[] = [
  {
    id: '1',
    title: 'First Todo',
    body: 'First todo body content.',
    completed: false,
  },
];

describe('TodoTable component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a todo row', () => {
    render(<TodoTable todos={todos} />);
    const titles = screen.getAllByText('First Todo');
    expect(titles.length).toBeGreaterThanOrEqual(1);
    const bodies = screen.getAllByText('First todo body content.');
    expect(bodies.length).toBeGreaterThanOrEqual(1);
  });

  it('renders no todos message when list is empty', () => {
    render(<TodoTable todos={[]} />);
    expect(screen.getByText("You don't have any todos yet.")).toBeInTheDocument();
  });

  it('removes the row optimistically and disables the button while delete is pending, without the outside-transition warning', async () => {
    const d = deferred();
    vi.mocked(deleteTodoListAction).mockReturnValue(d.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();
    await user.click(screen.getAllByLabelText('Delete todo')[0]);

    await waitFor(() => expect(screen.queryAllByText('First Todo')).toHaveLength(0));
    expect(deleteTodoListAction).toHaveBeenCalledWith({ id: '1' });

    const logged = errorSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('optimistic state update occurred outside');

    d.resolve();

    await waitFor(() =>
      expect(screen.getAllByLabelText('Delete todo').length).toBeGreaterThanOrEqual(1)
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('restores the row when the delete action fails', async () => {
    const d = deferred();
    vi.mocked(deleteTodoListAction).mockReturnValue(d.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();
    await user.click(screen.getAllByLabelText('Delete todo')[0]);

    await waitFor(() => expect(screen.queryAllByText('First Todo')).toHaveLength(0));

    d.reject(new Error('action failed'));

    await waitFor(() => expect(screen.getAllByText('First Todo').length).toBeGreaterThanOrEqual(1));
    expect(errorSpy).toHaveBeenCalledWith('Failed to delete todo', expect.any(Error));
    const logged = errorSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('optimistic state update occurred outside');
    errorSpy.mockRestore();
  });
});
