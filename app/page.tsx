import AddTodoForm from "@/components/AddTodoForm";
import TodoTable from "@/components/todoTable";
import { getTodoListAction } from "@/prisma/actions/todo.action";

export default async function Home() {
  const todos = await getTodoListAction();

  return (
    <div className="container mx-auto flex flex-col flex-1 items-center justify-center">
      <AddTodoForm />  
      <TodoTable todos={todos}/>
    </div>
  );
}
