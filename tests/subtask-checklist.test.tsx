import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubtaskChecklist from '@/components/SubtaskChecklist';
import { createSubtaskAction, deleteSubtaskAction, toggleSubtaskAction, updateSubtaskAction } from '@/prisma/actions/subtask.action';

vi.mock('@/prisma/actions/subtask.action', () => ({
  createSubtaskAction: vi.fn(), updateSubtaskAction: vi.fn(), toggleSubtaskAction: vi.fn(), deleteSubtaskAction: vi.fn(),
}));

describe('SubtaskChecklist', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('shows empty state, pending status, and prevents duplicate submissions', async () => {
    let resolve!: (value: { id: string; todoId: string; title: string; completed: boolean; createdAt: Date }) => void;
    vi.mocked(createSubtaskAction).mockReturnValue(new Promise((res) => { resolve = res; }));
    render(<SubtaskChecklist todoId="parent-id" />);
    expect(screen.getByRole('heading', { name: 'Subtasks' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Subtask completion' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('No subtasks yet.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Subtask checklist items' })).toHaveClass('ml-2', 'border', 'bg-muted/30');
    expect(screen.getByRole('button', { name: 'Add subtask' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'New subtask title' }), { target: { value: 'Plan' } });
    const form = screen.getByRole('textbox', { name: 'New subtask title' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(createSubtaskAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Saving subtask');
    resolve({ id: 'child-id', todoId: 'parent-id', title: 'Plan', completed: false, createdAt: new Date() });
    await waitFor(() => expect(screen.getByText('Plan')).toBeInTheDocument());
  });

  it('announces an action error and leaves the failed addition absent', async () => {
    vi.mocked(createSubtaskAction).mockRejectedValue(new Error('failure'));
    render(<SubtaskChecklist todoId="parent-id" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'New subtask title' }), { target: { value: 'Plan' } });
    fireEvent.submit(screen.getByRole('textbox', { name: 'New subtask title' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this subtask');
    expect(screen.queryByText('Plan')).not.toBeInTheDocument();
  });

  it('shows pending state and keeps the checkbox unchanged after a failed toggle', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(toggleSubtaskAction).mockReturnValue(new Promise((_, rej) => { reject = rej; }));
    render(<SubtaskChecklist todoId="parent-id" initialSubtasks={[{ id: 'child-id', todoId: 'parent-id', title: 'Plan', completed: false, createdAt: new Date() }]} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Complete Plan' });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(toggleSubtaskAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Saving subtask');
    expect(checkbox).toBeDisabled();
    reject(new Error('failure'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this subtask');
    expect(checkbox).not.toBeChecked();
  });

  it('restores the edited title when editing fails', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(updateSubtaskAction).mockReturnValue(new Promise((_, rej) => { reject = rej; }));
    render(<SubtaskChecklist todoId="parent-id" initialSubtasks={[{ id: 'child-id', todoId: 'parent-id', title: 'Plan', completed: false, createdAt: new Date() }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Plan' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit subtask title' }), { target: { value: 'Revised' } });
    fireEvent.submit(screen.getByRole('textbox', { name: 'Edit subtask title' }).closest('form')!);
    fireEvent.submit(screen.getByRole('textbox', { name: 'Edit subtask title' }).closest('form')!);
    expect(updateSubtaskAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Saving subtask');
    expect(screen.getByRole('textbox', { name: 'Edit subtask title' })).toBeDisabled();
    reject(new Error('failure'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this subtask');
    expect(screen.getByRole('textbox', { name: 'Edit subtask title' })).toHaveValue('Revised');
  });

  it('keeps a subtask after delete failure', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(deleteSubtaskAction).mockReturnValue(new Promise((_, rej) => { reject = rej; }));
    render(<SubtaskChecklist todoId="parent-id" initialSubtasks={[{ id: 'child-id', todoId: 'parent-id', title: 'Plan', completed: false, createdAt: new Date() }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Plan' }));
    expect(deleteSubtaskAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Saving subtask');
    expect(screen.getByRole('button', { name: 'Delete Plan' })).toBeDisabled();
    reject(new Error('failure'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this subtask');
    expect(screen.getByText('Plan')).toBeInTheDocument();
  });

  it('applies successful edit, toggle, and delete actions to the checklist', async () => {
    vi.mocked(toggleSubtaskAction).mockResolvedValue(undefined);
    vi.mocked(updateSubtaskAction).mockResolvedValue(undefined);
    vi.mocked(deleteSubtaskAction).mockResolvedValue(undefined);
    render(<SubtaskChecklist todoId="parent-id" initialSubtasks={[
      { id: 'child-id', todoId: 'parent-id', title: 'Plan', completed: false, createdAt: new Date() },
      { id: 'child-2', todoId: 'parent-id', title: 'Review', completed: false, createdAt: new Date() },
    ]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete Plan' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /1 of 2 completed · 50%/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete Review' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /2 of 2 completed · 100%/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit Plan' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit subtask title' }), { target: { value: 'Revised' } });
    fireEvent.submit(screen.getByRole('textbox', { name: 'Edit subtask title' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('Revised')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Revised' }));
    await waitFor(() => expect(screen.queryByText('Revised')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Review' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /0 of 0 completed · 0%/ })).toBeInTheDocument());
    expect(toggleSubtaskAction).toHaveBeenCalledWith({ todoId: 'parent-id', id: 'child-id', completed: true });
    expect(updateSubtaskAction).toHaveBeenCalledWith({ todoId: 'parent-id', id: 'child-id', title: 'Revised' });
    expect(deleteSubtaskAction).toHaveBeenCalledWith({ todoId: 'parent-id', id: 'child-id' });
    expect(toggleSubtaskAction).toHaveBeenCalledWith({ todoId: 'parent-id', id: 'child-2', completed: true });
    expect(deleteSubtaskAction).toHaveBeenCalledWith({ todoId: 'parent-id', id: 'child-2' });
  });

  it('accepts new server subtasks without resetting local state on ordinary rerenders', async () => {
    const { rerender } = render(<SubtaskChecklist todoId="parent-id" />);
    rerender(<SubtaskChecklist todoId="parent-id" initialSubtasks={[{ id: 'server-id', todoId: 'parent-id', title: 'From server', completed: true, createdAt: new Date() }]} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /1 of 1 completed · 100%/ })).toBeInTheDocument());
    expect(screen.getByText('From server')).toBeInTheDocument();
  });

  it('gives each Edit button a distinct accessible name', () => {
    render(<SubtaskChecklist todoId="parent-id" initialSubtasks={[
      { id: 'child-a', todoId: 'parent-id', title: 'Update CV', completed: false, createdAt: new Date() },
      { id: 'child-b', todoId: 'parent-id', title: 'Book travel', completed: false, createdAt: new Date() },
    ]} />);
    expect(screen.getByRole('button', { name: 'Edit Update CV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Book travel' })).toBeInTheDocument();
  });
});

