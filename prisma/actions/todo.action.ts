'use server'

import { revalidatePath } from "next/cache";
import { PrismaClient } from "../../generated/prisma";


const prisma = new PrismaClient();

export const getTodoListAction = async () => {
    return await prisma.todo.findMany();
}
export const createTodoListAction = async ({title, body, completed}: {title: string, body?: string | undefined, completed?: boolean}) => {
    await prisma.todo.create({
        data: {
            title,
            body,
            completed,
        }
    });
    revalidatePath("/");
}
export const deleteTodoListAction = async ({id}: {id: string}) => {
    await prisma.todo.delete({
        where: {
            id,
        }
    });
    revalidatePath("/");
}
export const updateTodoListAction = async () => {}