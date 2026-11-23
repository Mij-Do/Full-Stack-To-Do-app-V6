'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import type { ITodoList } from '@/interfaces';
import {
  archiveListAction,
  createListAction,
  deleteEmptyListAction,
  renameListAction,
} from '@/prisma/actions/list.action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LIST_NOT_EMPTY_MESSAGE } from '@/prisma/actions/action-errors';

type SelectedView = 'inbox' | 'archived' | 'list';

interface ListNavigationProps {
  lists: ITodoList[];
  selectedView: SelectedView;
  selectedListId: string | null;
}

const linkClass = (selected: boolean) =>
  `block rounded-md px-3 py-2 text-sm ${selected ? 'bg-muted font-medium' : 'hover:bg-muted/60'}`;

export default function ListNavigation({
  lists,
  selectedView,
  selectedListId,
}: ListNavigationProps) {
  const router = useRouter();
  const [newName, setNewName] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const activeLists = lists.filter((list) => !list.isArchived);
  const archivedLists = lists.filter((list) => list.isArchived);
  const selectedList = lists.find((list) => list.id === selectedListId);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      const list = await createListAction({ name: newName });
      setNewName('');
      router.push(`/?list=${encodeURIComponent(list.id)}`);
    } catch {
      setError('Could not create the List. Check its name and try again.');
    }
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingListId) return;
    setError(null);
    try {
      await renameListAction({ id: editingListId, name: editingName });
      setEditingListId(null);
      router.refresh();
    } catch {
      setError('Could not rename the List. Check its name and try again.');
    }
  };

  const handleArchive = async () => {
    if (!selectedList) return;
    setError(null);
    try {
      await archiveListAction({ id: selectedList.id });
      router.push('/?view=archived');
    } catch {
      setError('Could not archive this List. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!selectedList) return;
    setError(null);
    try {
      await deleteEmptyListAction({ id: selectedList.id });
      router.push(selectedList.isArchived ? '/?view=archived' : '/?view=inbox');
    } catch (error) {
      setError(
        error instanceof Error && error.message === LIST_NOT_EMPTY_MESSAGE
          ? 'This List still contains Todos. Move or delete them before deleting the List.'
          : 'Could not delete this List right now. Please try again.'
      );
    }
  };

  return (
    <aside aria-label="Todo Lists" className="space-y-4 rounded-xl border p-4">
      <nav className="space-y-1">
        <Link
          href="/?view=inbox"
          className={linkClass(selectedView === 'inbox')}
          aria-current={selectedView === 'inbox' ? 'page' : undefined}
        >
          Inbox
        </Link>
        <p className="px-3 pt-3 text-xs font-medium uppercase text-muted-foreground">Lists</p>
        {activeLists.map((list) => (
          <Link
            key={list.id}
            href={`/?list=${encodeURIComponent(list.id)}`}
            className={linkClass(selectedListId === list.id)}
            aria-current={selectedListId === list.id ? 'page' : undefined}
          >
            {list.name} <span className="text-muted-foreground">({list.todoCount ?? 0})</span>
          </Link>
        ))}
        <Link
          href="/?view=archived"
          className={linkClass(selectedView === 'archived' || Boolean(selectedList?.isArchived))}
          aria-current={selectedView === 'archived' ? 'page' : undefined}
        >
          Archived Lists
        </Link>
        {archivedLists.map((list) => (
          <Link
            key={list.id}
            href={`/?list=${encodeURIComponent(list.id)}`}
            className={`ml-3 ${linkClass(selectedListId === list.id)}`}
            aria-current={selectedListId === list.id ? 'page' : undefined}
          >
            {list.name} <span className="text-muted-foreground">({list.todoCount ?? 0})</span>
          </Link>
        ))}
      </nav>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          aria-label="New List name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New List"
          maxLength={40}
        />
        <Button type="submit" variant="outline">Create</Button>
      </form>

      {selectedList && (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {editingListId === selectedList.id ? (
            <form onSubmit={handleRename} className="flex w-full gap-2">
              <Input
                aria-label="Rename List"
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                maxLength={40}
              />
              <Button type="submit" variant="outline">Save</Button>
              <Button type="button" variant="ghost" onClick={() => setEditingListId(null)}>
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingListId(selectedList.id);
                  setEditingName(selectedList.name);
                }}
              >
                Rename
              </Button>
              {!selectedList.isArchived && (
                <Button type="button" variant="outline" onClick={handleArchive}>
                  Archive
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                disabled={(selectedList.todoCount ?? 0) > 0}
                onClick={handleDelete}
              >
                Delete empty List
              </Button>
            </>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </aside>
  );
}
