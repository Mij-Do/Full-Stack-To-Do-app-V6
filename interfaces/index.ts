import type { TaskPriority } from '@/lib/validations/task';

export interface ITodoList {
    id: string;
    name: string;
    isArchived: boolean;
    todoCount?: number;
}

export interface ITodos {
    id: string;
    title: string;
    body: string | null;
    completed: boolean;
    createdAt?: Date;
    dueDate?: Date | string | null;
    priority?: TaskPriority | null;
    listId?: string | null;
}