# Table for Everyone

A mobile-first, diet-aware dining journal for friend groups with mixed diets (vegans dining with
steak lovers). Log a visit in about 30 seconds, rate how well it worked for each dietary need, and
reuse a trusted shortlist when planning the next night out.

**Screens:** My Spots (search and filters) · Log a Visit · Restaurant Detail · Go Back list ·
Plan a Night Out · Share card · Rewards · Invite friends · Profile · Log in / Sign up / Forgot
password · Account.

The look is dark and refined ("luxury meets fine dining"): a warm near-black canvas, ivory type,
champagne-gold accents, Cormorant Garamond headings and stock photography.

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

1. **Create the tables.** In the Supabase dashboard open **SQL Editor** and run these two files, in
   order (or use the Supabase CLI: `supabase db push`):
   1. [`supabase/migrations/20261008000000_init.sql`](supabase/migrations/20261008000000_init.sql):
      tables, security rules, the `log_visit` function and the six dietary lenses.
   2. [`supabase/migrations/20261009000000_account_deletion.sql`](supabase/migrations/20261009000000_account_deletion.sql):
      the `delete_my_account` function behind **Delete account**.
   3. [`supabase/migrations/20261020000000_rewards.sql`](supabase/migrations/20261020000000_rewards.sql):
      points, perks, vouchers and invites (see [Rewards and invites](#rewards-and-invites)). Until
      it is run, logging visits still works but the Rewards screens show their error state.
2. **Allow anonymous sign-ins.** Dashboard → **Authentication → Providers → Anonymous Sign-Ins** → on.
   Visitors start as a _guest_ with no login screen, and every row is owned by that identity.
   Row-level security means nobody can see anyone else's data.
3. **Check the email settings** (needed for accounts, see [Accounts and login](#accounts-and-login)):
   **Authentication → URL Configuration**: set **Site URL** to `http://localhost:5173` for development
   (your real address in production) and add `http://localhost:5173/**` to **Redirect URLs**.
4. **Add your keys.** Copy [`.env.example`](.env.example) to `.env.local` (git ignores it) and fill
   in the **anon public** key from **Project Settings → API**. The project URL is already filled in.
   Never use the `service_role` key in this app: it bypasses all security.
5. **Restart `npm run dev`.** Open **Profile**: it should say "Saved to your Supabase project".

If the key is missing the app quietly stays on demo data. If anonymous sign-ins are off, or the
tables don't exist yet, every screen shows its normal error state with a **Try again** button.

**Good to know**

- A guest keeps their journal only while that browser keeps its site data. Clearing it (or using
  another browser) starts an empty journal. **Creating an account** is how a journal is kept safe
  and used on other devices.
- Photos are stored as small downscaled images inside the row (about 100 KB each, up to 3 per
  visit). Supabase Storage would be the better home once photos matter.

## Accounts and login

Visitors can use the whole app immediately as a **guest**. When they are ready, they create an
account and **the same journal comes with them**: signing up upgrades the guest in place (same user
id), nothing is copied or lost.

| CRUD         | What the person does                                      | Where                                             | How                                        |
| ------------ | --------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| **Create**   | Sign up with email + password                             | `/signup`                                         | upgrades the guest (`auth.updateUser`)     |
| **Read**     | See status, email, member-since                           | `/account`, Profile                               | `auth.getSession`                          |
| **Update**   | Change email, change password, reset a forgotten password | `/account`, `/forgot-password`, `/reset-password` | `auth.updateUser`, `resetPasswordForEmail` |
| **Delete**   | Delete the account and everything in it                   | `/account` (type `DELETE` to confirm)             | `delete_my_account()` SQL function         |
| Log in / out | Return to a saved journal, or leave                       | `/login`, `/account`                              | `signInWithPassword`, `signOut`            |

Things worth knowing:

- **Logging in as someone else replaces the guest journal.** The guest's data stays under the guest
  identity and can't be reached again, so the log-in screen and "Leave guest session" both warn.
  Create an account first to keep it.
- **Switching people never leaks data.** `src/app/AuthSync.tsx` discards every cached screen when
  the _person_ changes (log out, or log in as someone else) but not when the same person changes
  their email or a guest becomes a member.
- **Messages never reveal who has an account.** A wrong password and an unknown email give the same
  answer, and "forgot password" says the same thing for any address.
- **Email confirmation is your choice.** With **Authentication → Providers → Email → Confirm email**
  on, a new account (and a changed email) stays pending until the link is clicked; the app says
  "Check your email" and shows the pending address on `/account`. Turn it off for instant sign-up.
  Supabase's built-in mailer is rate limited; configure SMTP before real users arrive.
- **Password rules:** at least 8 characters (the form), plus whatever **Authentication → Policies**
  adds (the app shows "too easy to guess" when a project rule rejects it).
- **Demo mode has accounts too**, so every screen can be tried without a server. They live in this
  browser, store only a salted hash, share one journal, and protect nothing. Use Supabase for real
  security.

## Rewards and invites

People earn **points** and spend them on **perks** (free appetizers, drinks, desserts, entrées,
discounts), which become **vouchers** with a code.

| How you earn    | Points                                                                      |
| --------------- | --------------------------------------------------------------------------- |
| Log a visit     | 50, plus 10 for a note and 10 for a photo                                   |
| Invite a friend | 200 for each of you when they join with your link (`/join?ref=CODE`)        |
| Limits          | 3 paid visits a day, only the first per restaurant per day; 25 paid invites |

- The rules live in [`src/lib/rewardRules.ts`](src/lib/rewardRules.ts) and are repeated in the SQL
  migration, so change both together. Points are a **ledger** (the balance is its sum), never a
  stored total.
- **With Supabase the database enforces everything**: the ledger and vouchers have no write
  policies, so the browser can't grant itself points. Visits pay through a trigger; redeeming and
  claiming an invite are atomic SQL functions. Claiming needs a signed-in member with a confirmed
  email, works once per person, and never for your own code.
- **The perk catalogue is a sample**: the partners are fictional and nothing is honoured by a real
  restaurant yet. The Rewards screen says so.
- **Demo mode can't verify invites** (nobody to check a code against), so any well-formed code that
  isn't yours pays the joiner; the Supabase version verifies the code and pays both sides.
- Opening an invite link stores the code; it is claimed automatically once the person has an
  account, so sign-up needs no extra step.

## Social sharing

The Share screen's **Post it** panel makes a 1080 x 1350 card image (drawn on a canvas with the
app's own colours), then offers the native share sheet (which lists Instagram, TikTok, Messages and
so on on a phone, and carries the image), **Save image**, and web links for X, Facebook, WhatsApp
and email. There is no direct "post to Instagram" API for a web page, so nothing asks for social
logins. Captions include your invite link. The invite screen shares the same way, words only.

## GIFs

A visit can carry one reaction GIF (Log a Visit → More details), and a share post can include one
(it travels as a GIPHY link in the caption, so the network shows the animation).

- **The GIPHY key never reaches the browser.** The app calls the `giphy` Edge Function
  ([`supabase/functions/giphy`](supabase/functions/giphy)), which adds the key from the Supabase
  secret `GIPHY_API_KEY` and returns trimmed results. Deploy it with
  `supabase functions deploy giphy` and set the secret with
  `supabase secrets set GIPHY_API_KEY=<your key>` (or Dashboard → Edge Functions → Secrets).
- Run [`supabase/migrations/20261021000000_visit_gifs.sql`](supabase/migrations/20261021000000_visit_gifs.sql)
  (after the rewards one) to add the visit columns. The database only accepts https GIPHY
  addresses, and so does the app.
- **Demo mode** (no Supabase) offers a dozen drawn stand-in pictures instead, so the flow can be
  tried offline.
- GIPHY's terms ask for their "Powered by GIPHY" attribution; the picker credits them with a
  text link. Swap in their official badge image before launch if you want to follow the brand
  guidelines to the letter.

## Testimonials and photography

- The carousel quotes in [`src/features/testimonials/testimonials.ts`](src/features/testimonials/testimonials.ts)
  are **sample placeholders**, labelled "Sample quotes" on screen. Replace them (and drop the
  label) once real members agree to be quoted.
- Photos in `public/images` come from Unsplash (free licence) and are credited on the Rewards page;
  the registry is [`src/lib/photos.ts`](src/lib/photos.ts). They set a mood and never claim to show
  a specific (fictional) restaurant.

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
  features/   one folder per area: restaurants, visits, go-back, plan-night, share, profile, account
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

`npm test` runs ~890 tests: schemas, the mock repositories, the Supabase repositories (the real
`supabase-js` client against a recording fake HTTP server, so request shapes and error mapping are
checked), the matching logic, every screen's loading / empty / error / success states, and the
Log a Visit form's validation, the rewards rules, the carousel, share-image layout and whole
account journeys. On a busy machine run `npx vitest run --maxWorkers=2`: a few screens are timed.

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
change `createSessionProvider` in `src/data/supabase/context.ts`; the SQL already scopes every row
to `auth.uid()`, and email + password accounts are already built (see above).
