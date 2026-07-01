import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <Button>
          <Plus />
          New ToDo
        </Button>
    </div>
  );
}
