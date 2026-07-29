import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ITodos } from '@/interfaces';
import { Badge } from './ui/badge';
import TodosTableActions from './TodosTableActions';

interface IProps {
  todos: ITodos[];
}

export default function TodoTable({ todos }: IProps) {
  if (!todos.length) {
    return (
      <div className="w-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        You don&apos;t have any todos yet.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="grid gap-4 md:hidden">
        {todos.map((todo) => (
          <div key={todo.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <h3 className="truncate font-semibold">{todo.title}</h3>
                {todo.body && <p className="text-sm text-muted-foreground">{todo.body}</p>}
              </div>
              {todo.completed ? <Badge>Completed</Badge> : <Badge variant="destructive">Uncompleted</Badge>}
            </div>
            <div className="mt-4 flex justify-end border-t pt-3">
              <TodosTableActions todo={todo} />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm font-medium">
          <span>Total</span>
          <span>{todos.length}</span>
        </div>
      </div>

      <div className="hidden w-full md:block">
        <Table>
          <TableCaption>A list of your todos.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Body</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {todos.map((todo) => (
              <TableRow key={todo.id}>
                <TableCell className="font-medium">{todo.title}</TableCell>
                <TableCell>{todo.body}</TableCell>
                <TableCell>
                  {todo.completed ? <Badge>Completed</Badge> : <Badge variant="destructive">Uncompleted</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <TodosTableActions todo={todo} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right">{todos.length}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}