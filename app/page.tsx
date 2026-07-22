import AddTodoForm from "@/components/AddTodoForm";
import TodoTable from "@/components/todoTable";
import { getTodoListAction } from "@/prisma/actions/todo.action";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const {userId} = await auth()
  const todos = await getTodoListAction();

  return (
    <div className="flex flex-col gap-5 items-center justify-center">
      <AddTodoForm userId={userId}/>  
      <TodoTable todos={todos}/>
    </div>
  );
}
