# Continuum-Standard — Web frontend

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4. Runs entirely on **mock data** for now.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`, `npm test` (Vitest unit tests).

Video engine proof of concept: sign in as Jordan Lee or Alex Rivera and open `/poc`.

Signed-in areas: `/admin` (Super Admin), `/facility` (Facility Admin), `/learn` (Learner), `/profile` (everyone).
Full learner journey: sign in as Jordan Lee (not started) or Alex Rivera (one in progress, one completed); Casey Diaz has nothing assigned.
Facility admin: Dana Whitfield (Harbor Light) or Sam Okafor (Pinecrest) — add a learner, open their invite from the demo notice, assign training, then check Learner Progress.
Super Admin: Platform Admin — create facilities and their admins, and build a module in Training Content → New module ("Use sample stream" for the video).
Try the invite flow with Chris Park ("Open invite" on the login page) and the reset flow via "Forgot your password?"
— in demo mode the "email" link is shown on screen.

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
  app/                  routes: (app)/ signed-in areas, login, forgot/reset/set-password, poc
  components/ui/        base components: Button, Field, Card, Badge, Table, Modal
  components/shell/     AppShell (nav), AuthGate (route guard), auth page layouts
  components/           app-level components (DemoToolbar)
  lib/types.ts          domain types — mirror the data model (scope doc §8)
  lib/data/service.ts   DataService interface: the UI ↔ backend contract
  lib/data/mock/        mock implementation: seed, localStorage store, scoping rules
  lib/data/index.ts     picks the implementation (swap to the real API here)
  lib/data/hooks.ts     useSession, useQuery, useHydrated
  lib/auth/roles.ts     role areas, per-role nav, canAccess()
  lib/auth/password.ts  password rules, safe `next=` redirects
  lib/player/           video engine: pure rules (engine.ts, unit-tested) + provider adapter
  lib/learning.ts       scoring, module status and next-step rules (unit-tested)
  components/learner/   learner dashboard, training list, module, player page, knowledge check, progress
  components/facility/  facility admin dashboard, learners, learner detail, assignments, progress report
  components/admin/     super admin pages and the module editor (editor/)
  lib/content.ts        content validation + publish checklist (unit-tested)
  components/player/    ScenarioPlayer, CheckpointPanel, Timeline
```

**Rule:** pages talk only to `data` from `@/lib/data`, never to the mock files directly
(the demo tools are the one exception). That keeps the switch to a real API a one-line change.

**Security note:** role and facility checks in the mock are a stand-in for the backend.
They must be enforced again on the server; frontend checks are for user experience only.
