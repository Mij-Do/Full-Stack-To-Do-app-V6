# Full Stack To-Do App (V6)

A full-stack Todo application built with Next.js App Router, TypeScript, Prisma, and MongoDB. Todos appear in one unified view. A Todo can be standalone or include a checklist of one-level subtasks.

## Features

- Clerk authentication with server-derived ownership checks.
- Todo creation, editing, completion, and deletion.
- Dashboard counts for top-level Todos, completion rate, and UTC due-date status.
- Daily, weekly, and monthly Todo recurrence with separate occurrence history and a stop-series action.
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

Recurrence uses MongoDB multi-document transactions to create each next occurrence, copy checklist children, and advance the series cursor atomically. MongoDB transactions require a replica set or sharded cluster; a standalone local `mongod` is not sufficient. The project cannot infer transaction support from the connection string alone, so verify the actual target deployment separately. Mocked tests do not prove database transaction rollback or concurrency behavior.

After schema changes, regenerate Prisma Client with `npx prisma generate`. Review and approve database synchronization separately before applying it, including a data-preservation plan for existing Todo documents and the obsolete TodoList collection. No database synchronization or cleanup is performed by the application source change.

## Tests

Run unit tests with `npm run test:unit`.

### MongoDB integration tests

The separate `npm run test:integration` suite uses the real Prisma client and requires a disposable, single-node MongoDB replica set. Before running it, manually confirm that `TEST_DATABASE_URL` points only to a disposable local replica set and contains no production or shared-development data. Start a local `mongod` using a temporary data directory and a replica-set name such as `rs0` (for example, `mongod --replSet rs0 --bind_ip 127.0.0.1 --port 27017 --dbpath <temporary-disposable-directory>`), then initialize it once with `mongosh --host 127.0.0.1:27017 --eval 'rs.initiate()'` and wait until it is PRIMARY. A standalone MongoDB server cannot run the transaction scenarios.

Set `TEST_DATABASE_URL` to the exact dedicated local database `todo_v6_integration` and include the configured replica-set name, for example `mongodb://127.0.0.1:27017/todo_v6_integration?replicaSet=rs0`. The integration setup rejects a missing value, invalid URI, non-local host, any other database name, missing replica-set parameter, and a connection target matching `DATABASE_URL`; it never falls back to `DATABASE_URL`. URL validation cannot reliably detect local port forwarding or tunnels to a remote MongoDB server, so manual confirmation of the actual target remains required. The ordinary unit-test configuration excludes `tests/integration/` and does not require MongoDB. Do not point this variable at production or a shared development database, and do not add credentials to source control.

Each test uses a unique owner ID and removes only that owner's Subtasks, Todos, and recurrence records. The suite does not drop databases or collections. Its single-node replica set can verify real transaction rollback and application-level competing requests, but it does not model elections, network partitions, or multi-node production behavior. Concurrent completion permits a competing request to receive a retry error; the invariant is that only one next occurrence and cursor advance persist.

## Development notes

- Server actions derive the user ID from Clerk and validate payloads before database operations.
- Parent/child mutations use owner-scoped filters and guarded transactions to keep completion state aligned.
- `components/todoTable.tsx` retains optimistic completion and deletion rollback behavior.
