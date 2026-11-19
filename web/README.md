# Continuum-Standard — Web frontend

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4. Runs entirely on **mock data** for now.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`.

## Demo mode

All data lives in your browser (localStorage), seeded from `src/lib/data/mock/seed.ts`:
2 facilities, 12 accounts across the three roles, 3 sample modules (synthetic placeholder content).

- **Login page → "Demo accounts"**: one click signs in as any seeded user.
- **Bottom toolbar**: switch account, sign out, or **Reset** back to the seed data.
- Turn the demo tools off with `NEXT_PUBLIC_DEMO_TOOLS=false`.

The shared demo password is defined in `seed.ts` (mock only).

## Structure

```
src/
  app/                  routes (login, dashboard, …)
  components/ui/        base components: Button, Field, Card, Badge, Table, Modal
  components/           app-level components (DemoToolbar)
  lib/types.ts          domain types — mirror the data model (scope doc §8)
  lib/data/service.ts   DataService interface: the UI ↔ backend contract
  lib/data/mock/        mock implementation: seed, localStorage store, scoping rules
  lib/data/index.ts     picks the implementation (swap to the real API here)
  lib/data/hooks.ts     useSession, useQuery, useHydrated
  lib/auth/roles.ts     role labels and post-login routing
```

**Rule:** pages talk only to `data` from `@/lib/data`, never to the mock files directly
(the demo tools are the one exception). That keeps the switch to a real API a one-line change.

**Security note:** role and facility checks in the mock are a stand-in for the backend.
They must be enforced again on the server; frontend checks are for user experience only.
