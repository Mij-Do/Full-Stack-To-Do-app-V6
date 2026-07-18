'use server'

import { PrismaClient } from "../../generated/prisma";


const prisma = new PrismaClient();

export const getTodoListAction = async () => {
    return await prisma.todo.findMany();
}
export const createTodoListAction = async ({title, body}: {title: string, body?: string | undefined}) => {
    await prisma.todo.create({
        data: {
            title,
            body
        }
    })
}
export const updateTodoListAction = async () => {}
export const deleteTodoListAction = async () => {}