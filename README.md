# Full Stack To-Do App (V6)

A full-stack Todo application built with Next.js App Router, TypeScript, Prisma, and MongoDB. Todos appear in one unified view. A Todo can be standalone or include a checklist of one-level subtasks.

## Features

- Clerk authentication with server-derived ownership checks.
- Todo creation, editing, completion, and deletion.
- Explicit creation choice between **Standalone Todo** and **Todo with Subtasks**. Parent and initial subtasks are created together.
- Checklist progress, inline subtask add/edit/toggle/delete, and parent/child completion synchronization.
- Search, active/completed filters, sorting, and optimistic Todo completion/deletion with rollback.
- Zod validation and focused Vitest/React Testing Library coverage.

## Stack and source layout

- `app/`: App Router page and route handlers.
- `components/`: Todo forms, unified Todo view, and checklist UI.
- `lib/validations/`: request schemas.
- `prisma/schema.prisma`: MongoDB models; `prisma/actions/` and `prisma/queries/` contain server data operations.
- `tests/`: unit and component tests.

## Local development

1. Install dependencies with `npm install`.
2. Configure `.env` with `DATABASE_URL` and `.env.local` with Clerk keys. Keep real values out of source control.
3. Regenerate Prisma Client after schema changes:

   ```bash
   npx prisma generate
   ```

4. Start the app with `npm run dev` and open <http://localhost:3000>.

For this Todo/Subtask schema update, Prisma Client regeneration is pending. A database schema sync must be separately reviewed and approved before it is run, including confirmation that existing Todo documents remain intact and the obsolete TodoList collection is retained. No database synchronization or data cleanup is performed by the application source change itself. Existing MongoDB Todo documents remain ordinary Todos; legacy `listId` values are ignored by the unified query.

## Tests

Run unit tests with `npm run test:unit`.

## Development notes

- Server actions derive the user ID from Clerk and validate payloads before database operations.
- Parent/child mutations use owner-scoped filters and guarded transactions to keep completion state aligned.
- `components/todoTable.tsx` retains optimistic completion and deletion rollback behavior.
