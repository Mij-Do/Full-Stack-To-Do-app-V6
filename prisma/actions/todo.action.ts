'use server'

import { revalidatePath } from "next/cache";
import { PrismaClient } from "../../generated/prisma";
import { ITodos } from "@/interfaces";


const prisma = new PrismaClient();

export const getTodoListAction = async () => {
    return await prisma.todo.findMany({
        orderBy: {
            createdAt: "desc",
        }
    });
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
export const updateTodoListAction = async ({id, title, body, completed}: ITodos) => {
    await prisma.todo.update({
        where: {
            id,
        },
        data: {
            title,
            body,
            completed,
        }
    });
    revalidatePath("/");
}