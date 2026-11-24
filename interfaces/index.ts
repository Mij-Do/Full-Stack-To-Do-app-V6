import type { RecurrenceFrequency, TaskPriority } from '@/lib/validations/task';

export interface ITodos {
    id: string;
    title: string;
    body: string | null;
    completed: boolean;
    createdAt?: Date;
    dueDate?: Date | string | null;
    priority?: TaskPriority | null;
    todoType?: 'standalone' | 'withSubtasks';
    subtasks?: ITodoSubtask[];
    recurrence?: {
        id: string;
        frequency: RecurrenceFrequency;
        interval: number;
        active: boolean;
        isCurrent: boolean;
    } | null;
}

export interface ITodoSubtask {
    id: string;
    todoId: string;
    title: string;
    completed: boolean;
    createdAt: Date | string;
}
