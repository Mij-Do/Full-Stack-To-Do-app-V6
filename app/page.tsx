import AddTodoForm from "@/components/AddTodoForm";
import TodoTable from "@/components/todoTable";
import { getTodoListAction } from "@/prisma/actions/todo.action";

export default async function Home() {
  const todos = await getTodoListAction();
  


  return (
    // <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
    <div className="container">  
      <TodoTable />
      <ul>
        {todos.map(todo => <li key={todo.id}> {todo.title} </li>)}
      </ul>
      <AddTodoForm />
    </div>
  );
}
