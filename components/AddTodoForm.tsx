'use client';

import { Button } from "@/components/ui/button";
import { Plus, X } from 'lucide-react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupText,
    InputGroupTextarea,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { formSchema, TodoFormValues } from "@/schema";
import { createTodoListAction } from "@/prisma/actions/todo.action";
import { Checkbox } from "./ui/checkbox";
import { useState } from "react";
import Spinner from "./spinner";

const AddTodoForm = ({userId}: {userId: string | null}) => {
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    
    const form = useForm<TodoFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            body: "",
            completed: false,
        },
    });

    const onSubmit = async (data: TodoFormValues) => {
        setLoading(true);
        try {
            await createTodoListAction({ title: data.title, body: data.body, completed: data.completed, userId });
            form.reset(); 
            setOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus />
                    New ToDo
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="title"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="add-title">Title</FieldLabel>
                                    <Input
                                        {...field}
                                        id="add-title"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="Title"
                                        autoComplete="off"
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="body"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="add-description">Description</FieldLabel>
                                    <InputGroup>
                                        <InputGroupTextarea
                                            {...field}
                                            id="add-description"
                                            placeholder="Description..."
                                            rows={6}
                                            className="min-h-24 resize-none"
                                            aria-invalid={fieldState.invalid}
                                        />
                                        <InputGroupAddon align="block-end">
                                            <InputGroupText className="tabular-nums" />
                                        </InputGroupAddon>
                                    </InputGroup>
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="completed"
                            control={form.control}
                            render={({ field: { onChange, value }, fieldState }) => (
                                <Field className="flex items-center gap-2" data-invalid={fieldState.invalid}>
                                    <Checkbox
                                        checked={value}
                                        onCheckedChange={onChange}
                                    />
                                    <FieldLabel>Completed</FieldLabel>
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                    
                    <DialogFooter className="mt-4">
                        <Field orientation="horizontal">
                            <DialogClose asChild>
                                <Button type="button" variant="outline"> <X /> </Button>
                            </DialogClose>
                            <Button type="button" variant="outline" onClick={() => form.reset()}>
                                Reset
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? <Spinner /> : "Submit"}
                            </Button>
                        </Field>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddTodoForm;