import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TodoTable from '@/components/todoTable';
import { ITodos } from '@/interfaces';

vi.mock('@/prisma/actions/todo.action', () => ({
  deleteTodoListAction: vi.fn(),
  toggleTodoListAction: vi.fn(),
}));

const todos: ITodos[] = [
  {
    id: '1',
    title: 'First Todo',
    body: 'First todo body content.',
    completed: false,
  },
];

describe('TodoTable component', () => {
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
});
