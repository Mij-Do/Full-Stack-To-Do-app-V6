import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ITodos } from "@/interfaces";
import { Badge } from "./ui/badge";
import TodosTableActions from "./TodosTableActions";

interface IProps {
    todos: ITodos[];
}

export default function TodoTable({ todos }: IProps) {
    if (!todos.length) {
        return (
            <div className="w-full text-center p-8 border rounded-lg text-muted-foreground">
                You Don't Have Todos Yet!!
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            {/* 1. Mobile View: Displayed as Cards below 'md' break point */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {todos.map((todo) => (
                    <div key={todo.id} className="p-4 border rounded-xl space-y-3 bg-card text-card-foreground shadow-sm">
                        <div className="flex items-center justify-between">
                            {todo.completed ? <Badge>Completed</Badge> : <Badge variant="destructive">UnCompleted</Badge>}
                        </div>
                        <div>
                            <h3 className="font-semibold text-base leading-tight">{todo.title}</h3>
                            {todo.body && <p className="text-sm text-muted-foreground mt-1">{todo.body}</p>}
                        </div>
                        <div className="pt-2 border-t flex justify-end items-center space-x-2">
                            <TodosTableActions todo={todo} />
                        </div>
                    </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm font-medium">
                    <span>Total:</span>
                    <span>{todos.length}</span>
                </div>
            </div>

            {/* 2. Desktop View: Standard HTML Table for 'md' screens and above */}
            <div className="hidden md:block w-full">
                <Table>
                    <TableCaption>A list of your Todos</TableCaption>
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
                                <TableCell>{todo.title}</TableCell>
                                <TableCell>{todo.body}</TableCell>
                                <TableCell>
                                    {todo.completed ? <Badge>Completed</Badge> : <Badge variant={"destructive"}>UnCompleted</Badge>}
                                </TableCell>
                                <TableCell className="flex items-center justify-end space-x-2">
                                    <TodosTableActions key={todo.id} todo={todo} />
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