'use client';

import { Button } from '@/components/ui/button';
import { Pen, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { taskEditFormSchema } from '@/schema';
import { updateTodoListAction } from '@/prisma/actions/todo.action';
import { type FormEvent, useState } from 'react';
import Spinner from './spinner';
import { ITodos } from '@/interfaces';
import { TodoFormFields } from './TodoFormFields';
import { formatDateForInput } from '@/lib/utils';

interface IProps {
  todo: ITodos;
}

const EditTodoForm = ({ todo }: IProps) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const currentTodoValues = {
    title: todo.title,
    body: todo.body ?? '',
    completed: todo.completed,
    dueDate: formatDateForInput(todo.dueDate),
    priority: todo.priority ?? 'medium',
  };

  const form = useForm({
    resolver: zodResolver(taskEditFormSchema),
    defaultValues: currentTodoValues,
  });

  const onSubmit = async (data: ReturnType<typeof taskEditFormSchema.parse>) => {
    setLoading(true);
    try {
      await updateTodoListAction({
        id: todo.id,
        title: data.title,
        body: data.body,
        completed: data.completed,
        dueDate: data.dueDate,
        priority: data.priority,
      });
      setSubmitError(null);
      setOpen(false);
    } catch (error) {
      console.error('Failed to update todo:', error);
      setSubmitError("Couldn't save your changes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    setSubmitError(null);
    return form.handleSubmit(onSubmit)(event);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setSubmitError(null);
          form.reset(currentTodoValues);
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" className="min-h-11 min-w-11 md:min-h-0 md:min-w-0" aria-label="Edit todo">
          <Pen size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <TodoFormFields
            control={form.control}
            titleLabel="Edit Title"
            descriptionLabel="Edit Description"
            titleId="edit-title"
            descriptionId="edit-description"
          />

          {submitError && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <span>{submitError}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto shrink-0 px-2 py-1 text-destructive"
                onClick={() => setSubmitError(null)}
                aria-label="Dismiss error"
              >
                Dismiss
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-end">
            <Field orientation="horizontal" className="flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" aria-label="Close dialog">
                  <X size={16} />
                </Button>
              </DialogClose>
              <Button type="button" variant="outline" onClick={() => form.reset(currentTodoValues)}>
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