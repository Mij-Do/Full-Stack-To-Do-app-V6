'use client';

import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface TodoFormFieldsProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  titleLabel?: string;
  descriptionLabel?: string;
  titleId?: string;
  descriptionId?: string;
  dueDateId?: string;
  priorityId?: string;
}

export function TodoFormFields<TFieldValues extends FieldValues>({
  control,
  titleLabel = 'Title',
  descriptionLabel = 'Description',
  titleId = 'todo-title',
  descriptionId = 'todo-description',
  dueDateId = 'todo-due-date',
  priorityId = 'todo-priority',
}: TodoFormFieldsProps<TFieldValues>) {
  return (
    <FieldGroup>
      <Controller
        name={'title' as Path<TFieldValues>}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={titleId}>{titleLabel}</FieldLabel>
            <Input
              {...field}
              id={titleId}
              aria-invalid={fieldState.invalid}
              placeholder="Title"
              autoComplete="off"
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name={'body' as Path<TFieldValues>}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={descriptionId}>{descriptionLabel}</FieldLabel>
            <InputGroup>
              <InputGroupTextarea
                {...field}
                id={descriptionId}
                placeholder="Description..."
                rows={6}
                className="min-h-24 resize-none"
                aria-invalid={fieldState.invalid}
              />
              <InputGroupAddon align="block-end">
                <InputGroupText className="tabular-nums" />
              </InputGroupAddon>
            </InputGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name={'dueDate' as Path<TFieldValues>}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={dueDateId}>Due Date</FieldLabel>
            <Input
              {...field}
              id={dueDateId}
              type="date"
              value={field.value ?? ''}
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name={'priority' as Path<TFieldValues>}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={priorityId}>Priority</FieldLabel>
            <select
              {...field}
              id={priorityId}
              value={field.value ?? 'medium'}
              aria-invalid={fieldState.invalid}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name={'completed' as Path<TFieldValues>}
        control={control}
        render={({ field: { onChange, value }, fieldState }) => (
          <Field className="flex items-center gap-2" data-invalid={fieldState.invalid}>
            <Checkbox
              checked={value}
              onCheckedChange={onChange}
              className="after:-inset-y-4 sm:after:-inset-y-2"
            />
            <FieldLabel>Completed</FieldLabel>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}
