"use client";

import { Trash } from 'lucide-react';
import { Button } from './ui/button';
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

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete(todo.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <EditTodoForm todo={todo} />
      <Button size="icon" variant="destructive" disabled={loading} onClick={handleDelete} aria-label="Delete todo">
        {loading ? <Spinner /> : <Trash size={16} />}
      </Button>
    </div>
  );
};

export default TodosTableActions;
