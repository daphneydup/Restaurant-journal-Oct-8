# Table for Everyone

A mobile-first, diet-aware dining journal for friend groups with mixed diets (vegans dining with
steak lovers). Log a visit in about 30 seconds, rate how well it worked for each dietary need, and
reuse a trusted shortlist when planning the next night out.

**Screens:** My Spots (search and filters) · Log a Visit · Restaurant Detail · Go Back list ·
Plan a Night Out · Share card · Profile.

The app runs in one of two modes, chosen by environment variables:

| Mode                    | When                                                      | Where data lives                                                             |
| ----------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Demo data** (default) | no Supabase key set                                       | `localStorage` in your browser, seeded with ten fictional Dallas restaurants |
| **Supabase**            | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` both set | your Supabase project                                                        |

## Setup

Requires Node 22.22+ and npm.

```bash
npm install
npm run dev      # http://localhost:5173, runs on demo data
```

### Connect to Supabase

1. **Create the tables.** In the Supabase dashboard open **SQL Editor**, paste the contents of
   [`supabase/migrations/20261008000000_init.sql`](supabase/migrations/20261008000000_init.sql) and run
   it once. (Or use the Supabase CLI: `supabase db push`.) It creates the tables, the security
   rules, the `log_visit` function and the six dietary lenses.
2. **Allow anonymous sign-ins.** Dashboard → **Authentication → Providers → Anonymous Sign-Ins** → on.
   The app has no login screen yet, so it signs each browser in anonymously. Every row is owned
   by that identity and row-level security means nobody can see anyone else's data.
3. **Add your keys.** Copy [`.env.example`](.env.example) to `.env.local` (git ignores it) and fill
   in the **anon public** key from **Project Settings → API**. The project URL is already filled in.
   Never use the `service_role` key in this app: it bypasses all security.
4. **Restart `npm run dev`.** Open **Profile**: it should say "Saved to your Supabase project".

If the key is missing the app quietly stays on demo data. If anonymous sign-ins are off, or the
tables don't exist yet, every screen shows its normal error state with a **Try again** button.

**Good to know**

- Anonymous users keep their data only while that browser keeps its site data. Clearing it (or
  using another browser) starts a fresh, empty journal. Real accounts are the next step.
- Photos are stored as small downscaled images inside the row (about 100 KB each, up to 3 per
  visit). Supabase Storage would be the better home once photos matter.

## Scripts

| Script               | What it does                                           |
| -------------------- | ------------------------------------------------------ |
| `npm run dev`        | Start the Vite dev server                              |
| `npm run build`      | Type-check (`tsc -b`) and build for production         |
| `npm run preview`    | Serve the production build locally                     |
| `npm run lint`       | ESLint (includes accessibility and architecture rules) |
| `npm test`           | Run the Vitest suite once                              |
| `npm run test:watch` | Vitest in watch mode                                   |
| `npm run typecheck`  | TypeScript only                                        |
| `npm run format`     | Prettier write (`format:check` to verify)              |

## Stack

React + TypeScript (strict), Vite, React Router, Tailwind CSS v4, TanStack Query,
React Hook Form + Zod, Supabase (`@supabase/supabase-js`), Vitest + React Testing Library,
ESLint + Prettier.

## Architecture

```
src/
  app/        router (lazy-loaded screens), providers, layout shell (SideNav md+, BottomTabBar below)
  components/ reusable UI primitives (Button, Chip, Dialog, RatingInput, Combobox, Toast, ...)
  features/   one folder per area: restaurants, visits, go-back, plan-night, share, profile
  data/       repository interfaces, the mock and Supabase implementations, and index.ts (the DI point)
  hooks/      shared hooks; TanStack Query hooks live in hooks/queries
  lib/        pure helpers: diet-fit maths, dates, relative time, formatting, clipboard, images
  types/      domain types and Zod schemas
  styles/     Tailwind entry + design tokens (tokens.css)
supabase/     SQL migration for your project
```

### Data flow

```
components / features
        │  call
        ▼
