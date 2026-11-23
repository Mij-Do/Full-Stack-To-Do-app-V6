'use client';

import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { formSchema, type TodoFormValues } from '@/schema';
import { createTodoListAction } from '@/prisma/actions/todo.action';
import { type FormEvent, useState } from 'react';
import Spinner from './spinner';
import { TodoFormFields } from './TodoFormFields';
import type { ITodoList } from '@/interfaces';

interface AddTodoFormProps {
  lists?: ITodoList[];
  selectedListId?: string | null;
}

const AddTodoForm = ({ lists = [], selectedListId = null }: AddTodoFormProps) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const currentDefaultValues = {
    title: '',
    body: '',
    completed: false,
    dueDate: '',
    priority: 'medium' as const,
    listId: selectedListId ?? '',
  };

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: currentDefaultValues,
  });

  const onSubmit = async (data: TodoFormValues) => {
    setLoading(true);
    try {
      await createTodoListAction({
        title: data.title,
        body: data.body,
        completed: data.completed,
        dueDate: data.dueDate,
        priority: data.priority,
        listId: data.listId || null,
      });
      form.reset();
      setSubmitError(null);
      setOpen(false);
    } catch (error) {
      console.error(error);
      setSubmitError("Couldn't create the task. Please try again.");
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
        if (nextOpen) setSubmitError(null);
        if (nextOpen) form.reset(currentDefaultValues);
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus size={16} />
          New ToDo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <TodoFormFields
            control={form.control}
            lists={lists.filter((list) => !list.isArchived)}
            titleId="add-title"
            descriptionId="add-description"
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
              <Button type="button" variant="outline" onClick={() => form.reset(currentDefaultValues)}>
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

export default AddTodoForm;