import AddTodoForm from '@/components/AddTodoForm';
import TodoTable from '@/components/todoTable';
import { getUserTodoList } from '@/prisma/queries/todo.query';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const todos = await getUserTodoList(userId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your todos</h1>
          <p className="text-sm text-muted-foreground">Keep track of what matters most.</p>
        </div>
        <AddTodoForm />
      </div>
      <TodoTable todos={todos} />
    </main>
  );
}
