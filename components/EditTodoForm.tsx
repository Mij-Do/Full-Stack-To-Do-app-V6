'use client';

import { Button } from "@/components/ui/button";
import { Pen, X } from 'lucide-react';
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
import { updateTodoListAction } from "@/prisma/actions/todo.action";
import { Checkbox } from "./ui/checkbox";
import { useState } from "react";
import Spinner from "./spinner";
import { ITodos } from "@/interfaces";

interface IProps {
    todo: ITodos;
}

const EditTodoForm = ({ todo }: IProps) => {
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const form = useForm<TodoFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: todo.title,
            body: (todo.body as string) || "",
            completed: todo.completed,
        },
    });

    const onSubmit = async (data: TodoFormValues) => {
        setLoading(true);
        try {
            await updateTodoListAction({
                id: todo.id,
                title: data.title,
                body: data.body as string,
                completed: data.completed,
            });
            setOpen(false);
        } catch (error) {
            console.error("Failed to update todo:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="icon">
                    <Pen size={16} />
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
                                    <FieldLabel htmlFor="edit-title">Edit Title</FieldLabel>
                                    <Input
                                        {...field}
                                        id="edit-title"
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
                                    <FieldLabel htmlFor="edit-description">Edit Description</FieldLabel>
                                    <InputGroup>
                                        <InputGroupTextarea
                                            {...field}
                                            id="edit-description"
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
                                <Field className="flex w-5 items-center gap-2" data-invalid={fieldState.invalid}>
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
                                <Button type="button" variant="outline">
                                    <X size={16} />
                                </Button>
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

export default EditTodoForm;