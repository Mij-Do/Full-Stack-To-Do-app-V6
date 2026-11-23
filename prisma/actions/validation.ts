import { taskCreateSchema, taskIdSchema, taskToggleSchema, taskUpdateSchema } from '@/lib/validations/task';
import { TaskCreateInput, TaskDeleteInput, TaskToggleInput, TaskUpdateInput } from '@/lib/validations/task';
import {
  listCreateSchema,
  listIdActionSchema,
  listRenameSchema,
  ListCreateInput,
  ListIdActionInput,
  ListRenameInput,
} from '@/lib/validations/list';

export const validateTaskCreate = (payload: unknown): TaskCreateInput => {
  return taskCreateSchema.parse(payload);
};

export const validateTaskUpdate = (payload: unknown): TaskUpdateInput => {
  return taskUpdateSchema.parse(payload);
};

export const validateTaskToggle = (payload: unknown): TaskToggleInput => {
  return taskToggleSchema.parse(payload);
};

export const validateTaskDelete = (payload: unknown): TaskDeleteInput => {
  return taskIdSchema.parse(payload);
};

export const validateListCreate = (payload: unknown): ListCreateInput => {
  return listCreateSchema.parse(payload);
};

export const validateListRename = (payload: unknown): ListRenameInput => {
  return listRenameSchema.parse(payload);
};

export const validateListIdAction = (payload: unknown): ListIdActionInput => {
  return listIdActionSchema.parse(payload);
};