src/hooks/queries/*            TanStack Query hooks (useRestaurants, useLogVisit, ...)
        │  read repositories from React context
        ▼
src/data/repositoryContext.ts  ←  <RepositoryProvider> in src/app/providers.tsx
        │  value created once in main.tsx by
        ▼
src/data/index.ts              createRepositories()   ← the ONE file that picks an implementation
        ├── src/data/mock/*        demo data in localStorage
        └── src/data/supabase/*    your Supabase project (loaded only when configured)
```

- **Types** live in `src/types`: each domain has a Zod schema and a TypeScript type inferred from
  it (`Restaurant`, `Visit`, `DietRating`, `Dish`, `GoBackEntry`, `DietLens`, `PriceTier`, `User`).
  Field names are camelCase everywhere in the app.
- **Repositories** are interfaces in `src/data/repositories` (`list`, `getById`, `create`,
  `update`, `remove`, plus extras such as `VisitRepository.listByRestaurant`). They only throw
  `RepositoryError`, whose `code` (`not_found`, `validation`, `conflict`, `invalid_reference`,
  `unavailable`, `storage_full`) is what UI code branches on.
- **ESLint enforces the boundary.** Only `src/data/index.ts` (and tests) may import
  `src/data/mock` or `src/data/supabase`, so no component can bypass the hooks.
- **Logging a visit is one operation.** `visits.logVisit(input)` saves the restaurant (if new), the
  visit, its dishes and the optional go-back flag atomically. In Supabase that is the
  `log_visit` Postgres function, so a failure can never leave a restaurant with no visit.
- **Diet lenses are data.** The UI maps over `useDietLenses()`; adding a diet is an `INSERT`
  into `diet_lenses` (or a new entry in the mock seed), not a component change.
- **Derived numbers are never stored.** Diet-fit averages, last-visited dates and rankings are
  computed in `src/lib` and `src/features/*` from the visits, so they can't go stale.

### How "Plan a Night Out" ranks spots

A spot qualifies when it is within budget and **every** chosen diet averages at least 3.5. Ranking,
best first: the weakest chosen diet, then the share of visits that worked for everyone, then the
mean of the chosen diets, then the most recent visit, then name. Spots with a rating for some but
not all chosen diets are listed separately as "Worth a closer look". The logic is one pure function
(`src/features/plan-night/matching.ts`) and every rule has a test that fails if it is removed.

### Design tokens and accessibility

Tokens live in `src/styles/tokens.css` (Tailwind v4 `@theme`); each becomes a utility
(`bg-primary`, `text-ink-muted`, `rounded-card`, `min-h-touch`). Accessibility is built in:
semantic landmarks and a skip link, visible focus rings, 44px touch targets, `prefers-reduced-motion`
support, labelled inputs, and errors that are announced and linked to their fields. A test reads
the real tokens and checks every colour pairing the UI uses against WCAG AA, and another test
requires every data screen to have loading and error-with-retry states.

## Testing

`npm test` runs ~520 tests: schemas, the mock repositories, the Supabase repositories (the real
`supabase-js` client against a recording fake HTTP server, so request shapes and error mapping are
checked), the matching logic, every screen's loading / empty / error / success states, and the
Log a Visit form's validation.

## Moving to a different back end

Everything the app needs from a back end is the `Repositories` interface. To use something other
than Supabase (or to change how Supabase is used):

1. Add `src/data/<yourbackend>/` with one repository per interface in `src/data/repositories`.
   Map snake_case to camelCase inside it and translate its errors to `RepositoryError`. Use
   `src/data/supabase/` (rows.ts, errors.ts, the repositories) as the worked example, and
   `src/data/mock/*.test.ts` as the behaviour every implementation must satisfy.
2. Change **only** `src/data/index.ts` so `createRepositories()` returns it.
3. Leave `src/data/mock` in place: the tests and the demo mode still use it.

Nothing in `components/`, `features/`, `hooks/` or `lib/` changes. If you later add real accounts,
replace the anonymous sign-in in `src/data/supabase/context.ts` (`createSessionProvider`); the
SQL already scopes every row to `auth.uid()`.
