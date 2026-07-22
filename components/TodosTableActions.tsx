"use client"

import { Pen, Trash } from 'lucide-react';
import { Button } from './ui/button';
import Spinner from './spinner';
import { useState } from 'react';
import { deleteTodoListAction } from '@/prisma/actions/todo.action';

interface IProps {
    id: string;
}

const TodosTableActions = ({id}: IProps) => {
    const [loading, setLoading] = useState(false);
    return (
        <>
            <Button size={"icon"}>
                <Pen size={16}/>
            </Button>
            <Button 
                size={"icon"} 
                variant={"destructive"}
                disabled={loading}
                onClick={async () => {
                    setLoading(true);
                    await deleteTodoListAction({id});
                    setLoading(false);
                }}
            >
                {loading ? <Spinner /> : <Trash size={16}/>}
            </Button>
        </>
    )
}

export default TodosTableActions;   