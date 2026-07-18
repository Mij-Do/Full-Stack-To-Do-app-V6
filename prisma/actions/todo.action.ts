'use server'

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
    })
}
export const updateTodoListAction = async () => {}
export const deleteTodoListAction = async () => {}