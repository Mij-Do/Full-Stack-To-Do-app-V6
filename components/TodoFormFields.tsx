'use client';

import { Controller, Control } from 'react-hook-form';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { TodoFormValues } from '@/schema';

interface TodoFormFieldsProps {
  control: Control<TodoFormValues>;
  titleLabel?: string;
  descriptionLabel?: string;
  titleId?: string;
  descriptionId?: string;
}

export function TodoFormFields({
  control,
  titleLabel = 'Title',
  descriptionLabel = 'Description',
  titleId = 'todo-title',
  descriptionId = 'todo-description',
}: TodoFormFieldsProps) {
  return (
    <FieldGroup>
      <Controller
        name="title"
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
        name="body"
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
        name="completed"
        control={control}
        render={({ field: { onChange, value }, fieldState }) => (
          <Field className="flex items-center gap-2" data-invalid={fieldState.invalid}>
            <Checkbox checked={value} onCheckedChange={onChange} />
            <FieldLabel>Completed</FieldLabel>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}
