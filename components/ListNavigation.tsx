'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useRef, useState } from 'react';
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
type PendingAction = 'create' | 'archive' | 'delete' | null;

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
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [renamePending, setRenamePending] = useState(false);
  const renamePendingRef = useRef(false);
  const renameSessionRef = useRef(0);
  const activeLists = lists.filter((list) => !list.isArchived);
  const archivedLists = lists.filter((list) => list.isArchived);
  const selectedList = lists.find((list) => list.id === selectedListId);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingAction) return;
    setError(null);
    setPendingAction('create');
    try {
      const list = await createListAction({ name: newName });
      setNewName('');
      router.push(`/?list=${encodeURIComponent(list.id)}`);
    } catch {
      setError('Could not create the List. Check its name and try again.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingListId || renamePendingRef.current) return;
    const listId = editingListId;
    const name = editingName;
    const renameSession = renameSessionRef.current;
    renamePendingRef.current = true;
    setRenamePending(true);
    setError(null);
    try {
      await renameListAction({ id: listId, name });
      if (renameSessionRef.current === renameSession) {
        setEditingListId(null);
      }
      router.refresh();
    } catch {
      if (renameSessionRef.current === renameSession) {
        setError('Could not rename the List. Check its name and try again.');
      }
    } finally {
      renamePendingRef.current = false;
      setRenamePending(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedList || pendingAction) return;
    setError(null);
    setPendingAction('archive');
    try {
      await archiveListAction({ id: selectedList.id });
      router.push('/?view=archived');
    } catch {
      setError('Could not archive this List. Please try again.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedList || pendingAction) return;
    setError(null);
    setPendingAction('delete');
    try {
      await deleteEmptyListAction({ id: selectedList.id });
      router.replace(selectedList.isArchived ? '/?view=archived' : '/?view=inbox');
    } catch (error) {
      setError(
        error instanceof Error && error.message === LIST_NOT_EMPTY_MESSAGE
          ? 'This List still contains Todos. Move or delete them before deleting the List.'
          : 'Could not delete this List right now. Please try again.'
      );
    } finally {
      setPendingAction(null);
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
        <Button type="submit" variant="outline" disabled={pendingAction !== null}>
          {pendingAction === 'create' ? 'Creating...' : 'Create'}
        </Button>
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
                disabled={renamePending}
              />
              <Button type="submit" variant="outline" disabled={renamePending}>
                {renamePending ? 'Saving...' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  renameSessionRef.current += 1;
                  setEditingListId(null);
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pendingAction !== null || renamePending}
                onClick={() => {
                  renameSessionRef.current += 1;
                  setEditingListId(selectedList.id);
                  setEditingName(selectedList.name);
                }}
              >
                Rename
              </Button>
              {!selectedList.isArchived && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pendingAction !== null}
                  onClick={handleArchive}
                >
                  {pendingAction === 'archive' ? 'Archiving...' : 'Archive'}
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                disabled={(selectedList.todoCount ?? 0) > 0 || pendingAction !== null}
                onClick={handleDelete}
              >
                {pendingAction === 'delete' ? 'Deleting...' : 'Delete empty List'}
              </Button>
            </>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </aside>
  );
}
