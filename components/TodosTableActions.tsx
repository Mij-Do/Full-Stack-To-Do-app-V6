"use client";

import { Trash } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import Spinner from './spinner';
import { useState } from 'react';
import EditTodoForm from './EditTodoForm';
import { ITodos } from '@/interfaces';

interface IProps {
  todo: ITodos;
  onDelete: (id: string) => Promise<void>;
  onToggle: (todo: ITodos) => Promise<void>;
  isPending: boolean;
}

const TodosTableActions = ({ todo, onDelete, onToggle, isPending }: IProps) => {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const busy = loading || isPending;

  const handleConfirmOpenChange = (open: boolean) => {
    // Keep the dialog open while a deletion is in flight (ESC/overlay/X/Cancel
    // all funnel through here) so the pending operation cannot be abandoned.
    if (busy && !open) return;
    setConfirmOpen(open);
  };

  const handleConfirmDelete = async () => {
    if (busy) return;
    setLoading(true);
    try {
      await onDelete(todo.id);
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  const handleToggle = async () => {
    if (busy) return;
    setLoading(true);
    try {
      await onToggle(todo);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Checkbox
        checked={todo.completed}
        disabled={busy}
        aria-busy={busy}
        className="after:-inset-y-4 md:after:-inset-y-2"
        aria-label={
          todo.completed ? `Mark ${todo.title} as active` : `Mark ${todo.title} as completed`
        }
        onCheckedChange={handleToggle}
      />
      <EditTodoForm todo={todo} />
      <Dialog open={confirmOpen} onOpenChange={handleConfirmOpenChange}>
        <DialogTrigger asChild>
          <Button
            size="icon"
            variant="destructive"
            className="min-h-11 min-w-11 md:min-h-0 md:min-w-0"
            disabled={busy}
            aria-label="Delete todo"
          >
            {loading ? <Spinner /> : <Trash size={16} />}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete todo?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={handleConfirmDelete}
            >
              {busy ? <Spinner /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TodosTableActions;
