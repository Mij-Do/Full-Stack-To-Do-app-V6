'use client';

import { useEffect, useRef, useState } from 'react';
import type { ITodoSubtask } from '@/interfaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createSubtaskAction, deleteSubtaskAction, toggleSubtaskAction, updateSubtaskAction } from '@/prisma/actions/subtask.action';

const EMPTY_SUBTASKS: ITodoSubtask[] = [];

export default function SubtaskChecklist({ todoId, initialSubtasks = EMPTY_SUBTASKS }: { todoId: string; initialSubtasks?: ITodoSubtask[] }) {
  const [subtasks, setSubtasks] = useState(initialSubtasks);
  useEffect(() => {
    const refresh = window.setTimeout(() => setSubtasks(initialSubtasks), 0);
    return () => window.clearTimeout(refresh);
  }, [initialSubtasks]);
  const [expanded, setExpanded] = useState(true);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const pendingRef = useRef(false);
  const done = subtasks.filter((item) => item.completed).length;
  const progress = subtasks.length ? Math.round((done / subtasks.length) * 100) : 0;
  const withPending = async (work: () => Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError('');
    try { await work(); } catch { setError('Could not save this subtask. Please try again.'); } finally { pendingRef.current = false; setPending(false); }
  };
  const add = () => withPending(async () => {
    const clean = title.trim();
    if (!clean) { setError('Enter a subtask title.'); return; }
    if (clean.length > 80) { setError('Subtask title must be at most 80 characters.'); return; }
    const created = await createSubtaskAction({ todoId, title: clean });
    setSubtasks((items) => [...items, created]);
    setTitle('');
  });
  return <section className="mt-3 rounded-[5px] border-l-[5px] border-primary/40 bg-muted/20 p-3" aria-label="Subtasks">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">Subtasks</h4>
      <Button type="button" size="sm" variant="ghost" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        {done} of {subtasks.length} completed · {progress}%
      </Button>
    </div>
    <div role="progressbar" aria-label="Subtask completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
    </div>
    {expanded && <div role="group" aria-label="Subtask checklist items" className="ml-2 mt-2 space-y-3 rounded-lg border bg-muted/30 p-3 sm:ml-4">
      {!subtasks.length && <p className="text-sm text-muted-foreground">No subtasks yet.</p>}
      {subtasks.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2">
        <input aria-label={`Complete ${item.title}`} type="checkbox" checked={item.completed} disabled={pending} onChange={(event) => {
          const completed = event.target.checked;
          void withPending(async () => { await toggleSubtaskAction({ todoId, id: item.id, completed }); setSubtasks((rows) => rows.map((row) => row.id === item.id ? { ...row, completed } : row)); });
        }} />
        {editing === item.id ? <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); void withPending(async () => { await updateSubtaskAction({ todoId, id: item.id, title: editTitle }); setSubtasks((rows) => rows.map((row) => row.id === item.id ? { ...row, title: editTitle.trim() } : row)); setEditing(null); }); }}>
          <Input aria-label="Edit subtask title" maxLength={80} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} disabled={pending} autoFocus />
          <Button type="submit" size="sm" disabled={pending}>Save</Button>
        </form> : <span className={`min-w-0 flex-1 break-words text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>}
        {editing !== item.id && <Button type="button" size="sm" variant="ghost" disabled={pending} aria-label={`Edit ${item.title}`} onClick={() => { setEditing(item.id); setEditTitle(item.title); }}>Edit</Button>}
        <Button type="button" size="sm" variant="ghost" disabled={pending} aria-label={`Delete ${item.title}`} onClick={() => void withPending(async () => { await deleteSubtaskAction({ todoId, id: item.id }); setSubtasks((rows) => rows.filter((row) => row.id !== item.id)); })}>Delete</Button>
      </div>)}
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void add(); }}>
        <Input aria-label="New subtask title" maxLength={80} placeholder="Add a subtask" value={title} onChange={(event) => setTitle(event.target.value)} disabled={pending} />
        <Button type="submit" size="sm" disabled={pending || !title.trim()}>Add subtask</Button>
      </form>
      {pending && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Saving subtask…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>}
  </section>;
}
