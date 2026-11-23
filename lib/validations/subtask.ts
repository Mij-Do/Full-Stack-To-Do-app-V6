import { z } from 'zod';
import { mongoObjectIdSchema } from '@/lib/validations/task';

const titleSchema = z.string().trim().min(1, 'Subtask title is required.').max(80, 'Subtask title must be at most 80 characters.');

export const subtaskCreateSchema = z.object({ todoId: mongoObjectIdSchema, title: titleSchema });
export const subtaskUpdateSchema = z.object({ todoId: mongoObjectIdSchema, id: mongoObjectIdSchema, title: titleSchema });
export const subtaskToggleSchema = z.object({ todoId: mongoObjectIdSchema, id: mongoObjectIdSchema, completed: z.boolean() });
export const subtaskDeleteSchema = z.object({ todoId: mongoObjectIdSchema, id: mongoObjectIdSchema });

export type SubtaskCreateInput = z.infer<typeof subtaskCreateSchema>;
export type SubtaskUpdateInput = z.infer<typeof subtaskUpdateSchema>;
export type SubtaskToggleInput = z.infer<typeof subtaskToggleSchema>;
export type SubtaskDeleteInput = z.infer<typeof subtaskDeleteSchema>;
