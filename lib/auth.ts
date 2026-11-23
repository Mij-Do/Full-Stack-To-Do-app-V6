import { auth } from '@clerk/nextjs/server';

export const requireUserId = async (): Promise<string> => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  return userId;
};
