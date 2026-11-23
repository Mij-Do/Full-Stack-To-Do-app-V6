import type { TaskPriority } from '@/lib/validations/task';

export interface ITodos {
    id: string;
    title: string;
    body: string | null;
    completed: boolean;
    createdAt?: Date;
    dueDate?: Date | string | null;
    priority?: TaskPriority | null;
}