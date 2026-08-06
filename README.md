**Project Overview**
- **Name:** Full Stack To‑Do App (V6)
- **Description:** A production-ready full-stack to‑do application built with Next.js (App Router), TypeScript, Prisma, and MongoDB. It includes server actions, optimistic UI updates, Zod validation, and unit tests with Vitest and React Testing Library.

**Features**
- **User authentication:** Clerk integration for sign-in and sign-up flows.
- **CRUD for todos:** Create, read, update, delete tasks with server-side validation.
- **Optimistic UI:** Instant UI updates for completes/deletes with rollback on error.
- **Robust validation:** Centralized Zod schemas for request validation.
- **Testing:** Schema and component tests using Vitest and React Testing Library.

**Tech Stack**
- **Framework:** Next.js (App Router) — server components, routing, and server actions.
- **Language:** TypeScript for type-safety across server and client.
- **Database ORM:** Prisma (Client + Migrations) — schema in [prisma/schema.prisma](prisma/schema.prisma).
- **Database:** MongoDB (configured via Prisma datasource).
- **Validation:** Zod for runtime schema validation located at `lib/validations/task.ts`.
- **Styling:** Tailwind CSS and shared UI components from the `components/ui` folder.
- **Forms:** react-hook-form with `@hookform/resolvers` for Zod integration.
- **Testing:** Vitest + @testing-library/react and jest-dom for unit tests.

**Repository Structure (high level)**
- **app/**: Next.js App Router pages and route handlers, including `page.tsx`, `loading.tsx`, `error.tsx`.
- **components/**: UI components and forms including `AddTodoForm.tsx`, `EditTodoForm.tsx`, and `todoTable.tsx`.
- **lib/validations/**: Zod schemas for tasks (`lib/validations/task.ts`).
- **prisma/**: Prisma schema and server actions (`prisma/actions/todo.action.ts`).
- **tests/**: Vitest unit tests for validation and components.

**Getting Started (Local Development)**
1. Install dependencies

```bash
npm install
```

2. Environment
- Create a `.env` file at the project root. Typical variables (example names — adapt to your setup):

```
DATABASE_URL="mongodb+srv://<user>:<pass>@cluster.example.mongodb.net/mydb?retryWrites=true&w=majority"
NEXT_PUBLIC_CLERK_FRONTEND_API=...
CLERK_API_KEY=...
```

3. Prisma generate / migrate (development)

```bash
npx prisma generate
# If you use migrations with a SQL DB, run: npx prisma migrate dev
```

4. Run the app

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

**Testing**
- Run unit tests:

```bash
npm test
```

Tests are located in the `tests/` folder and cover Zod schemas and key client components.

**Development Notes & Best Practices**
- Centralize validation: `lib/validations/task.ts` is the single source of truth for request payloads.
- Server Actions: All server-side CRUD operations live in `prisma/actions/todo.action.ts` and call Zod validators before executing Prisma operations.
- Optimistic UI: `components/todoTable.tsx` uses React’s optimistic update pattern to keep interactions feeling instant.
- Strict typing: The codebase uses TypeScript `strict` mode — avoid `any` and prefer explicit types.

**Deployment**
- Build for production:

```bash
npm run build
```

- Ensure environment variables are configured on your hosting platform and that the `DATABASE_URL` points to a production MongoDB instance. Re-run `prisma generate` if needed during CI.

**Contributing**
- Fork the repo, create a feature branch, run tests locally, and open a pull request describing your changes.

**Further Improvements (ideas)**
- Add E2E tests (Playwright/Cypress).
- Add CI pipeline for linting, tests, and deployment.
- Add pagination, filtering, and user preferences for sorting.

**License & Contact**
- Add your preferred license file to the repository (e.g., `LICENSE`).
- For questions, open an issue or contact the maintainer listed in project metadata.

---
_Generated README — tailored for this Next.js + Prisma + MongoDB to-do app._
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
