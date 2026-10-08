# Table for Everyone

A mobile-first, diet-aware dining journal for friend groups with mixed diets (vegans dining with
steak lovers). Log a visit in about 30 seconds, rate how well it worked for each dietary need, and
reuse a trusted shortlist when planning the next night out.

> **Status:** front end only. All data comes from a mock layer persisted to `localStorage`.
> There is no back end yet. See [How to swap in Supabase](#how-to-swap-in-supabase).

## Setup

Requires Node 22.22+ and npm.

```bash
npm install
npm run dev      # http://localhost:5173
```

## Scripts

| Script               | What it does                              |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Start the Vite dev server                 |
| `npm run build`      | Type-check (`tsc -b`) and build for prod  |
| `npm run preview`    | Serve the production build locally        |
| `npm run lint`       | ESLint (includes a11y and import rules)   |
| `npm test`           | Run the Vitest suite once                 |
| `npm run test:watch` | Vitest in watch mode                      |
| `npm run typecheck`  | TypeScript only                           |
| `npm run format`     | Prettier write (`format:check` to verify) |

## Stack

React + TypeScript (strict), Vite, React Router, Tailwind CSS v4, TanStack Query,
React Hook Form + Zod, Vitest + React Testing Library, ESLint + Prettier.

## Architecture

```
src/
  app/        router, providers, layout shell (SideNav on md+, BottomTabBar below)
  components/ reusable UI primitives (Button, Chip, Card, EmptyState, ...)
  features/   one folder per screen area (restaurants, visits, go-back, plan-night, share, profile)
  data/       repository interfaces + mock implementations (index.ts is the single DI point)
  hooks/      shared hooks (TanStack Query hooks live in hooks/queries)
  lib/        utilities and formatting
  types/      domain types and Zod schemas
  styles/     Tailwind entry + design tokens (tokens.css)
```

- **Design tokens** live in `src/styles/tokens.css` using Tailwind v4's `@theme`. Every token is
  also a utility class (`bg-primary`, `text-ink-muted`, `rounded-card`, `min-h-touch`...).
- **Data access rule:** components and hooks never import the mock layer. ESLint enforces this
  (`no-restricted-imports`); only `src/data/index.ts` may import `src/data/mock`.
- **Accessibility:** semantic landmarks, a skip link, visible focus rings, 44px touch targets,
  AA-checked colour pairs, and `prefers-reduced-motion` support are built in.

### Data layer

```
components / features
        │  call
        ▼
src/hooks/queries/*        TanStack Query hooks (useRestaurants, useCreateVisit, ...)
        │  read repositories from React context
        ▼
src/data/repositoryContext.ts  ←  <RepositoryProvider> in src/app/providers.tsx
        │  value comes from
        ▼
src/data/index.ts          createRepositories()   ← the ONE file that picks an implementation
        │
        ▼
src/data/mock/*            in-memory data persisted to localStorage (swap for src/data/supabase/*)
```

- **Types** live in `src/types`: each domain has a Zod schema and a TypeScript type inferred
  from it (`Restaurant`, `Visit`, `DietRating`, `Dish`, `GoBackEntry`, `DietLens`, `PriceTier`,
  `User`). Field names are camelCase.
- **Repositories** are interfaces in `src/data/repositories` (`list`, `getById`, `create`,
  `update`, `remove`, plus a few extras such as `VisitRepository.listByRestaurant`). They only
  throw `RepositoryError`, whose `code` (`not_found`, `validation`, `conflict`, ...) is what UI
  code branches on.
- **The mock** validates every write with the Zod schemas, enforces foreign keys and uniqueness,
  cascades deletes like Postgres would, simulates latency (300 ms), and persists to
  `localStorage` under `tfe:mock-db`. Bumping `MOCK_DB_VERSION` re-seeds everyone.
- **Seed data** (`src/data/mock/seed/demo.ts`) is ten fictional Dallas restaurants with dates
  relative to the first run. `repositories.dev.resetDemoData()` regenerates it.
- **Diet lenses are data.** The UI maps over `useDietLenses()`; adding a lens means adding a
  row, not editing a component.

## How to swap in Supabase

_Filled in at the end of the build (stage f), once the repositories exist._
