'use client';

import { Button } from '@/components/ui/button';
import { Pen, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { taskEditFormSchema } from '@/schema';
import { stopTodoRecurrenceAction, updateTodoAction } from '@/prisma/actions/todo.action';
import { type FormEvent, useRef, useState } from 'react';
import Spinner from './spinner';
import { ITodos } from '@/interfaces';
import { TodoFormFields } from './TodoFormFields';
import { formatDateForInput } from '@/lib/utils';
import { RecurrenceFields } from './RecurrenceFields';
import type { RecurrenceChoice } from '@/lib/validations/task';
import { useToast } from '@/components/ui/toast-provider';

interface IProps {
  todo: ITodos;
}

type EditTodoFormInput = z.input<typeof taskEditFormSchema>;
type EditTodoFormOutput = z.output<typeof taskEditFormSchema>;

const EditTodoForm = ({ todo }: IProps) => {
  const toast = useToast();
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const currentTodoValues = {
    title: todo.title,
    body: todo.body ?? '',
    completed: todo.completed,
    dueDate: formatDateForInput(todo.dueDate),
    priority: todo.priority ?? 'medium',
    recurrenceFrequency: todo.recurrence?.active ? todo.recurrence.frequency : 'none' as const,
    recurrenceInterval: todo.recurrence?.interval ?? 1,
  };

  const form = useForm<EditTodoFormInput, undefined, EditTodoFormOutput>({
    resolver: zodResolver(taskEditFormSchema),
    defaultValues: currentTodoValues,
  });
  const recurrenceFrequency = form.watch('recurrenceFrequency') ?? 'none';
  const recurrenceInterval = form.watch('recurrenceInterval') ?? 1;

  const normalizeEditableValues = (values: {
    title: string;
    body?: string;
    dueDate?: string;
    priority?: string | null;
    recurrenceFrequency?: RecurrenceChoice;
    recurrenceInterval?: number;
  }) => ({
    title: values.title.trim(),
    body: (values.body ?? '').trim(),
    dueDate: formatDateForInput(values.dueDate),
    priority: values.priority ?? 'medium',
    recurrenceFrequency: values.recurrenceFrequency ?? 'none',
    recurrenceInterval: values.recurrenceFrequency && values.recurrenceFrequency !== 'none'
      ? values.recurrenceInterval ?? 1
      : 1,
  });

  const onSubmit = async (data: EditTodoFormOutput) => {
    if (submittingRef.current) return;
    if (
      JSON.stringify(normalizeEditableValues(data)) ===
      JSON.stringify(normalizeEditableValues(currentTodoValues))
    ) {
      toast.info('No changes to save.');
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      await updateTodoAction({
        id: todo.id,
        title: data.title,
        body: data.body,
        completed: data.completed,
        completionIntent: 'preserve',
        dueDate: data.dueDate,
        priority: data.priority,
        recurrenceFrequency: data.recurrenceFrequency,
        recurrenceInterval: data.recurrenceInterval,
      });
      toast.success('Todo updated successfully.');
      setOpen(false);
    } catch {
      toast.error("Couldn't save your changes. Please try again.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const stopRecurrence = async () => {
    if (submittingRef.current || !todo.recurrence?.active) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      await stopTodoRecurrenceAction({ id: todo.id });
      toast.success('Recurrence stopped successfully.');
      setOpen(false);
    } catch {
      toast.error("Couldn't stop this recurrence. Please try again.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    return form.handleSubmit(onSubmit)(event);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
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
            dueDateRequired={recurrenceFrequency !== 'none'}
          />

          <RecurrenceFields
            idPrefix={`edit-${todo.id}`}
            frequency={recurrenceFrequency}
            interval={recurrenceInterval}
            disabled={todo.recurrence?.active === true && !todo.recurrence.isCurrent}
            onFrequencyChange={(value: RecurrenceChoice) => form.setValue('recurrenceFrequency', value, { shouldValidate: true })}
            onIntervalChange={(value) => form.setValue('recurrenceInterval', value, { shouldValidate: true })}
            intervalError={form.formState.errors.recurrenceInterval?.message}
          />
          {todo.recurrence?.active && !todo.recurrence.isCurrent && <p className="text-xs text-muted-foreground">Recurrence settings belong to the current occurrence. You can stop this series here.</p>}

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
              {todo.recurrence?.active && <Button type="button" variant="outline" disabled={loading} onClick={stopRecurrence}>Stop recurrence</Button>}
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
