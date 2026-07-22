"use client"

import { Pen, Trash } from 'lucide-react';
import { Button } from './ui/button';
import Spinner from './spinner';
import { useState } from 'react';
import { deleteTodoListAction } from '@/prisma/actions/todo.action';
import EditTodoForm from './EditTodoForm';
import { ITodos } from '@/interfaces';

interface IProps {
    todo: ITodos;
}

const TodosTableActions = ({todo}: IProps) => {
    const [loading, setLoading] = useState(false);
    return (
        <div className='w-full flex flex-row justify-between items-center md:justify-end md:gap-1'>
            <EditTodoForm key={todo.id} todo={todo}/>
            <Button 
                size={"icon"} 
                variant={"destructive"}
                disabled={loading}
                onClick={async () => {
                    setLoading(true);
                    await deleteTodoListAction({ id : todo.id});
                    setLoading(false);
                }}
            >
                {loading ? <Spinner /> : <Trash size={16}/>}
            </Button>
        </div>
    )
}

export default TodosTableActions;   