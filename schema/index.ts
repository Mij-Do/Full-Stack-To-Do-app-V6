import * as z from "zod"

export const formSchema = z.object({
    title: z
        .string()
        .min(5, "Title must be at least 5 characters.")
        .max(32, "Title must be at most 32 characters."),
    body: z
        .string()
        .min(10, "Body must be at least 10 characters.")
        .max(100, "Body must be at most 100 characters.").optional(),
    completed: z
                .boolean(),
});

export type TodoFormValues = z.infer<typeof formSchema>;