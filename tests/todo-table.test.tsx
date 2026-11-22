import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TodoTable from '@/components/todoTable';
import AddTodoForm from '@/components/AddTodoForm';
import { ITodos } from '@/interfaces';
import {
  createTodoListAction,
  deleteTodoListAction,
  toggleTodoListAction,
  updateTodoListAction,
} from '@/prisma/actions/todo.action';

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

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Delete todo?');
    expect(dialog).toHaveTextContent('This action cannot be undone.');
    expect(deleteTodoListAction).not.toHaveBeenCalled();
    expect(screen.getAllByText('First Todo').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

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
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryAllByText('First Todo')).toHaveLength(0));

    d.reject(new Error('action failed'));

    await waitFor(() => expect(screen.getAllByText('First Todo').length).toBeGreaterThanOrEqual(1));
    expect(errorSpy).toHaveBeenCalledWith('Failed to delete todo', expect.any(Error));
    const logged = errorSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('optimistic state update occurred outside');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/Failed to delete the task/);
    errorSpy.mockRestore();
  });

  it('opens a confirmation dialog on Delete without calling the action, and Cancel keeps the todo', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Delete todo')[0]);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Delete todo?');
    expect(dialog).toHaveTextContent('This action cannot be undone.');
    expect(deleteTodoListAction).not.toHaveBeenCalled();
    expect(screen.getAllByText('First Todo').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deleteTodoListAction).not.toHaveBeenCalled();
    expect(screen.getAllByText('First Todo').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('dismisses the confirmation with Escape without deleting the todo', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Delete todo')[0]);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deleteTodoListAction).not.toHaveBeenCalled();
    expect(screen.getAllByText('First Todo').length).toBeGreaterThan(0);
  });

  it('confirms deletion exactly once even when Delete is clicked repeatedly while pending', async () => {
    const d = deferred();
    vi.mocked(deleteTodoListAction).mockReturnValue(d.promise);

    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Delete todo')[0]);
    await screen.findByRole('dialog');

    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    await waitFor(() => expect(deleteTodoListAction).toHaveBeenCalledTimes(1));
    expect(deleteTodoListAction).toHaveBeenCalledWith({ id: '1' });

    d.resolve();

    await waitFor(() => expect(screen.queryAllByText('First Todo')).toHaveLength(0));
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

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Edit Title')).toHaveValue('First Todo');
    expect(within(dialog).getByLabelText('Edit Description')).toHaveValue('First todo body content.');
    expect(within(dialog).getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  });

  it('loads updated todo values when the edit dialog reopens', async () => {
    const { rerender } = render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const updatedTodo = { ...todos[0], title: 'Updated First Todo', body: null, completed: true };
    rerender(<TodoTable todos={[updatedTodo, ...todos.slice(1)]} />);
    await user.click(screen.getAllByLabelText('Edit todo')[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Edit Title')).toHaveValue('Updated First Todo');
    expect(within(dialog).getByLabelText('Edit Description')).toHaveValue('');
    expect(within(dialog).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('loads an external completion-state update after reopening the edit dialog', async () => {
    const { rerender } = render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const updatedTodo = { ...todos[0], completed: true };
    rerender(<TodoTable todos={[updatedTodo, ...todos.slice(1)]} />);
    await user.click(screen.getAllByLabelText('Edit todo')[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('preserves the editing draft when todo props change while the dialog is open', async () => {
    const { rerender } = render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    const dialog = await screen.findByRole('dialog');
    const titleField = within(dialog).getByLabelText('Edit Title');
    const descriptionField = within(dialog).getByLabelText('Edit Description');

    await user.clear(titleField);
    await user.type(titleField, 'First Todo draft');
    await user.clear(descriptionField);
    await user.type(descriptionField, 'Draft description value.');
    await user.click(within(dialog).getByRole('checkbox'));

    const updatedTodo = {
      ...todos[0],
      title: 'External Updated Todo',
      body: 'External description value.',
      completed: false,
    };
    rerender(<TodoTable todos={[updatedTodo, ...todos.slice(1)]} />);

    expect(titleField).toHaveValue('First Todo draft');
    expect(descriptionField).toHaveValue('Draft description value.');
    expect(within(dialog).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('discards an abandoned draft and reloads current todo values after closing and reopening', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    let dialog = await screen.findByRole('dialog');
    const titleField = within(dialog).getByLabelText('Edit Title');

    await user.clear(titleField);
    await user.type(titleField, 'Abandoned draft');
    await user.click(within(dialog).getByRole('checkbox'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByLabelText('Edit Title')).toHaveValue('First Todo');
    expect(within(dialog).getByLabelText('Edit Description')).toHaveValue('First todo body content.');
    expect(within(dialog).getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  });

  it('resets to the latest todo values after reopening the edit dialog', async () => {
    const { rerender } = render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const updatedTodo = {
      ...todos[0],
      title: 'Latest First Todo',
      body: 'Latest todo description.',
      completed: true,
    };
    rerender(<TodoTable todos={[updatedTodo, ...todos.slice(1)]} />);
    await user.click(screen.getAllByLabelText('Edit todo')[0]);

    const dialog = await screen.findByRole('dialog');
    const titleField = within(dialog).getByLabelText('Edit Title');
    const descriptionField = within(dialog).getByLabelText('Edit Description');
    await user.clear(titleField);
    await user.type(titleField, 'Temporary title');
    await user.clear(descriptionField);
    await user.type(descriptionField, 'Temporary description.');
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(titleField).toHaveValue('Latest First Todo');
    expect(descriptionField).toHaveValue('Latest todo description.');
    expect(within(dialog).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('submits an explicitly cleared description as an empty string', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    const descriptionField = await screen.findByLabelText('Edit Description');
    expect(descriptionField).toHaveValue('First todo body content.');

    await user.clear(descriptionField);
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(updateTodoListAction).toHaveBeenCalledTimes(1));
    expect(updateTodoListAction).toHaveBeenCalledWith({
      id: '1',
      title: 'First Todo',
      body: '',
      completed: false,
    });
  });

  it('keeps the description unchanged when only the title is edited', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    expect(await screen.findByText('Edit Title')).toBeInTheDocument();

    const titleField = screen.getByLabelText('Edit Title');
    await user.clear(titleField);
    await user.type(titleField, 'Renamed Todo');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(updateTodoListAction).toHaveBeenCalledTimes(1));
    expect(updateTodoListAction).toHaveBeenCalledWith({
      id: '1',
      title: 'Renamed Todo',
      body: 'First todo body content.',
      completed: false,
    });
  });

  it('persists a newly edited description value', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    const descriptionField = await screen.findByLabelText('Edit Description');

    await user.clear(descriptionField);
    await user.type(descriptionField, 'A brand new description.');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(updateTodoListAction).toHaveBeenCalledTimes(1));
    expect(updateTodoListAction).toHaveBeenCalledWith({
      id: '1',
      title: 'First Todo',
      body: 'A brand new description.',
      completed: false,
    });
  });

  it('allows editing and saving a legacy description shorter than 10 characters', async () => {
    render(
      <TodoTable
        todos={[
          {
            id: 'legacy',
            title: 'Legacy Todo',
            body: 'short',
            completed: false,
            createdAt: new Date('2026-01-04T00:00:00.000Z'),
          },
        ]}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    expect(await screen.findByText('Edit Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit Description')).toHaveValue('short');

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(updateTodoListAction).toHaveBeenCalledTimes(1));
    expect(updateTodoListAction).toHaveBeenCalledWith({
      id: 'legacy',
      title: 'Legacy Todo',
      body: 'short',
      completed: false,
    });
    expect(
      screen.queryByText(/Body must be between 10 and 100 characters/)
    ).not.toBeInTheDocument();
  });

  it('opens the add todo dialog with its form fields', async () => {
    render(<AddTodoForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /New ToDo/ }));

    expect(await screen.findByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows a fixed create error, preserves values, clears loading, and allows dismissal', async () => {
    const pending = deferred();
    vi.mocked(createTodoListAction).mockReturnValueOnce(pending.promise);
    const error = new Error('private server details');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<AddTodoForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /New ToDo/ }));
    const dialog = await screen.findByRole('dialog');
    const titleField = within(dialog).getByLabelText('Title');
    const descriptionField = within(dialog).getByLabelText('Description');
    const completedField = within(dialog).getByRole('checkbox');
    const submitButton = within(dialog).getByRole('button', { name: 'Submit' });

    await user.type(titleField, 'New Task Title');
    await user.type(descriptionField, 'A useful task description.');
    await user.click(completedField);
    await user.click(submitButton);

    expect(createTodoListAction).toHaveBeenCalledWith({
      title: 'New Task Title',
      body: 'A useful task description.',
      completed: true,
    });
    expect(submitButton).toBeDisabled();
    pending.reject(error);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't create the task. Please try again.");
    expect(alert).not.toHaveTextContent('private server details');
    expect(titleField).toHaveValue('New Task Title');
    expect(descriptionField).toHaveValue('A useful task description.');
    expect(completedField).toHaveAttribute('aria-checked', 'true');
    expect(submitButton).not.toBeDisabled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith(error);

    await user.click(within(dialog).getByRole('button', { name: 'Dismiss error' }));
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('clears a create error when the dialog is reopened', async () => {
    vi.mocked(createTodoListAction).mockRejectedValueOnce(new Error('private server details'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<AddTodoForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /New ToDo/ }));
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'New Task Title');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Couldn't create the task. Please try again."
    );

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /New ToDo/ }));
    dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    errorSpy.mockRestore();
  });

  it('closes the create dialog after success without showing an error', async () => {
    render(<AddTodoForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /New ToDo/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'New Task Title');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createTodoListAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('preserves create form validation and does not call the action for invalid values', async () => {
    render(<AddTodoForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /New ToDo/ }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));

    expect(within(dialog).getByText('Title must be at least 5 characters.')).toBeInTheDocument();
    expect(createTodoListAction).not.toHaveBeenCalled();
  });

  it('shows a fixed edit error, preserves values, clears loading, and allows dismissal', async () => {
    const pending = deferred();
    vi.mocked(updateTodoListAction).mockReturnValueOnce(pending.promise);
    const error = new Error('private server details');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();
    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    const dialog = await screen.findByRole('dialog');
    const titleField = within(dialog).getByLabelText('Edit Title');
    const descriptionField = within(dialog).getByLabelText('Edit Description');
    const completedField = within(dialog).getByRole('checkbox');
    const submitButton = within(dialog).getByRole('button', { name: 'Submit' });

    await user.clear(titleField);
    await user.type(titleField, 'Updated First Todo');
    await user.clear(descriptionField);
    await user.type(descriptionField, 'Updated task description.');
    await user.click(completedField);
    await user.click(submitButton);

    expect(updateTodoListAction).toHaveBeenCalledWith({
      id: '1',
      title: 'Updated First Todo',
      body: 'Updated task description.',
      completed: true,
    });
    expect(submitButton).toBeDisabled();
    pending.reject(error);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't save your changes. Please try again.");
    expect(alert).not.toHaveTextContent('private server details');
    expect(titleField).toHaveValue('Updated First Todo');
    expect(descriptionField).toHaveValue('Updated task description.');
    expect(completedField).toHaveAttribute('aria-checked', 'true');
    expect(submitButton).not.toBeDisabled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith('Failed to update todo:', error);

    await user.click(within(dialog).getByRole('button', { name: 'Dismiss error' }));
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('clears an edit error when the dialog is reopened', async () => {
    vi.mocked(updateTodoListAction).mockRejectedValueOnce(new Error('private server details'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();
    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Couldn't save your changes. Please try again."
    );

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Edit Title')).toHaveValue('First Todo');
    expect(errorSpy).toHaveBeenCalledWith('Failed to update todo:', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('closes the edit dialog after success without showing an error', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();
    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    const dialog = await screen.findByRole('dialog');
    const titleField = within(dialog).getByLabelText('Edit Title');
    await user.clear(titleField);
    await user.type(titleField, 'Updated First Todo');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(updateTodoListAction).toHaveBeenCalledWith({
      id: '1',
      title: 'Updated First Todo',
      body: 'First todo body content.',
      completed: false,
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('preserves edit form validation and does not call the action for invalid values', async () => {
    render(<TodoTable todos={todos} />);
    const user = userEvent.setup();
    await user.click(screen.getAllByLabelText('Edit todo')[0]);
    const dialog = await screen.findByRole('dialog');
    const titleField = within(dialog).getByLabelText('Edit Title');
    await user.clear(titleField);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));

    expect(within(dialog).getByText('Title must be at least 5 characters.')).toBeInTheDocument();
    expect(updateTodoListAction).not.toHaveBeenCalled();
  });
});
