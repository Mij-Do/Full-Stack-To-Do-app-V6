import { z } from 'zod';
import { todoListIdSchema } from '@/lib/validations/task';

export const listNameSchema = z
  .string()
  .trim()
  .min(1, 'List name is required.')
  .max(40, 'List name must be at most 40 characters.');

export const listCreateSchema = z.object({
  name: listNameSchema,
});

export const listRenameSchema = z.object({
  id: todoListIdSchema,
  name: listNameSchema,
});

export const listIdActionSchema = z.object({
  id: todoListIdSchema,
});

export type ListCreateInput = z.infer<typeof listCreateSchema>;
export type ListRenameInput = z.infer<typeof listRenameSchema>;
export type ListIdActionInput = z.infer<typeof listIdActionSchema>;
