import AddTodoForm from "@/components/AddTodoForm";
import TodoTable from "@/components/todoTable";
import { getUserTodoListAction } from "@/prisma/actions/todo.action";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const {userId} = await auth()
  if (!userId) {
    redirect("/sign-in");
  }
  const todos = await getUserTodoListAction({userId});

  return (
    <div className="flex flex-col gap-5 items-center justify-center">
      
      <AddTodoForm userId={userId}/>  
      <TodoTable todos={todos}/>
    </div>
  );
}
