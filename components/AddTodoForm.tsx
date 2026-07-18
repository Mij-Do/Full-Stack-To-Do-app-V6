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
import { Input } from "@/components/ui/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { formSchema, TodoFormValues } from "@/schema";
import z from "zod";
import { createTodoListAction } from "@/prisma/actions/todo.action";


const AddTodoForm = () => {
    
    const form = useForm<TodoFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            body: "",
        },
    });

    const onSubmit = async (data: TodoFormValues) => {
        await createTodoListAction({title: data.title, body: data.body});
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <Plus />
                    New ToDo
                </Button>
            </DialogTrigger>
            <form id="form-rhf-demo" onSubmit={form.handleSubmit(onSubmit)}>
                <DialogContent className="sm:max-w-sm">
                    
                    <FieldGroup>
                        <Controller
                        name="title"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-rhf-demo-title">
                                Title
                            </FieldLabel>
                            <Input
                                {...field}
                                id="form-rhf-demo-title"
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
                            <FieldLabel htmlFor="form-rhf-demo-description">
                                Description
                            </FieldLabel>
                            <InputGroup>
                                <InputGroupTextarea
                                {...field}
                                id="form-rhf-demo-description"
                                placeholder="I'm having an issue with the login button on mobile."
                                rows={6}
                                className="min-h-24 resize-none"
                                aria-invalid={fieldState.invalid}
                                />
                                <InputGroupAddon align="block-end">
                                <InputGroupText className="tabular-nums">
                                    {/* {field.value.length}/100 characters */}
                                </InputGroupText>
                                </InputGroupAddon>
                            </InputGroup>
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                            </Field>
                        )}
                        />
                    </FieldGroup>
                    
                    <DialogFooter>
                    <Field orientation="horizontal">
                        <DialogClose asChild>
                        <Button> <X /> </Button>
                        </DialogClose>
                        <Button type="button" variant="outline" onClick={() => form.reset()}>
                        Reset
                        </Button>
                        <Button type="submit" form="form-rhf-demo">
                            Submit
                        </Button>
                    </Field>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    )
}

export default AddTodoForm;