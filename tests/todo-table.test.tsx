import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TodoTable from '@/components/todoTable';
import AddTodoForm from '@/components/AddTodoForm';
import { ITodos } from '@/interfaces';
import { deleteTodoListAction, toggleTodoListAction } from '@/prisma/actions/todo.action';

vi.mock('@/prisma/actions/todo.action', () => ({
  createTodoListAction: vi.fn(),
  deleteTodoListAction: vi.fn(),
  toggleTodoListAction: vi.fn(),
  updateTodoListAction: vi.fn(),
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
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
  },
  {
    id: '2',
    title: 'Second Todo',
    body: 'Second todo description.',
    completed: true,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  },
  {
    id: '3',
    title: 'Third Todo',
    body: null,
    completed: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

const visibleTitles = () =>
  screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);

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

  it('toggles completion optimistically, exposes pending state, and blocks duplicate submissions', async () => {
    const d = deferred();
    vi.mocked(toggleTodoListAction).mockReturnValue(d.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    const idleBox = screen.getAllByRole('checkbox', { name: 'Mark First Todo as completed' })[0];
    expect(idleBox).toHaveAttribute('aria-checked', 'false');
    expect(idleBox).toHaveAttribute('aria-busy', 'false');
    expect(idleBox).not.toBeDisabled();

    await user.click(idleBox);

    await waitFor(() => {
      const pendingBoxes = screen.getAllByRole('checkbox', { name: 'Mark First Todo as active' });
      expect(pendingBoxes.length).toBeGreaterThan(0);
      pendingBoxes.forEach((box) => {
        expect(box).toHaveAttribute('aria-checked', 'true');
        expect(box).toHaveAttribute('aria-busy', 'true');
        expect(box).toBeDisabled();
      });
    });

    expect(toggleTodoListAction).toHaveBeenCalledTimes(1);
    expect(toggleTodoListAction).toHaveBeenCalledWith({ id: '1', completed: true });

    screen
      .getAllByRole('checkbox', { name: 'Mark First Todo as active' })
      .forEach((box) => fireEvent.click(box));
    expect(toggleTodoListAction).toHaveBeenCalledTimes(1);

    d.resolve();

    await waitFor(() =>
      expect(
        screen.getAllByRole('checkbox', { name: 'Mark First Todo as completed' })[0]
      ).toHaveAttribute('aria-checked', 'false')
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('restores the previous state and shows a visible error when the toggle action fails', async () => {
    const d = deferred();
    vi.mocked(toggleTodoListAction).mockReturnValue(d.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole('checkbox', { name: 'Mark First Todo as completed' })[0]);
    await waitFor(() =>
      expect(
        screen.getAllByRole('checkbox', { name: 'Mark First Todo as active' })[0]
      ).toHaveAttribute('aria-checked', 'true')
    );

    d.reject(new Error('toggle failed'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/Failed to update the task status/);

    await waitFor(() =>
      screen.getAllByRole('checkbox', { name: 'Mark First Todo as completed' }).forEach((box) => {
        expect(box).toHaveAttribute('aria-checked', 'false');
        expect(box).not.toBeDisabled();
      })
    );
    expect(errorSpy).toHaveBeenCalledWith('Failed to update completion status', expect.any(Error));

    await user.click(screen.getByRole('button', { name: 'Dismiss error' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('searches over title and description and updates results immediately', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    const searchbox = screen.getByRole('searchbox', { name: 'Search tasks' });

    await user.type(searchbox, 'second');
    expect(screen.getAllByText('Second Todo').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('First Todo')).toHaveLength(0);
    expect(screen.getByText(/Showing 1 of 3 tasks/)).toBeInTheDocument();

    await user.clear(searchbox);
    await user.type(searchbox, 'body content');
    expect(screen.getAllByText('First Todo').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Second Todo')).toHaveLength(0);
    expect(screen.getByText(/Showing 1 of 3 tasks/)).toBeInTheDocument();

    await user.clear(searchbox);
    expect(screen.getAllByText('First Todo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Second Todo').length).toBeGreaterThan(0);
  });

  it('filters by status and composes filters with search', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    const activeButton = screen.getByRole('button', { name: 'Active' });
    expect(activeButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(activeButton);
    expect(activeButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryAllByText('Second Todo')).toHaveLength(0);
    expect(screen.getAllByText('First Todo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Third Todo').length).toBeGreaterThan(0);
    expect(screen.getByText(/Showing 2 of 3 tasks/)).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'second');
    expect(screen.queryAllByText('First Todo')).toHaveLength(0);
    expect(screen.queryAllByText('Second Todo')).toHaveLength(0);
    expect(screen.getByText('No tasks match your search and filter.')).toBeInTheDocument();
    expect(screen.queryByText("You don't have any todos yet.")).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 0 of 3 tasks/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(screen.getAllByText('First Todo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Second Todo').length).toBeGreaterThan(0);
    expect(screen.queryByText('No tasks match your search and filter.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Completed' }));
    expect(screen.getAllByText('Second Todo').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('First Todo')).toHaveLength(0);
    expect(screen.getByText(/Showing 1 of 3 tasks/)).toBeInTheDocument();
  });

  it('exposes accessible search and filter controls with documented counts', () => {
    render(<TodoTable todos={todos} />);

    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter tasks by status' })).toBeInTheDocument();
    ['All', 'Active', 'Completed'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed');
    });

    expect(
      screen.getByText('Showing 3 of 3 tasks · 2 active · 1 completed (all tasks)')
    ).toBeInTheDocument();
    expect(screen.getAllByText('3 of 3').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole('group', { name: 'Sort tasks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Newest first' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Oldest first' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('defaults to newest first and preserves the current list order', () => {
    render(<TodoTable todos={todos} />);

    expect(visibleTitles()).toEqual(['First Todo', 'Second Todo', 'Third Todo']);
    expect(screen.getByRole('button', { name: 'Newest first' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sorts oldest first by createdAt date and updates the list immediately', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Oldest first' }));

    expect(visibleTitles()).toEqual(['Third Todo', 'Second Todo', 'First Todo']);
    expect(screen.getByRole('button', { name: 'Oldest first' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Newest first' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Newest first' }));

    expect(visibleTitles()).toEqual(['First Todo', 'Second Todo', 'Third Todo']);
  });

  it('composes sorting with search', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'ir');

    expect(visibleTitles()).toEqual(['First Todo', 'Third Todo']);
    expect(screen.getByText(/Showing 2 of 3 tasks/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Oldest first' }));

    expect(visibleTitles()).toEqual(['Third Todo', 'First Todo']);
    expect(screen.getByText(/Showing 2 of 3 tasks/)).toBeInTheDocument();
  });

  it('composes sorting with status filters', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Active' }));
    expect(visibleTitles()).toEqual(['First Todo', 'Third Todo']);

    await user.click(screen.getByRole('button', { name: 'Oldest first' }));
    expect(visibleTitles()).toEqual(['Third Todo', 'First Todo']);
    expect(screen.getByText(/Showing 2 of 3 tasks/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Completed' }));
    expect(visibleTitles()).toEqual(['Second Todo']);
    expect(screen.getByText(/Showing 1 of 3 tasks/)).toBeInTheDocument();
  });

  it('keeps todos without a createdAt last without mutating the source array', async () => {
    const source: ITodos[] = [
      { id: 'x', title: 'Undated Todo', body: null, completed: false },
      { id: 'y', title: 'Dated New', body: null, completed: false, createdAt: new Date('2026-02-01T00:00:00.000Z') },
      { id: 'z', title: 'Dated Old', body: null, completed: false, createdAt: new Date('2026-01-01T00:00:00.000Z') },
    ];
    const snapshot = [...source];

    render(<TodoTable todos={source} />);

    expect(visibleTitles()).toEqual(['Dated New', 'Dated Old', 'Undated Todo']);
    expect(source).toEqual(snapshot);
    expect(source.map((todo) => todo.id)).toEqual(['x', 'y', 'z']);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Oldest first' }));

    expect(visibleTitles()).toEqual(['Dated Old', 'Dated New', 'Undated Todo']);
    expect(source.map((todo) => todo.id)).toEqual(['x', 'y', 'z']);
  });

  it('keeps filter and sort selections while an optimistic action updates the list', async () => {
    const d = deferred();
    vi.mocked(toggleTodoListAction).mockReturnValue(d.promise);

    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: 'Oldest first' }));
    expect(visibleTitles()).toEqual(['Third Todo', 'First Todo']);

    await user.click(screen.getAllByRole('checkbox', { name: 'Mark Third Todo as completed' })[0]);
    await waitFor(() => expect(screen.queryAllByText('Third Todo')).toHaveLength(0));

    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Oldest first' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Newest first' })).toHaveAttribute('aria-pressed', 'false');

    d.resolve();

    await waitFor(() => expect(screen.getAllByText('Third Todo').length).toBeGreaterThan(0));
  });

  it('renders long unbroken titles and truncates long descriptions in previews', () => {
    const longTitle = 'Supercalifragilisticexpialidocious'.repeat(4);
    const longBody = 'Descriptionwithoutanyspaces'.repeat(5);
    const expectedPreview = `${longBody.slice(0, 50)}...`;

    render(
      <TodoTable
        todos={[{ id: 'long', title: longTitle, body: longBody, completed: false, createdAt: new Date() }]}
      />
    );

    expect(screen.getAllByText(longTitle).length).toBeGreaterThan(0);
    expect(screen.getAllByText(expectedPreview).length).toBeGreaterThan(0);
    expect(screen.queryByText(longBody)).not.toBeInTheDocument();
  });

  it('shows the truncated description preview in both the card and the table', () => {
    const longBody = 'B'.repeat(100);
    const expectedPreview = `${'B'.repeat(50)}...`;

    render(
      <TodoTable
        todos={[{ id: 'preview', title: 'Preview Todo', body: longBody, completed: false, createdAt: new Date() }]}
      />
    );

    expect(screen.getAllByText(expectedPreview).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(longBody)).not.toBeInTheDocument();
  });

  it('keeps short descriptions unchanged in previews', () => {
    render(<TodoTable todos={todos} />);

    expect(screen.getAllByText('First todo body content.').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('First todo body content....')).not.toBeInTheDocument();
  });

  it('opens the edit dialog with the complete original description, not the preview string', async () => {
    const longBody = 'D'.repeat(100);

    render(
      <TodoTable
        todos={[{ id: 'edit-long', title: 'Edit Long Todo', body: longBody, completed: false, createdAt: new Date() }]}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);

    expect(await screen.findByText('Edit Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit Description')).toHaveValue(longBody);
  });

  it('keeps the layout guard classes on the mobile card and previews (jsdom cannot verify layout)', () => {
    render(<TodoTable todos={todos} />);

    const heading = screen.getAllByRole('heading', { level: 3 })[0];
    expect(heading.className).toContain('wrap-anywhere');

    const card = heading.closest('.rounded-xl');
    expect(card).not.toBeNull();
    expect(card?.className).toContain('min-w-0');

    const preview = screen.getAllByText('First todo body content.').find((el) => el.tagName === 'P');
    expect(preview?.className).toContain('wrap-anywhere');
  });

  it('opens the edit dialog with its form fields', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);

    expect(await screen.findByText('Edit Title')).toBeInTheDocument();
    expect(screen.getByText('Edit Description')).toBeInTheDocument();
  });

  it('opens the add todo dialog with its form fields', async () => {
    render(<AddTodoForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /New ToDo/ }));

    expect(await screen.findByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
