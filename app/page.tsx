import AddTodoForm from '@/components/AddTodoForm';
import ListNavigation from '@/components/ListNavigation';
import TodoTable from '@/components/todoTable';
import { getUserListById, getUserLists, getUserTodoList } from '@/prisma/queries/todo.query';
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { todoListIdSchema } from '@/lib/validations/task';

interface HomeProps {
  searchParams: Promise<{ view?: string | string[]; list?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const requestedListId = typeof params.list === 'string' ? params.list : null;
  const hasListParameter = params.list !== undefined;
  const validListId =
    requestedListId && todoListIdSchema.safeParse(requestedListId).success ? requestedListId : null;
  if (hasListParameter && !validListId) notFound();
  const lists = await getUserLists(userId);
  const selectedList = validListId ? await getUserListById(userId, validListId) : null;
  if (validListId && !selectedList) notFound();
  const isArchivedIndex = !selectedList && params.view === 'archived';
  const selectedView = selectedList ? 'list' : isArchivedIndex ? 'archived' : 'inbox';
  const todos = isArchivedIndex
    ? []
    : await getUserTodoList(
        userId,
        selectedList ? { kind: 'list', listId: selectedList.id } : { kind: 'inbox' }
      );
  const pageTitle = selectedList?.name ?? (isArchivedIndex ? 'Archived Lists' : 'Inbox');

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">Keep track of what matters most.</p>
        </div>
        <AddTodoForm
          lists={lists}
          selectedListId={selectedList && !selectedList.isArchived ? selectedList.id : null}
        />
      </div>
      <ListNavigation
        lists={lists}
        selectedView={selectedView}
        selectedListId={selectedList?.id ?? null}
      />
      <TodoTable
        todos={todos}
        lists={lists}
        emptyMessage={
          isArchivedIndex
            ? 'Choose an archived List above to view its Todos.'
            : selectedList
              ? 'This List has no Todos yet.'
              : "You don't have any Inbox Todos yet."
        }
      />
    </main>
  );
}
