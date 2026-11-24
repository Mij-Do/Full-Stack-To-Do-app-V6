'use client';

import { Button } from '@/components/ui/button';
import { Plus, X, Trash } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { formSchema, type TodoFormValues } from '@/schema';
import { createTodoAction } from '@/prisma/actions/todo.action';
import { type FormEvent, useRef, useState } from 'react';
import Spinner from './spinner';
import { TodoFormFields } from './TodoFormFields';
import { RecurrenceFields } from './RecurrenceFields';
import type { RecurrenceChoice } from '@/lib/validations/task';
import { useToast } from '@/components/ui/toast-provider';
const AddTodoForm = () => {
  const toast = useToast();
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [todoType, setTodoType] = useState<'standalone' | 'withSubtasks'>('standalone');
  const [initialSubtasks, setInitialSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const currentDefaultValues = {
    title: '',
    body: '',
    completed: false,
    dueDate: '',
    priority: 'medium' as const,
    todoType: 'standalone' as const,
    initialSubtasks: [] as string[],
    recurrenceFrequency: 'none' as const,
    recurrenceInterval: 1,
  };

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: currentDefaultValues,
  });
  const recurrenceFrequency = form.watch('recurrenceFrequency');
  const recurrenceInterval = form.watch('recurrenceInterval');

  const selectTodoType = (value: 'standalone' | 'withSubtasks') => {
    setTodoType(value);
  };

  const onSubmit = async (data: TodoFormValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      await createTodoAction({
        title: data.title,
        body: data.body,
        completed: false,
        dueDate: data.dueDate,
        priority: data.priority,
        todoType,
        initialSubtasks: todoType === 'withSubtasks' ? initialSubtasks : [],
        recurrenceFrequency: data.recurrenceFrequency,
        recurrenceInterval: data.recurrenceInterval,
      });
      form.reset();
      setTodoType('standalone');
      setInitialSubtasks([]);
      setNewSubtask('');
      toast.success('Todo added successfully.');
      setOpen(false);
    } catch {
      toast.error("Couldn't create the task. Please try again.");
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
          form.reset(currentDefaultValues);
          setTodoType('standalone');
          setInitialSubtasks([]);
          setNewSubtask('');
        }
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
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Todo type</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="todo-type" value="standalone" checked={todoType === 'standalone'} onChange={() => selectTodoType('standalone')} />
              Standalone Todo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="todo-type" value="withSubtasks" checked={todoType === 'withSubtasks'} onChange={() => selectTodoType('withSubtasks')} />
              Todo with Subtasks
            </label>
          </fieldset>
          <TodoFormFields
            control={form.control}
            titleId="add-title"
            descriptionId="add-description"
            dueDateRequired={recurrenceFrequency !== 'none'}
          />

          <RecurrenceFields
            idPrefix="add"
            frequency={recurrenceFrequency ?? 'none'}
            interval={recurrenceInterval ?? 1}
            onFrequencyChange={(value: RecurrenceChoice) => form.setValue('recurrenceFrequency', value, { shouldValidate: true })}
            onIntervalChange={(value) => form.setValue('recurrenceInterval', value, { shouldValidate: true })}
            intervalError={form.formState.errors.recurrenceInterval?.message}
          />

          {todoType === 'withSubtasks' && (
            <section aria-label="Initial subtasks" className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <h3 className="text-sm font-semibold">Subtasks</h3>
              <p className="text-xs text-muted-foreground">The parent Todo stays active while any subtask is pending.</p>
              <div className="flex gap-2">
                <Input aria-label="New subtask title" placeholder="Add a subtask" maxLength={80} value={newSubtask} onChange={(event) => setNewSubtask(event.target.value)} />
                <Button type="button" variant="outline" disabled={!newSubtask.trim()} onClick={() => { setInitialSubtasks((items) => [...items, newSubtask.trim()]); setNewSubtask(''); }}>Add subtask</Button>
              </div>
              <div role="group" aria-label="Pending subtasks" className="space-y-2">
                {initialSubtasks.map((subtask, index) => (
                  <div className="flex items-center gap-2 rounded-[5px] border bg-background p-2" key={`initial-${index}`}>
                    <label className="sr-only" htmlFor={`initial-subtask-${index}`}>Subtask {index + 1}</label>
                    <Input id={`initial-subtask-${index}`} value={subtask} maxLength={80} onChange={(event) => setInitialSubtasks((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} aria-label={`Subtask ${index + 1}`} />
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove subtask ${index + 1}`} onClick={() => setInitialSubtasks((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash size={16} /></Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <DialogFooter className="gap-2 sm:justify-end">
            <Field orientation="horizontal" className="flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" aria-label="Close dialog">
                  <X size={16} />
                </Button>
              </DialogClose>
              <Button type="button" variant="outline" onClick={() => { form.reset(currentDefaultValues); setTodoType('standalone'); setInitialSubtasks([]); setNewSubtask(''); }}>
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
