"use client";

import { Trash } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
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

  const busy = loading || isPending;

  const handleDelete = async () => {
    if (busy) return;
    setLoading(true);
    try {
      await onDelete(todo.id);
    } finally {
      setLoading(false);
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
        aria-label={
          todo.completed ? `Mark ${todo.title} as active` : `Mark ${todo.title} as completed`
        }
        onCheckedChange={handleToggle}
      />
      <EditTodoForm todo={todo} />
      <Button size="icon" variant="destructive" disabled={busy} onClick={handleDelete} aria-label="Delete todo">
        {loading ? <Spinner /> : <Trash size={16} />}
      </Button>
    </div>
  );
};

export default TodosTableActions;
