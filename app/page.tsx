import AddTodoForm from "@/components/AddTodoForm";
import TodoTable from "@/components/todoTable";
import { getTodoListAction } from "@/prisma/actions/todo.action";

export default async function Home() {
  const todos = await getTodoListAction();

  return (
    // <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
    <div className="container">  
      <AddTodoForm />
      <TodoTable todos={todos}/>
    </div>
  );
}
