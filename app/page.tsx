import AddTodoForm from "@/components/AddTodoForm";

export default function Home() {
  // const todos = await getTodoListAction();
  


  return (
    // <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
    <div className="container">  
      {/* <pre>{ JSON.stringify(todos, undefined, 2) }</pre> */}
        <AddTodoForm />
    </div>
  );
}
