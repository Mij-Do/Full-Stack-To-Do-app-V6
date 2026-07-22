import AddTodoForm from "@/components/AddTodoForm";
import TodoTable from "@/components/todoTable";
import { getTodoListAction } from "@/prisma/actions/todo.action";

export default async function Home() {
  const todos = await getTodoListAction();

  return (
    <div className="flex flex-col gap-5 items-center justify-center">
      <AddTodoForm />  
      <TodoTable todos={todos}/>
    </div>
  );
}
