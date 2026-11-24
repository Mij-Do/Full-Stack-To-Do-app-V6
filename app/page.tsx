import AddTodoForm from '@/components/AddTodoForm';
import TodoDashboardMetrics from '@/components/TodoDashboardMetrics';
import TodoTable from '@/components/todoTable';
import { calculateTodoDashboardMetrics } from '@/lib/dashboard';
import { getUserTodos } from '@/prisma/queries/todo.query';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const todos = await getUserTodos(userId);
  const metrics = calculateTodoDashboardMetrics(todos);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">A clear view of your Todo workload and progress.</p>
        </div>
        <AddTodoForm />
      </div>
      <TodoDashboardMetrics metrics={metrics} />
      <section id="todos" aria-labelledby="todos-heading" className="space-y-3">
        <h2 id="todos-heading" className="text-lg font-semibold tracking-tight">Todos</h2>
        <TodoTable todos={todos} emptyMessage="You don't have any Todos yet." />
      </section>
    </main>
  );
}
