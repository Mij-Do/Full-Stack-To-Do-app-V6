import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

export const getUserTodoList = async (userId: string | null) => {
  if (!userId) {
    return [];
  }

  return await prisma.todo.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
