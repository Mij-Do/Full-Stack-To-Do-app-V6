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

export const taskCreateSchema = taskBaseSchema;
export const taskUpdateSchema = taskBaseSchema.extend({
  id: z.string(),
});
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
