import { z } from 'zod';

export const taskBodySchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value))
  .refine(
    (value) => value === undefined || (value.length >= 10 && value.length <= 100),
    {
      message: 'Body must be between 10 and 100 characters when provided.',
    }
  );

export const taskBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters.')
    .max(32, 'Title must be at most 32 characters.'),
  body: taskBodySchema,
  completed: z.boolean(),
});

// Update-side description rules: keep '' as '' so an explicitly cleared
// description can be distinguished from an omitted field (undefined), allow
// legacy descriptions shorter than 10 characters, and preserve the 100-char max.
export const taskUpdateBodySchema = z
  .string()
  .trim()
  .max(100, 'Body must be at most 100 characters.')
  .optional();

export const taskCreateSchema = taskBaseSchema;
export const taskUpdateSchema = taskBaseSchema.extend({
  id: z.string(),
  body: taskUpdateBodySchema,
});
export const taskEditFormSchema = taskUpdateSchema.omit({ id: true });
export const taskToggleSchema = z.object({
  id: z.string(),
  completed: z.boolean(),
});
export const taskIdSchema = z.object({
  id: z.string(),
});

export type TaskFormValues = z.infer<typeof taskCreateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskToggleInput = z.infer<typeof taskToggleSchema>;
export type TaskDeleteInput = z.infer<typeof taskIdSchema>;

export const formSchema = taskCreateSchema;
