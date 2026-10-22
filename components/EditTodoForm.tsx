'use client';

import { Button } from '@/components/ui/button';
import { Pen, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { taskEditFormSchema } from '@/schema';
import { updateTodoListAction } from '@/prisma/actions/todo.action';
import { useState } from 'react';
import Spinner from './spinner';
import { ITodos } from '@/interfaces';
import { TodoFormFields } from './TodoFormFields';

interface IProps {
  todo: ITodos;
}

const EditTodoForm = ({ todo }: IProps) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(taskEditFormSchema),
    defaultValues: {
      title: todo.title,
      body: (todo.body as string) || '',
      completed: todo.completed,
    },
  });

  const onSubmit = async (data: ReturnType<typeof taskEditFormSchema.parse>) => {
    setLoading(true);
    try {
      await updateTodoListAction({
        id: todo.id,
        title: data.title,
        body: data.body,
        completed: data.completed,
      });
      setOpen(false);
    } catch (error) {
      console.error('Failed to update todo:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" className="min-h-11 min-w-11 md:min-h-0 md:min-w-0" aria-label="Edit todo">
          <Pen size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <TodoFormFields
            control={form.control}
            titleLabel="Edit Title"
            descriptionLabel="Edit Description"
            titleId="edit-title"
            descriptionId="edit-description"
          />

          <DialogFooter className="gap-2 sm:justify-end">
            <Field orientation="horizontal" className="flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" aria-label="Close dialog">
                  <X size={16} />
                </Button>
              </DialogClose>
              <Button type="button" variant="outline" onClick={() => form.reset()}>
                Reset
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Spinner /> : 'Submit'}
              </Button>
            </Field>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTodoForm;