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


export default function TodoTable({todos}: IProps) {
    return (
        <Table>
        <TableCaption>A list of your recent invoices.</TableCaption>
        <TableHeader>
            <TableRow>
                <TableHead className="w-25">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Body</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {todos.map((todo) => (
            <TableRow key={todo.id}>
                <TableCell className="font-medium">{todo.id}</TableCell>
                <TableCell>{todo.title}</TableCell>
                <TableCell>{todo.body}</TableCell>
                <TableCell>
                    {todo.completed ? <Badge>Completed</Badge> : <Badge variant={"destructive"}>UnCompleted</Badge> }
                </TableCell>
                <TableCell className="flex items-center justify-end space-x-2">
                    <TodosTableActions id={todo.id}/>
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
    )
}
