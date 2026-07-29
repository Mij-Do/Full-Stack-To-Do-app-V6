"use client";

import { Trash } from 'lucide-react';
import { Button } from './ui/button';
import Spinner from './spinner';
import { useState } from 'react';
import { deleteTodoListAction } from '@/prisma/actions/todo.action';
import EditTodoForm from './EditTodoForm';
import { ITodos } from '@/interfaces';

interface IProps {
  todo: ITodos;
}

const TodosTableActions = ({ todo }: IProps) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteTodoListAction({ id: todo.id });
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
