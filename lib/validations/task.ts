import { z } from 'zod';

export const taskPrioritySchema = z.enum(['low', 'medium', 'high']);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export const todoTypeSchema = z.enum(['standalone', 'withSubtasks']);
export type TodoType = z.infer<typeof todoTypeSchema>;

const isMongoObjectId = (value: string) =>
  value.length === 24 && /^[\da-f]{24}$/i.test(value);

export const mongoObjectIdSchema = z.string().refine(isMongoObjectId, 'Invalid MongoDB ObjectId.');

const isValidDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
};

export const taskDateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must use YYYY-MM-DD format.')
  .refine(isValidDateOnly, 'Due date must be a valid calendar date.');

const taskCreateDueDateSchema = z
  .union([z.literal(''), taskDateOnlySchema])
  .optional()
  .transform((value) => (value === '' ? undefined : value));
const taskUpdateDueDateSchema = z.union([z.literal(''), taskDateOnlySchema]).optional();

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

export const taskCreateSchema = taskBaseSchema.extend({
  dueDate: taskCreateDueDateSchema,
  priority: taskPrioritySchema.default('medium'),
  todoType: todoTypeSchema.default('standalone'),
  initialSubtasks: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
});
export const taskUpdateSchema = taskBaseSchema.extend({
  id: mongoObjectIdSchema,
  completionIntent: z.enum(['preserve', 'set']).default('preserve'),
  body: taskUpdateBodySchema,
  dueDate: taskUpdateDueDateSchema,
  priority: taskPrioritySchema.optional(),
});

export const taskEditFormSchema = taskUpdateSchema
  .omit({ id: true });
export const formSchema = taskCreateSchema;
export const taskToggleSchema = z.object({
  id: mongoObjectIdSchema,
  completed: z.boolean(),
});
export const taskIdSchema = z.object({
  id: mongoObjectIdSchema,
});

export type TaskFormValues = z.infer<typeof formSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskToggleInput = z.infer<typeof taskToggleSchema>;
export type TaskDeleteInput = z.infer<typeof taskIdSchema>;
