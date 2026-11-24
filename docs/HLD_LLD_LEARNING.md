# Learning HLD & LLD — Through the Continuum-Standard Project

> A beginner-friendly study guide and interview-prep notebook.
> It teaches High-Level Design (HLD) and Low-Level Design (LLD) using a real project, and it is a **living document**: every real design decision made while building gets recorded in the [Design Decision Journal](#9-design-decision-journal-living-record).

**Project status:** F0–F6 built — public website, all three roles and the content editor on mock data; the MVP success test passes end to end. F7 (QA & polish) next (2026-11-24).
Sections marked **📐 Planned** describe the intended design; they become **🛠 Built** once implemented.

---

## Table of contents
1. [The project in one minute](#1-the-project-in-one-minute)
2. [What is system design? (the basics)](#2-what-is-system-design-the-basics)
3. [HLD vs LLD](#3-hld-vs-lld)
4. [HLD of Continuum-Standard](#4-hld-of-continuum-standard)
5. [LLD of Continuum-Standard](#5-lld-of-continuum-standard)
6. [Trade-offs we made (and the alternatives)](#6-trade-offs-we-made-and-the-alternatives)
7. [Interview kit](#7-interview-kit)
8. [Glossary](#8-glossary)
9. [Design Decision Journal (living record)](#9-design-decision-journal-living-record)
10. [Lessons learned (living record)](#10-lessons-learned-living-record)

---

## 1. The project in one minute

**Continuum-Standard** is a training platform for staff at behavioral-health facilities (detox clinics, residential treatment, mental-health programs).

**What makes it special:** staff watch realistic scenario videos. At set moments the video **pauses automatically**, asks *"What would you do?"*, the learner picks an answer, sees an expert-approved explanation, and the video continues. Then they take a short quiz, and their manager can see the results.

**Who uses it (3 roles):**

| Role | What they do |
|---|---|
| **Super Admin** | Runs the whole platform: creates facilities, their admins, and the training content |
| **Facility Admin** | Manages one facility: adds staff (learners), assigns training, checks progress |
| **Learner** | Watches assigned training, answers questions, takes quizzes |

**The one-sentence success test:**
> A Facility Admin assigns a module → a Learner watches the video, answers a timed question, gets feedback, completes the quiz → the Facility Admin sees the result.

---

## 2. What is system design? (the basics)

Before writing code for anything bigger than a script, you decide **how the system is shaped**. That's system design. It answers questions like:

- What are the main parts?
- Where is data stored?
- How do the parts talk to each other?
- How do we keep it secure, fast, and reliable?
- What happens when something goes wrong?

**Why it matters:** fixing a design mistake on paper costs minutes. Fixing it after 10,000 lines of code costs weeks.

### Two kinds of requirements

| Type | Meaning | Examples in this project |
|---|---|---|
| **Functional** | *What* the system does | Pause video at 00:30; assign modules; score quizzes |
| **Non-functional (NFR)** | *How well* it does it | Secure, fast pause, works on mobile, survives a refresh, no patient data |

> 💡 **Beginner tip:** Interviewers love NFRs. Anyone can list features; good engineers ask "how many users? how secure? what if it fails?"

---

## 3. HLD vs LLD

### Analogy: building a house 🏠

- **HLD = the architect's sketch.** How many floors, where the kitchen and bedrooms go, where water and electricity enter the house.
- **LLD = the detailed construction drawings.** Exact wall measurements, which pipe goes where, which wire connects to which switch.

You can't do LLD without HLD — you need to know there's a kitchen before deciding where the sink pipe runs.

### Side by side

| | **HLD — High-Level Design** | **LLD — Low-Level Design** |
|---|---|---|
| Main question | *What are the big pieces and how do they connect?* | *How is each piece built inside?* |
| Zoom level | Whole system (the "city map") | One component (the "floor plan") |
| Typical contents | Components, tech stack, data flow, scaling, security approach, external services | Database tables, API endpoints, classes/modules, state machines, algorithms, edge cases |
| Diagrams | Architecture/component diagram, context diagram | ER diagram, sequence diagram, state diagram, class diagram |
| Audience | Client, tech lead, architects | Developers writing the code |
| Changes how often | Rarely | Often, during development |

### How they flow

```
Requirements ──▶ HLD ──▶ LLD ──▶ Code ──▶ Tests
 (what & why)   (shape)  (details) (build)  (prove)
```

---

## 4. HLD of Continuum-Standard

**📐 Planned**

### 4.1 Context diagram — the system as one box

A context diagram shows **who** and **what** the system talks to, without showing anything inside it.

```
   Visitor        Learner      Facility Admin     Super Admin
      │              │               │                 │
      └──────────────┴───────┬───────┴─────────────────┘
                             ▼
                ┌─────────────────────────┐
                │   Continuum-Standard    │
                └─────────────────────────┘
                   │          │         │
                   ▼          ▼         ▼
             Video host    Email     File storage
             (Mux/AWS)    service    (thumbnails)
```

### 4.2 Component diagram — the big boxes inside

```
┌──────────────────── Frontend (Next.js) ──────────────────┐
│  Public website  │  App: Learner / Facility Admin / Super │
└───────────────────────────┬──────────────────────────────┘
                            │  HTTPS, REST/JSON
┌───────────────────────────▼──────────────────────────────┐
│                      Backend API                         │
│  Auth │ Facilities │ Users │ Content │ Assignments │     │
│  Player/Progress │ Assessments │ Reports │ Leads         │
│    ── role check + facility check on EVERY request ──    │
└───────┬──────────────────┬──────────────────┬────────────┘
        ▼                  ▼                  ▼
   PostgreSQL        Video provider        Email service
   (all data)        (streams video)       (invites, resets)
```

**What each box does:**

| Component | Responsibility |
|---|---|
| **Frontend** | Everything the user sees. Public marketing pages + the logged-in app. Runs the video player. |
| **Backend API** | The "brain". Checks who you are and what you're allowed to do, applies business rules, reads/writes data. |
| **PostgreSQL** | The single source of truth: users, facilities, modules, answers, scores. |
| **Video provider** | Stores and streams videos efficiently to any device and network speed. |
| **Email service** | Sends invite links and password-reset emails. |

### 4.3 Key HLD decisions

| Decision | What we chose | Why (in plain words) |
|---|---|---|
| Architecture style | **Modular monolith** | One backend app, but organized into clear modules. A small team building in ~10 weeks doesn't need the complexity of microservices. |
| Multi-tenancy | **Shared database, every facility-owned row tagged with `facility_id`** | Simple and cheap. Isolation is enforced by code on every query. |
| Access control | **RBAC** (Role-Based Access Control), enforced on the server | Hiding a button isn't security — someone can call the API directly. |
| Video | **External streaming provider + signed URLs** | Adaptive streaming is hard to build; signed URLs stop people sharing private video links. |
| Checkpoint timing | **Runs in the browser**, answers saved to the API | The pause must be instant and exact; saving each answer protects progress. |
| Content | **Data-driven** (stored in DB, not code) | The client can change questions and timestamps without a developer. |
| Build approach | **Frontend-first with a mock data layer** | Get a clickable product in front of the client early; backend plugs in later behind the same interface. |

### 4.4 Data flow — the success test, end to end

```
1. Facility Admin assigns module   ──▶ API ──▶ DB: assignment created
2. Learner opens module            ──▶ API ──▶ returns module, checkpoints, signed video URL
3. Browser streams video           ──▶ Video provider
4. At 00:30 browser pauses; learner answers ──▶ API ──▶ DB: response saved
5. Learner submits quiz            ──▶ API scores it ──▶ DB: attempt + progress saved
6. Facility Admin views progress   ──▶ API (only own facility's rows) ──▶ DB
```

### 4.5 Non-functional requirements

| NFR | Target / approach |
|---|---|
| **Scale** *(assumption)* | ~50 facilities × ~100 learners ≈ 5,000 users. One API server + one Postgres instance is enough. Heavy video traffic goes to the provider, not us. |
| **Security** | Hashed passwords, HTTPS everywhere, server-side role + facility checks, input validation. |
| **Privacy** | Synthetic training scenarios only — **no patient data (PHI)** stored. |
| **Reliability** | Separate staging and production, daily backups, basic monitoring. |
| **Performance** | Checkpoint pause is client-side so it happens on the exact second. |
| **Usability** | Responsive (phone/tablet/desktop), accessible (WCAG AA). |

---

## 5. LLD of Continuum-Standard

**📐 Planned**

### 5.1 Database schema (the data model)

```
facilities          (id, name, contact_email, is_active, created_at)
users               (id, facility_id NULL, role, name, email, password_hash, is_active)
training_modules    (id, title, description, category, thumbnail_url, status: draft|active)
scenario_videos     (id, module_id, provider_asset_id, duration_sec)
checkpoints         (id, video_id, timestamp_sec, prompt, general_rationale, sort_order)
checkpoint_options  (id, checkpoint_id, label, rationale NULL)
checkpoint_responses(id, user_id, checkpoint_id, option_id, answered_at)
assessments         (id, module_id, pass_percent, max_attempts NULL)
questions           (id, assessment_id, text)
answer_options      (id, question_id, label, is_correct)
assessment_attempts (id, user_id, assessment_id, score, passed, submitted_at)
assignments         (id, facility_id, user_id, module_id, assigned_at, status)
learner_progress    (id, user_id, module_id, status, last_position_sec, furthest_sec)
```

**Relationships (simplified ER diagram):**

```
facilities 1──* users 1──* assignments *──1 training_modules
                  │                              │
                  │                              ├──1 scenario_videos 1──* checkpoints 1──* checkpoint_options
                  │                              └──1 assessments 1──* questions 1──* answer_options
                  ├──* checkpoint_responses
                  ├──* assessment_attempts
                  └──* learner_progress
```

**Things to notice (great interview talking points):**
- `users.facility_id` is NULL only for the Super Admin (who belongs to no facility).
- `checkpoint_responses` has no `facility_id` — it's linked to a facility **through** `user_id`. This is called a *validated parent relationship*.
- `furthest_sec` lets us stop learners from skipping ahead (decision D4).
- `checkpoint_options.rationale` is optional, so feedback can be per-question, per-option, or both (D5).
- `training_modules.status` (draft/active) stops half-finished content being assigned.

### 5.2 API endpoints (sample)

```
POST /auth/login                       → returns session/token
POST /auth/set-password                invite-link flow (D8)
POST /auth/forgot-password

GET  /facilities                       [Super Admin]
POST /facilities                       [Super Admin]
GET  /learners                         [Facility Admin → own facility only]
POST /learners                         [Facility Admin]
POST /assignments                      { userIds[], moduleIds[] }  (D3)

GET  /me/assignments                   [Learner]
GET  /modules/:id/play                 → module, checkpoints, signed video URL, saved progress
POST /checkpoints/:id/response         { optionId }
PUT  /progress/:moduleId               { positionSec }
POST /assessments/:id/attempts         { answers[] } → { score, passed }
```

> 💡 **Beginner tip:** REST uses nouns for URLs (`/learners`) and HTTP verbs for actions (GET = read, POST = create, PUT = update, DELETE = remove).

### 5.3 Tenant scoping — the most important rule in the codebase

**🛠 Built (F0–F4)** in the mock backend, with unit tests — see §5.10 for the real code. The real API must do the same on the server.

**Problem:** Facility A's admin must never see Facility B's learners — even by typing a different ID into the URL.

**Solution:** every query for facility data passes through one helper that adds the facility filter, using the facility from the **logged-in user**, never from the request.

```ts
function scopeToFacility(user, query) {
  if (user.role === 'SUPER_ADMIN') return query;          // sees everything
  return query.where('facility_id', user.facilityId);     // sees only own facility
}

// GET /learners/:id
const learner = await scopeToFacility(req.user, db('users')).where('id', id).first();
if (!learner) return res.status(404);   // 404, not 403 → don't reveal the record exists
```

**Why 404 and not 403?** A 403 ("forbidden") tells an attacker *"this ID exists, you just can't see it"*. A 404 reveals nothing.

### 5.4 Video player state machine

A **state machine** is a way to describe something that can be in exactly one "state" at a time, with clear rules for moving between states. It prevents bugs like "the video plays while the question is still showing".

```
          play                 timestamp reached
 IDLE ──────────▶ PLAYING ─────────────────────▶ CHECKPOINT
                    ▲                                 │ submit answer
                    │ continue                        ▼
                    └──────────────────────────── FEEDBACK
                    │
                    │ video ended
                    ▼
               ASSESSMENT ──submit──▶ COMPLETE
```

| State | Rules |
|---|---|
| **PLAYING** | On every time update: if current time ≥ next unanswered checkpoint → pause → CHECKPOINT. If user seeks past `furthest_sec` → snap back (D4). |
| **CHECKPOINT** | Controls locked; learner must answer. |
| **(submit)** | Save to API **first**; only then show FEEDBACK. If save fails → show retry, don't advance. |
| **FEEDBACK** | Show approved rationale; "Continue" → PLAYING. |
| **On page reload** | Load saved progress, resume from `last_position_sec`, skip answered checkpoints. |

**🛠 Built (F1)** — the video part of this machine (everything up to "video ended") is in `web/src/lib/player/engine.ts`. ASSESSMENT/COMPLETE arrive in F3.

**The real states in code:**

```
            PLAY                     time ≥ next unanswered checkpoint
  ready ─────────▶ playing ─────────────────────────────────▶ checkpoint
    ▲   PAUSE ◀──▶ paused                                       │ SELECT + SUBMIT
    │                │                                          ▼
    │                │ (video ends)                        submitting
    │                ▼                          SUBMIT_FAIL ↙        ↘ SUBMIT_OK
  (reload)         ended ──PLAY──▶ playing   back to checkpoint     feedback
                                                                       │ CONTINUE
                                                                       ▼
                                                                    playing
```

**How the code is split (a key LLD idea — *separation of concerns*):**

| Piece | File | Job |
|---|---|---|
| **Rules** (pure functions) | `lib/player/engine.ts` | `reducer` (legal transitions), `dueCheckpoint`, `maxSeekable`, `clampSeek`, `advanceFurthest`. No React, no `<video>` — so they're unit-tested (`engine.test.ts`, 17 tests). |
| **Video loading** (adapter) | `lib/player/videoSource.ts` | Native HLS, hls.js or plain MP4 — the only file that knows about the video provider. Retries on network drops. |
| **Wiring** (React) | `components/player/ScenarioPlayer.tsx` | Connects the rules to a real `<video>`: frame loop, seek guard, saving, keyboard. |
| **UI pieces** | `CheckpointPanel.tsx`, `Timeline.tsx` | Question/feedback panel; progress bar with decision-point markers. |

> 💡 **Beginner tip — why a reducer?** A reducer is a function `(state, event) → newState`. Every change goes through it, and illegal events are simply ignored (e.g. `PLAY` while a question is open returns the same state). That makes "the learner can't skip the question" a rule you can test in one line instead of a bug you hope you don't have.

**Precision — how it pauses *exactly* at 00:30:**
- The `<video>` element's `timeupdate` event only fires ~4 times a second, so on its own the pause could land up to 0.25 s late.
- While playing, a `requestAnimationFrame` loop checks the time **every frame** (~60×/s). When a decision point is due it pauses and sets `currentTime` to the exact timestamp. Measured in testing: **30.000 s**.
- **Safety net:** browsers stop animation frames in background tabs but keep playing video, so `timeupdate` also runs the same check. Without it, a learner in another tab could play straight past a question.

**Seeking (decision D4):**
- `maxSeekable = min(furthest watched, next unanswered checkpoint)`.
- Our progress bar clamps to it, *and* a `seeking` listener snaps back seeks from anywhere else (keyboard, media keys, dev tools). Defence in depth.
- The server side (mock today) only lets `furthestSec` go **up**, never down.

**Saving:** every 5 s while playing, on pause, at each decision point, on video end, and when the page is hidden. Answers are saved **before** feedback shows; if the save fails, the learner stays on the question with their answer still selected and a "Try again" button.

**Edge cases handled:** refresh while a question is open (it reappears immediately), answered questions aren't asked again on replay, the first answer wins if a checkpoint is answered twice (e.g. two tabs), free seeking once the video has been watched to the end, and the question panel moves below the video on phones.

### 5.5 Sequence diagram — submitting a checkpoint answer

A **sequence diagram** shows *who calls whom, in what order*.

```
Learner     Browser(Player)          API                         DB
  │ click B ──▶│                       │                           │
  │            │ POST /checkpoints/7/response {optionId: B}        │
  │            │──────────────────────▶│ is user assigned to this  │
  │            │                       │ module? ─────────────────▶│
  │            │                       │ insert response ─────────▶│
  │            │◀──── 201 + rationale ─│                           │
  │◀ feedback ─│                       │                           │
  │ continue ─▶│ video.play()          │                           │
```

### 5.6 Frontend structure (mock-first)

**🛠 Built (F0)** — the data layer below exists in `web/src/lib/data/`. The video provider adapter is still 📐 Planned (F1).

```
UI pages/components
      │  call
      ▼
Data service interface   ←── same function names for mock and real
      │
      ├── MockService  (seed data + localStorage)   ← used now
      └── ApiService   (HTTP calls to backend)      ← swapped in later
```

This is the **Adapter / Repository pattern**: the UI depends on an *interface*, not on where data really comes from. Swapping mock → real needs no UI changes. The video player uses the same idea (a provider adapter for HTML5/hls.js now, Mux later).

**How it's really built (F0):**

| File | Role in the design |
|---|---|
| `lib/types.ts` | The data model from §5.1 as TypeScript types — the "contract" both sides agree on |
| `lib/data/service.ts` | The `DataService` **interface** — the list of things the UI may ask the backend for |
| `lib/data/mock/mockService.ts` | The mock **implementation**. It applies the same role + facility rules the real API must (`inScope()` = the §5.3 scoping helper; out-of-scope records throw NOT_FOUND, i.e. 404) |
| `lib/data/mock/store.ts` | Fake "database": one JSON blob in `localStorage`, so data survives a refresh |
| `lib/data/index.ts` | The **one line** that picks the implementation: `export const data = new MockDataService()` |
| `lib/data/hooks.ts` | React glue: `useSession()` and `useQuery()` re-render the UI when data changes |

> 💡 **Beginner tip — why the mock enforces security rules at all:** if the mock let everyone see everything, the UI would be built against the wrong behaviour and break when the real API starts saying "no". Making the mock strict means the screens are already correct for the real backend.

> 💡 **Beginner tip — hydration:** Next.js renders the page on the server first, then React "hydrates" it in the browser. The server can't read `localStorage`, so anything stored there (the session, demo accounts) is only read *after* hydration — otherwise the server HTML and browser HTML differ and React throws a *hydration mismatch* error. That's what `useHydrated()` and the server snapshot in `useSession()` handle.

### 5.8 Authentication, roles and routing

**🛠 Built (F2)** — in the frontend with a mock backend. The *rules* are real; the *security* must be re-done on the server.

**Routes by role (decision D1):**

```
/login  /forgot-password  /reset-password?token=…  /set-password?token=…   ← public
/admin/…      Super Admin    (Dashboard, Facilities, Facility Admins, Training Content, Activity, Demo Requests)
/facility/…   Facility Admin (Dashboard, Learners, Assignments, Learner Progress)
/learn/…      Learner        (Dashboard, Assigned Training, My Progress)
/profile      any signed-in role
```

One function decides access: `canAccess(role, path)` in `lib/auth/roles.ts`. The navigation menu, the route guard and the post-login redirect all use it, so they can't disagree. (*Single source of truth* — a classic LLD principle.)

**The route guard (`AuthGate`) — what happens on every signed-in page:**

| Situation | Result |
|---|---|
| Not signed in | → `/login?next=/the/page` and back there after signing in |
| Wrong role for the URL (learner opens `/admin`) | → their own home |
| Account deactivated / facility switched off *while signed in* | Signed out at once (even if it happened in another tab), with an explanation |

**Password flows (sequence for "forgot password"):**

```
User            Forgot page          API (mock)                   Email
 │ enters email ─▶│ requestPasswordReset(email)                      │
 │                │───────────────────▶│ if active: new single-use   │
 │                │                    │ token, 60-min expiry ──────▶│ link sent
 │◀ "If that email has an account, we sent a link" (always the same) │
 │ opens link ────────────────────────▶│ checkAuthToken: unknown / used / expired?
 │ new password ─────────────────────▶│ completeAuthToken: set password, mark token used, sign in
```

**Security rules built in (great interview material):**

| Rule | Why |
|---|---|
| Same reply for known and unknown emails (login *and* forgot password) | Stops **user enumeration** — attackers can't discover who has an account |
| Reset/invite links are random, single-use and expire | A leaked or old email can't be reused |
| `next=` redirects only to in-app paths (`safeNextPath`) | Stops **open redirects** (`/login?next=https://evil.site` phishing trick) |
| Every request re-checks the account is still active | Deactivation takes effect immediately, not at next login |
| Password rules shared by form and backend (`validatePassword`) | Instant feedback in the UI, real enforcement on the server |
| Mock stores passwords in plain text — **mock only** | A real backend stores a slow, salted hash (Argon2/bcrypt), never the password |

> 💡 **Beginner tip — authentication vs authorization, in code:** `login()` / `completeAuthToken()` are *authentication* (who are you?). `canAccess()` and the mock's `requireSession()` + `inScope()` are *authorization* (what may you do?). Keep them separate.

> 💡 **Beginner tip — a framework surprise:** Next.js 16 keeps recently visited pages mounted but hidden (React `<Activity>`), so their state survives navigation. That broke two things in testing — the login page remembered "loading" from an earlier sign-in, and a used reset link stuck on "Checking…". The fix (`useResetOnHide`) resets one-off flags, and clears password fields, when a page is hidden.

### 5.9 The learner journey

**🛠 Built (F3)**

```
/learn                         dashboard: counts, "continue where you left off", cards, activity
/learn/training                all assigned modules, filter by status
/learn/training/[id]           intro → status → read-only review of your decisions (D7)
/learn/training/[id]/play      scenario player (F1 engine)
/learn/training/[id]/check     knowledge check → result
/learn/progress                table of modules, best scores, attempts, history
```

**Module lifecycle (a state machine at the business level):**

```
NOT_STARTED ──play──▶ IN_PROGRESS ──video watched──▶ (check unlocked) ──pass──▶ COMPLETED
                                                         │  fail (attempts left) ↺
                                                         └─ fail (no attempts left) → LOCKED_OUT (contact admin)
```

Two small pure functions drive every screen: `deriveStatus()` (which state is it in?) and `nextStep()` (what should the main button do?). Cards, the dashboard, the intro page and My Progress all call them, so they always agree (`lib/learning.ts`, unit-tested).

**Key LLD decisions in F3:**

| Topic | What we did | Why |
|---|---|---|
| **View-model endpoint** | `listMyTraining()` returns one ready-made row per module (status, progress, attempts, next step) | One request instead of 5–6 per card (avoids the *N+1 request* problem). This is the *Backend-for-Frontend* idea. |
| **Answer key never leaves the server** | `getMyAssessment()` strips `isCorrect` and explanations; a unit test checks the JSON | Anything sent to the browser can be read in dev tools. |
| **Server-side scoring** | The browser sends only "which option did I pick"; the server scores | A client can't send "I scored 100%". |
| **Reveal policy** | Correct answers + explanations shown only after a pass (or when no attempts are left) | Showing them after a fail would let learners pass by retrying without learning. |
| **Gatekeeping** | Check unlocks only after the video is watched; no retakes after a pass; attempt limit enforced | Same rules in the UI *and* the server — the UI just explains them. |
| **Completion rule** | COMPLETED = video watched **and** check passed | Matches the success test: the admin sees a meaningful "completed". |

> 💡 **Beginner tip — "never trust the client":** every rule above is enforced in the (mock) backend, and `mock/learner.test.ts` tests them without a browser. The UI hides buttons too, but only for convenience.

> 💡 **Beginner tip — a race condition we found:** the player used to *skip* a progress save if another was still running. If that happened exactly when the video ended, the "finished" flag was lost and the knowledge check stayed locked. Fix: a **promise queue** — saves run one after another, none dropped — and the "Take knowledge check" button appears only after the finish is saved.

### 5.10 Facility administration

**🛠 Built (F4)** — and with it, the **MVP success test passes end to end** in the browser:
*Facility Admin adds a learner → assigns a module → learner accepts the invite, watches, answers, passes → Facility Admin sees "Completed, 80%".*

```
/facility                    summary cards, "needs attention", quick actions, activity
/facility/learners           roster: search, status filter, add / edit / deactivate / resend invite
/facility/learners/[id]      one learner's full record: every module, attempts, decision responses
/facility/assignments        assign modules × learners; list of all assignments
/facility/progress           per-module completion + filterable learner × module results
```

**How the tenant rule is implemented (§5.3, now real code in the mock):**

```ts
function resolveFacility(session, facilityId?) {
  if (session.role === "LEARNER") throw FORBIDDEN;
  if (session.role === "FACILITY_ADMIN") {
    if (facilityId && facilityId !== session.facilityId) throw NOT_FOUND; // can't ask for another facility
    return session.facilityId;                                            // always their own
  }
  // SUPER_ADMIN: must name the facility (F5 reuses these endpoints)
}
```

Every admin endpoint starts with `resolveFacility()` or `managedLearner()`. `mock/facility.test.ts` proves that Pinecrest's admin gets **404** for Harbor Light's learners — the scope document's acceptance check "Facility Admin cannot access another facility's records".

**Design points worth explaining in an interview:**

| Topic | What we did | Why |
|---|---|---|
| One base query for every report | `assignmentRows()` builds one row per assignment; the summary, assignments list and progress report all derive from it | Numbers on different pages can't disagree |
| Idempotent bulk assign | Assigning modules × learners skips pairs that already exist and reports "created / skipped" | Safe to click twice; no duplicate assignments |
| Guard-rails in the backend | Only ACTIVE modules, only own-facility learners, never deactivated learners | The UI hides these too, but the server is the authority |
| Soft delete | "Deactivate" sets a status; history is kept and can be reactivated | Training records are evidence — never destroy them by accident |
| Invites | New learner = INVITED + 7-day single-use link; resending replaces the old link; changing an invited learner's email re-sends | A typo'd or leaked invite can't be used |
| "Needs attention" | Pending invites, learners locked out, learners who failed a check | Turns data into actions for a busy manager |

> 💡 **Beginner tip — 404 vs 403 again:** when Pinecrest's admin opens `/facility/learners/<Harbor learner id>`, the page says "Learner not found" — exactly what it says for an id that doesn't exist. They can't even learn that the id is real.

### 5.11 Platform administration & the content editor

**🛠 Built (F5)**

```
/admin                        platform totals, facilities overview, quick actions, activity
/admin/facilities(/[id])      create / edit / deactivate facilities; read-only facility view
/admin/facility-admins        create, edit, deactivate, resend invite, "reset access"
/admin/content(/[id])         module list → editor: Details | Video | Decision points | Knowledge check
/admin/activity               who did what, filter by facility and type
/admin/leads                  demo requests from the website (D9)
```

**The content lifecycle (another state machine):**

```
          create                publish (checklist must be empty)
 (new) ─────────▶ DRAFT ─────────────────────────────▶ ACTIVE ──disable──▶ DISABLED
                    ▲                                     ▲                    │
                    └──── move to draft (never assigned) ─┴──── publish ───────┘
```

- **DRAFT** — can be saved incomplete; hidden from Facility Admins.
- **ACTIVE** — assignable. Publishing runs `publishProblems()`: video with a known length, ≥1 valid decision point, ≥1 valid question.
- **DISABLED** — can't be *newly* assigned, but learners who already have it keep access (no one loses work).

**Referential integrity — the key design idea in the editor:**
A learner's answer is a row that *points at* a decision point and an option (`checkpoint_responses.option_id`). If the admin deleted that option, the learner's record would point at nothing. So the server refuses to delete any decision point, question or option that learners have already used — they can be **reworded, not removed**. The editor shows these as locked ("Answered by learners — can't delete"). In SQL this is what a **foreign key** constraint does; a real system might also add **content versioning** (publish v2 while v1's history stays intact).

**Other design points:**

| Topic | What we did | Why |
|---|---|---|
| Rules shared by UI and server | `lib/content.ts` — `checkpointProblems`, `assessmentProblems`, `publishProblems` | Instant feedback while typing; the server still enforces |
| Video length read from the video | The editor loads the stream and reads `duration` | No typos; decision points are validated against it |
| Placing decision points | Scrub the preview, then "Add decision point here" / "Use current time" | Matching the exact moment by eye is how a content editor thinks |
| Temporary ids | New items get `new-…` ids; the server swaps in real ids on save | The editor can add items before they exist on the server |
| Safe URLs | Video, poster, captions and thumbnails must be `https://` or a site path | Blocks `javascript:` / `data:` links being stored and rendered |
| One editor page, four tabs, all mounted | Inactive tabs are hidden, not unmounted | Switching tabs never loses unsaved work |
| Super Admin reuses Facility Admin endpoints | The facility view calls `getFacilitySummary(facilityId)` | `resolveFacility()` lets a Super Admin name any facility (§5.10) |

### 5.12 The public website (porting a finished design)

**🛠 Built (F6)** — the client's designer delivered a finished static site (one `index.html` with inline CSS and JS). Instead of rewriting it in React, it's **ported mechanically** into the app by `scripts/port-public-site.py`, which can be re-run whenever the designer sends a new version.

```
client's index.html ──port script──▶  site.generated.css   CSS, every rule scoped under .cs-site
                                      markup.generated.ts  the <body> markup as a string (+ JSON-LD)
                                      site.generated.js    the script, wrapped as initSite(root) → cleanup()
                                            │
                       SiteHome.tsx ◀───────┘  server-renders the markup, starts the script after mount,
                       (route "/")              sends demo requests to data.submitDemoRequest()
```

**The three hard problems and how they were solved:**

| Problem | Solution | Concept to name in an interview |
|---|---|---|
| The site's CSS (`:root`, `body`, `.btn`, `@keyframes ring`…) would leak into the app — and the app's into the site | Every selector prefixed with `.cs-site`; `:root`/`body` → `.cs-site`; `html` → `html:has(.cs-site)`; keyframes renamed `cs-*` | **CSS scoping / style isolation** (what CSS Modules and Shadow DOM do automatically) |
| The site's script adds global listeners and timers, but Next.js hides and re-shows pages (it never "unloads") | While starting up, `EventTarget.prototype.addEventListener` is temporarily wrapped to *record* every listener; timers go through a tracker; `cleanup()` removes them all. Returning to the page resets the markup and starts fresh | **Lifecycle management / resource cleanup** — the "mount → unmount" contract every component must honour |
| The form had no backend | `submitDemoRequest` in the script now calls the app's data layer → the Super Admin's Demo Requests | **Adapter** again (§5.6): the old code calls one function; we swapped what's behind it |

**How "it looks the same" was proved, not assumed:** a script computed 17 style properties for all 803 elements on the original page and on the ported page and compared fingerprints. 792 matched exactly; the 11 differences were explained — one was a bug in the original ("See the takeaway" showed too early), which the port fixes.

**Then made multi-page (for client review).** The one-page original was split into pages that follow the sitemap (§11) — `/`, `/training`, `/platform`, `/who-we-serve`, `/about`, `/contact` — reusing its sections unchanged:

```
port script ──▶ SITE_TOP · SITE_SECTIONS{hero, training, how, platform, …} · SITE_FOOTER · SITE_MODAL · SITE_CONTACT
                                              │
pages.ts  ──▶ SITE_PAGES = { training: ["training", "how", "cta"], platform: ["platform", "pricing", "cta"], … }
              buildPageMarkup(key) = header + chosen sections + footer (+ demo popup)
```

The one-page assumptions in the designer's script were patched in the port script, each marked `// multi-page port`: the header is solid on pages without a hero; the home page's "Practice" button now opens `/training#scenario-N`; in-page anchors (`#training`) became routes (`/training`). Inner pages get a screen-reader-only `<h1>` naming the page, so headings run h1 → h2 → h3 without skipping (promoting the visible `<h2>` would have left its `<h3>`s skipping a level, and renaming tags would break the designer's tag-based CSS). This is **composition** — pages are lists of reusable parts, so regrouping them is a one-line change in `pages.ts`.

**Other F6 decisions:** the public demo endpoint re-validates every field, caps lengths and ignores a duplicate within a minute (public endpoints can't trust the form); "Sign in" links added to the site; placeholder privacy/terms pages that say plainly they're placeholders (no invented legal text); the app adopted the site's brand (evergreen, cream, copper; Hanken Grotesk + Newsreader, self-hosted with `next/font`).

### 5.7 Edge cases

| Situation | Handling |
|---|---|
| Learner answers in two tabs | (user, checkpoint) is unique → first answer kept |
| Network drops mid-video | Provider buffers; failed saves retry |
| Module deactivated after assignment | Existing assignments still work; can't be newly assigned |
| Learner deactivated | Can't log in; history kept for reports |
| Refresh mid-video | Resumes from saved position, answered checkpoints skipped |

---

## 6. Trade-offs we made (and the alternatives)

Every design choice has a cost. Interviewers want to hear that you **know the alternatives**.

| Choice | Alternative | Why we didn't pick the alternative (yet) |
|---|---|---|
| Modular monolith | Microservices | More services = more deploys, networking, monitoring. Overkill for ~5k users and a small team. *Revisit if* modules need to scale or deploy independently. |
| Shared DB + `facility_id` | Separate database per facility | Strongest isolation, but costly and painful to migrate/maintain. *Revisit if* a big enterprise client demands physical isolation. |
| Client-side checkpoint timing | Server-driven timing | Network delay would make the pause late/inaccurate. |
| External video provider | Self-hosted video | Building adaptive streaming + CDN ourselves is expensive and risky. |
| Store `learner_progress` | Compute it from responses/attempts each time | Storing is fast to read but can drift out of sync; computing is always correct but slower. We store it and update it in the same transaction. |
| Frontend-first | Backend-first | Client sees progress early; risk is the backend must match the mock interface — mitigated by defining types from the data model first. |

---

## 7. Interview kit

### 7.1 The 30-second pitch
> "I worked on Continuum-Standard, a multi-tenant training platform for behavioral-health facilities. Its core feature is interactive scenario video — the video pauses at configured timestamps, asks the learner a decision question, shows expert feedback, and continues. It has three roles — Super Admin, Facility Admin and Learner — with strict facility-level data isolation. The stack is Next.js, a modular REST API and PostgreSQL, with an external video streaming provider."

### 7.2 The 2-minute walkthrough (structure)
1. **Problem** — frontline staff need safe practice for high-risk conversations.
2. **Users & roles** — three roles, each facility is a tenant.
3. **HLD** — frontend, modular monolith API, Postgres, video provider, email.
4. **Hardest part** — the video checkpoint engine (state machine, persistence, no skipping).
5. **Key decision** — shared-DB multi-tenancy with server-side scoping, and why.
6. **Trade-off** — monolith vs microservices for this scale.
7. **What I'd do at 10× scale** — see 7.4.

### 7.3 Likely questions & model answers

**Q: How do you make sure one facility can't see another's data?**
A: Every facility-owned row has a `facility_id`, directly or through its parent. All queries go through a scoping helper that filters by the *logged-in user's* facility — never a value from the request. It's enforced on the server, and we return 404 for out-of-scope records so we don't leak their existence. We also test it by trying direct API calls across facilities.

**Q: Why a monolith and not microservices?**
A: Small team, tight timeline, ~5k users. Microservices add network calls, distributed failures, and deployment overhead with no benefit at this scale. We kept clear module boundaries so we could split later if needed.

**Q: How does the video pause exactly at the right moment?**
A: It's done in the browser, not the server, to avoid network delay. While playing, a `requestAnimationFrame` loop compares the current time with the next unanswered checkpoint every frame; when it's due, the player pauses and snaps to the exact timestamp. Because animation frames stop in background tabs, the video's `timeupdate` event runs the same check as a safety net. The rules themselves are a pure, unit-tested state machine, separate from the React component. Answers are saved before feedback is shown, so progress survives a refresh.

**Q: How did you test the video engine?**
A: The rules are pure functions, so they have unit tests (Vitest) for every transition and the seeking maths. Then I ran the scope document's §7.1 acceptance test in a real browser: pause landed at 30.000 s, play and seek were blocked during the question, a simulated network failure kept the answer and offered a retry, refresh resumed at the saved position, and both the native-HLS and hls.js code paths played.

**Q: What if the learner refreshes the page mid-video?**
A: We store `last_position_sec`, `furthest_sec`, and each checkpoint response. On reload we resume from the last position and skip answered checkpoints.

**Q: How would you stop learners skipping the questions?**
A: Track `furthest_sec`. If they seek beyond it, snap back. While a checkpoint is open, controls are locked.

**Q: How is the content managed without developers?**
A: It's data-driven — modules, timestamps, questions and rationales live in the database and are edited through a Super Admin content editor, with draft/active status so incomplete content can't be assigned.

**Q: How does login and password reset work?**
A: Email + password sign-in, plus emailed single-use links for invites and resets that expire after 60 minutes. The forgot-password page always gives the same answer so it can't be used to discover accounts, `next=` redirects are limited to in-app paths, and every request re-checks the account — so deactivating someone signs them out immediately. Routing uses one `canAccess(role, path)` function shared by the menu, the guard and the redirects. All of it is currently enforced in a mock; the real API must enforce it again server-side, with hashed passwords.

**Q: How do you stop learners cheating on the knowledge check?**
A: The browser never receives the answer key — the server strips `isCorrect` before sending questions, and a test checks the JSON. The browser sends only the chosen options and the server scores them. Correct answers are revealed only after a pass, the check unlocks only after the video is watched, and attempt limits and "no retakes after passing" are enforced on the server, not just hidden in the UI.

**Q: How did you design the data for the learner dashboard?**
A: One "view model" call, `listMyTraining()`, returns each assigned module with its status, progress, attempts and next step already worked out. That avoids the N+1 problem of fetching module, progress, attempts and answers separately for every card, and keeps the status rules in one place on the server (Backend-for-Frontend pattern).

**Q: How did you build the facility reports?**
A: Everything starts from one base query that turns each assignment into a row with status, progress, best score and attempts — computed with the same rules the learner sees. The dashboard summary, the assignments list and the progress report all derive from those rows, so their numbers always agree. Every admin endpoint first resolves the facility from the session, so a Facility Admin can only ever see their own facility, and a Super Admin must name one explicitly.

**Q: How do non-developers manage the training content?**
A: Content is data, not code. A Super Admin builds a module in an editor: details, the video link (its length is read automatically), decision points placed by scrubbing the preview, and a knowledge check. Modules start as drafts and can only be published once a checklist passes. After learners have answered, the server won't let anyone delete a decision point, question or option they used — it can be reworded but not removed — so learner records never point at missing content. That's referential integrity; in a database it's a foreign key, and a fuller system would add content versioning.

**Q: The designer gave you a finished static HTML site. How did you integrate it?**
A: I ported it with a script rather than rewriting it, so a new design version can be dropped in by re-running the script. The CSS is scoped under one wrapper class so it can't leak into the app, the markup is server-rendered for search engines, and the site's script is wrapped so it records every listener and timer it creates and removes them when the page is hidden — important because Next.js keeps visited pages alive. The demo form was connected to our data layer. I verified the result by comparing the computed styles of all 803 elements against the original.

**Q: What are the security considerations?**
A: Hashed passwords, HTTPS, server-side RBAC and tenant scoping, input validation, signed video URLs, and a strict no-patient-data policy.

### 7.4 "How would you scale this 10×?" (500 facilities, 50k users)
- Add a **read replica** for reports so heavy queries don't slow the app.
- Add **caching** (e.g. Redis) for module/catalogue data that rarely changes.
- Run **multiple API instances** behind a load balancer (the API should be stateless).
- Move emails and report generation to a **background job queue**.
- Add **indexes** on `facility_id`, `user_id`, `module_id`.
- Video already scales via the provider's CDN.
- Consider **Postgres row-level security** as a second layer of tenant isolation.

### 7.5 Self-test questions
1. Why is `facility_id` on `assignments` but not on `checkpoint_responses`? Is that safe?
2. Why return 404 instead of 403 for another facility's learner?
3. Which HLD decision would you revisit first at 500 facilities?
4. Store `learner_progress`, or compute it? What does each choice cost?
5. Draw the player state machine from memory.
6. What's the difference between authentication and authorization?

<details><summary>Answers (try first!)</summary>

1. `checkpoint_responses` belongs to a user, and the user belongs to a facility, so it's traceable through the parent. It's safe **only if** every query joins through the user and applies the facility scope.
2. 403 confirms the record exists; 404 reveals nothing.
3. Likely reporting performance (read replica/caching) and possibly stronger tenant isolation (row-level security).
4. Stored = fast reads, risk of drift. Computed = always correct, slower. Stored + updated in the same transaction is a common middle ground.
5. IDLE → PLAYING → CHECKPOINT → FEEDBACK → PLAYING … → ASSESSMENT → COMPLETE.
6. Authentication = *who are you?* (login). Authorization = *what are you allowed to do?* (roles, facility scope).
</details>

---

## 8. Glossary

| Term | Plain meaning |
|---|---|
| **HLD** | Big-picture design: components and how they connect |
| **LLD** | Detailed design: tables, APIs, classes, logic |
| **Monolith** | One deployable backend application |
| **Modular monolith** | One app, internally split into clear modules |
| **Microservices** | Many small apps, each deployed separately |
| **Multi-tenancy** | One system serving many separate customers (tenants) |
| **Tenant** | One customer's isolated space — here, a facility |
| **RBAC** | Role-Based Access Control — permissions come from your role |
| **Authentication** | Proving who you are (login) |
| **Authorization** | Deciding what you're allowed to do |
| **REST API** | A way for frontend and backend to talk over HTTP using URLs + verbs |
| **ER diagram** | Picture of database tables and their relationships |
| **Sequence diagram** | Picture of who calls whom, in order |
| **State machine** | A model where something is in one state at a time with defined transitions |
| **Signed URL** | A temporary link that expires, used to protect private files/videos |
| **CDN** | Network of servers that deliver files from near the user |
| **Adapter pattern** | Wrapping different implementations behind one interface |
| **NFR** | Non-functional requirement — how well, not what |
| **PHI** | Protected Health Information (patient data) — we never store it |
| **Read replica** | A copy of the database used only for reading |

---

## 9. Design Decision Journal (living record)

Each entry follows the **ADR** (Architecture Decision Record) format — a real industry practice worth mentioning in interviews.

| # | Date | Level | Decision | Why | Alternatives considered |
|---|---|---|---|---|---|
| 1 | 2026-11-19 | HLD | Build frontend first with a mock data layer | Client sees a working product early; video engine (biggest risk) proven first | Backend-first |
| 2 | 2026-11-19 | HLD | Next.js + TypeScript + Tailwind | Matches scope document; strong typing reduces bugs | Plain React + Vite |
| 3 | 2026-11-19 | HLD | Video via HTML5 + hls.js behind a provider adapter | Stays provider-agnostic until Mux/AWS is chosen | Commit to Mux Player now |
| 4 | 2026-11-19 | LLD | Per-role navigation from sitemap, not the shared wireframe nav | Wireframes showed admin menus to learners — conflicts with role rules | Follow wireframes literally |
| 5 | 2026-11-19 | LLD | Assign to multiple learners at once; no "Group" table | Scope mentions groups but data model has no Group entity | Add a Group entity |
| 6 | 2026-11-19 | LLD | No skipping ahead past `furthest_sec` | Learners must not bypass decision points | Free seeking |
| 7 | 2026-11-19 | LLD | Feedback: general and/or per-option rationale; grading only in quiz | Flexible for client content | Single rationale only |
| 8 | 2026-11-19 | LLD | New users get an invite link to set password | Avoids sending passwords by email | Temporary passwords |
| 9 | 2026-11-19 | LLD | Seed two facilities in mock data | Lets us demonstrate tenant isolation in the UI | One facility |
| 10 | 2026-11-19 | HLD | Frontend lives in `web/`; backend will get its own folder (e.g. `api/`) | Keeps the two deployable parts separate in one repo (a simple *monorepo*) | Frontend at repo root |
| 11 | 2026-11-19 | LLD | Mock enforces the same role + facility scoping as the real API, returning NOT_FOUND for out-of-scope records | UI is built against correct "no" behaviour from day one | Permissive mock |
| 12 | 2026-11-19 | LLD | Mock database = one versioned JSON blob in `localStorage`, with a Reset button | Survives refresh (needed for the §7.1 test); version number discards stale data when the seed shape changes | In-memory only (lost on refresh); IndexedDB (more complex) |
| 13 | 2026-11-19 | LLD | Login returns the same error for "unknown email" and "wrong password" | Prevents *user enumeration* — attackers can't discover which emails have accounts | Separate messages |
| 14 | 2026-11-19 | LLD | Added `Lead` and `ActivityEvent` types beyond the §8 model | Needed for demo-request capture (D9) and Super Admin activity (F5.8) | Leave out until backend |
| 15 | 2026-11-19 | LLD | Demo tools (quick sign-in, account switcher, reset) behind `NEXT_PUBLIC_DEMO_TOOLS` flag | Fast client demos, but can be switched off for any real deployment | Separate demo build |
| 16 | 2026-11-19 | LLD | Player rules as a pure reducer + helper functions, separate from the React component | Rules can be unit-tested and explained without a browser | Logic inside the component |
| 17 | 2026-11-19 | LLD | `requestAnimationFrame` for frame-accurate pausing, with `timeupdate` as a background-tab fallback | `timeupdate` alone is ~250 ms late; rAF alone stops in hidden tabs | `timeupdate` only |
| 18 | 2026-11-19 | LLD | Video adapter keeps "one source per element"; stale detaches are no-ops | React runs effects twice in development, and an old cleanup was wiping the new source | Ignore (works in production only) |
| 19 | 2026-11-19 | LLD | Checkpoint answers are idempotent — first answer per (learner, checkpoint) wins | Two tabs or a retried request can't create conflicting answers | Last answer wins |
| 20 | 2026-11-19 | LLD | Server only lets `furthestSec` increase | A buggy or tampered client can't "un-watch" or fake progress backwards | Trust the client value |
| 21 | 2026-11-19 | LLD | Answered decision points aren't asked again; seeking is free once the video is finished | Repeat visits shouldn't block review (D7 territory) | Re-ask every visit |
| 22 | 2026-11-19 | LLD | Watching the video doesn't complete the module — status stays In Progress until the knowledge check (F3) | Completion should mean video **and** assessment | Complete on video end |
| 23 | 2026-11-19 | LLD | On phones the question panel sits below the video instead of over it | A 16:9 video on a 375 px screen is ~200 px tall — too small for four options | Overlay everywhere |
| 24 | 2026-11-19 | LLD | Vitest for unit tests | Fast, TypeScript-native, no extra build config | Jest |
| 25 | 2026-11-19 | LLD | Role areas `/admin`, `/facility`, `/learn` + shared `/profile`; one `canAccess()` used by nav, guard and redirects | One rule in one place can't drift out of sync | Per-page role checks |
| 26 | 2026-11-19 | LLD | Client-side route guard (`AuthGate`) for now | Auth is mocked in the browser; real sessions will be checked on the server (cookies / proxy) | Server guard now (no server yet) |
| 27 | 2026-11-19 | LLD | Forgot password always shows the same message | Prevents user enumeration | "No account with that email" |
| 28 | 2026-11-19 | LLD | Single-use, expiring (60 min), random tokens for reset and invite links | Leaked/old links can't be reused | Long-lived links |
| 29 | 2026-11-19 | LLD | Setting a password from a link signs the user in | The emailed link already proves they own the address — one less step | Make them log in again |
| 30 | 2026-11-19 | LLD | `next=` accepts in-app paths only, and only if the role may open them | Blocks open-redirect phishing; avoids bouncing to a forbidden page | Trust `next` |
| 31 | 2026-11-19 | LLD | Account/facility status re-checked on every request and on data changes (incl. other tabs) | Deactivation takes effect immediately (F2.7) | Check only at login |
| 32 | 2026-11-19 | LLD | Profile: users edit name and job title; email changes go through admins | Email is the login identity and the facility's record | Self-service email change |
| 33 | 2026-11-19 | LLD | Per-user passwords in the mock + demo one-click sign-in that skips the password | Lets password changes be tested while keeping demos fast | One shared demo password |
| 34 | 2026-11-19 | LLD | `useResetOnHide` for one-off form state | Next.js 16 keeps hidden pages' state; "loading"/"sent" flags and typed passwords must not survive | Remount pages on every visit |
| 35 | 2026-11-19 | LLD | Next.js automatic "instant navigation" validation set to opt-in | Client-side guard means signed-in pages can't be prerendered; revisit with server auth | Leave warnings on every page |
| 36 | 2026-11-19 | LLD | `listMyTraining()` view-model endpoint (Backend-for-Frontend) | One request per page instead of N+1; status rules stay server-side | Many small calls from each card |
| 37 | 2026-11-19 | LLD | Knowledge check sent without `isCorrect`/feedback; scored server-side | The client can't read or fake answers | Score in the browser |
| 38 | 2026-11-19 | LLD | Correct answers revealed only after a pass (or when out of attempts) | Prevents passing by trial and error | Always show answers |
| 39 | 2026-11-19 | LLD | Check unlocks after the video; no retakes after passing | Order of learning matters; a pass is final (D7 read-only review) | Allow anytime / unlimited retakes |
| 40 | 2026-11-19 | LLD | `deriveStatus()` + `nextStep()` pure functions used by every learner screen | One rule, many screens — they can't disagree | Each page works it out itself |
| 41 | 2026-11-19 | LLD | Player saves go through a promise queue; "video finished" fires only after it's saved | Fixes a race that could lose the finish and lock the check | Skip a save if one is running |
| 42 | 2026-11-19 | LLD | "Start" goes to the intro page first; other steps jump straight to the player/check | Learners see objectives before starting; returning learners skip a click | Always go to intro |
| 43 | 2026-11-19 | LLD | Signed-in layout wrapped in `<Suspense>` | The guard reads the URL, which isn't known when prerendering dynamic routes | Make every route fully dynamic |
| 44 | 2026-11-19 | LLD | `resolveFacility()`: Facility Admin → own facility only; Super Admin → must name one | One tenant rule for every admin endpoint, reusable by F5 | Separate endpoints per role |
| 45 | 2026-11-19 | LLD | One `assignmentRows()` base query feeds summary, list and progress report | Consistent numbers everywhere | Separate queries per page |
| 46 | 2026-11-19 | LLD | Bulk assign is idempotent and returns created/skipped counts | Safe retries and double-clicks; clear feedback | Error on duplicates |
| 47 | 2026-11-19 | LLD | Only ACTIVE modules and non-deactivated, own-facility learners can be assigned | Scope doc §6.4 (no accidental draft assignment) + tenant rule | Trust the form |
| 48 | 2026-11-19 | LLD | Deactivate = soft delete (status), history kept, reactivation possible | Training records must not be lost | Hard delete |
| 49 | 2026-11-19 | LLD | Learner emails unique platform-wide; admins can change them; an invited learner's email change re-sends the invite | Email is the sign-in identity | Per-facility uniqueness |
| 50 | 2026-11-19 | LLD | Invite links last 7 days (resets: 60 min) and resending replaces the old link | Invites may sit in an inbox for days; resets are more sensitive | Same expiry for both |
| 51 | 2026-11-19 | LLD | "Needs attention" list: invite pending, locked out, failed check | Makes the dashboard actionable | Numbers only |
| 52 | 2026-11-19 | LLD | No "unassign" in Phase 1 | Not in the scope document; removing records needs rules about progress already made | Allow unassign |
| 53 | 2026-11-19 | LLD | Module lifecycle DRAFT → ACTIVE → DISABLED; back to DRAFT only if never assigned | Drafts can't be assigned by accident; disabling never takes training away from learners | Delete modules |
| 54 | 2026-11-19 | LLD | Publishing gated by `publishProblems()` | A learner can never open a half-built module | Trust the editor |
| 55 | 2026-11-19 | LLD | Items learners have answered can be reworded but not deleted | Referential integrity — learner records must not point at missing content | Allow deletes (orphaned answers) / full versioning (bigger build) |
| 56 | 2026-11-19 | LLD | Validation rules in `lib/content.ts`, shared by editor and server | Instant feedback, single source of truth | Duplicate rules in UI and API |
| 57 | 2026-11-19 | LLD | Video length read from the stream, not typed | Avoids wrong durations; decision points validated against the real length | Manual duration field |
| 58 | 2026-11-19 | LLD | Media links must be `https://` or a site path | Prevents storing `javascript:`/`data:` URLs | Accept any string |
| 59 | 2026-11-19 | LLD | Editor tabs stay mounted (hidden) | Switching tabs never loses unsaved edits | Unmount on tab change |
| 60 | 2026-11-19 | LLD | Thumbnails: pick a bundled image or paste a link (no uploads) | No file storage in Phase 1; uploads belong with the real backend | Build an upload flow now |
| 61 | 2026-11-19 | LLD | "Reset access" for a Facility Admin emails a reset link; the current password keeps working until used | Admin never sees or sets someone else's password | Admin sets a temporary password |
| 62 | 2026-11-19 | LLD | Facility deactivation is a switch, not a delete; it signs out everyone at that facility | Contracts pause and resume; records must survive | Delete facility |
| 63 | 2026-11-23 | HLD | The client's static site becomes the app's public pages (one domain, one deploy) | Demo requests reach the app; one thing to host and secure | Separate static site + later API hookup |
| 64 | 2026-11-23 | LLD | Port with a re-runnable script instead of rewriting in React | Keeps the designer's work exact; new versions are a re-run, not a rewrite | Hand-convert ~2,400 lines to JSX |
| 65 | 2026-11-23 | LLD | Site CSS scoped under `.cs-site`; keyframes prefixed | Neither the site nor the app can restyle the other | Load the CSS globally |
| 66 | 2026-11-23 | LLD | Site script wrapped to record listeners/timers and clean them up; markup reset on return | Next.js keeps pages alive; without cleanup, listeners and timers pile up | Run the script once and hope |
| 67 | 2026-11-23 | LLD | Public `submitDemoRequest` re-validates, caps lengths, de-duplicates within a minute | Anyone can call a public endpoint directly | Trust the form's checks |
| 68 | 2026-11-23 | LLD | Placeholder privacy/terms pages that say they're placeholders | Legal text is client-supplied (scope doc §1.2); invented policy text is a risk | Generic template text |
| 69 | 2026-11-23 | HLD | App adopts the site's brand; fonts self-hosted via `next/font` | One consistent product; no runtime requests to Google | Keep the placeholder palette |
| 70 | 2026-11-23 | LLD | Demo toolbar hidden on marketing pages | The public site should look like the real thing | Show it everywhere |
| 71 | 2026-11-24 | LLD | Copyright year read in the browser after hydration | Next.js 16 refuses `new Date()` during prerender (the value would be frozen at build time) | Hard-code the year |
| 72 | 2026-11-24 | HLD | Public site split into pages following the sitemap, for client review | A real multi-page site is easier to review and matches §11 | Keep the one-page site |
| 73 | 2026-11-24 | LLD | Pages composed from the original sections (`pages.ts`), not rewritten | Regrouping is a one-line change; the designer's copy stays exact | Hand-build each page |
| 74 | 2026-11-24 | LLD | `/contact` shows the form inline; other pages keep the popup | A contact page should work without JavaScript popups; the popup stays handy elsewhere | Popup everywhere |
| 75 | 2026-11-24 | LLD | Port script syntax-checks its generated script (`node --check`) and refuses to finish if it's broken | A broken generated file once reached the dev server | Rely on noticing errors in the browser |
| 76 | 2026-11-24 | LLD | Inner pages: screen-reader-only `<h1>` + the designer's visible `<h2>` | Correct heading order without touching tag-based CSS | Promote h2→h1 (left h3s skipping a level) |
| 77 | 2026-11-24 | LLD | `robots.txt` blocks everything until `SITE_ALLOW_INDEXING=true`; the app and auth pages are always disallowed; `sitemap.xml` lists only public pages | A demo on mock data shouldn't be indexed; launch is one setting | No robots file (search engines index the demo) |
| 78 | 2026-11-24 | LLD | Favicon generated from the site's own mark (`app/icon.svg`) | One brand everywhere, kept in sync by the port script | Keep Next's default icon |
| 79 | 2026-11-24 | LLD | Legal pages rendered inside the site's header/footer | Consistent site; the old separate layout looked like a different product | Separate simple layout |

---

## 10. Lessons learned (living record)

| Date | Lesson |
|---|---|
| 2026-11-19 | Requirements documents can contradict themselves (wireframe nav vs sitemap). Verifying requirements before planning caught it early. |
| 2026-11-19 | Hiding UI isn't security — tenant isolation must be enforced on the server. Frontend checks are for user experience only. |
| 2026-11-19 | Frameworks change fast: Next.js 16 ships its own docs inside `node_modules/next/dist/docs/`. Reading the docs for the installed version beats relying on memory. |
| 2026-11-19 | Server rendering can't see browser storage. Reading `localStorage` during the first render causes hydration mismatches, so browser-only data is read after hydration. |
| 2026-11-19 | React's development mode runs effects twice on purpose. It exposed a real race in the video adapter (an old cleanup removing the new source) — a bug that would also have hit fast navigation in production. |
| 2026-11-19 | Measure, don't assume: the sample video was 634.6 s, not the 596 s in the seed. Server-side clamping used the wrong value until it was measured. Bumping the mock DB version cleared the stale stored copy. |
| 2026-11-19 | Testing in a hidden browser tab revealed that animation frames pause there — which led to the `timeupdate` safety net. Real-world conditions find bugs unit tests don't. |
| 2026-11-19 | Next.js 16 keeps visited pages alive in the background. Code that assumes "navigating away unmounts the page" breaks: stale `loading` flags blocked a redirect and the video player tried to auto-play on return. Design components to be hidden and shown, not just mounted once. |
| 2026-11-19 | Two redirects racing (the guard's "signed out → login?next" vs. sign-out's "login?reason") produced the wrong page. A small "we're leaving on purpose" flag fixed it — watch for competing side effects reacting to the same state change. |
| 2026-11-19 | "Skip if busy" is a dangerous optimisation: dropping a save looked harmless until the dropped one was the important one. Prefer queuing over skipping when every write matters. |
| 2026-11-19 | The dev server passed but the production build failed (URL hooks outside `<Suspense>` on dynamic routes). Always run the production build before calling a phase done. |
| 2026-11-19 | Backend rules are easiest to test without the UI: `mock/learner.test.ts` checks "answer key never sent", attempt limits and completion in milliseconds. The same tests become the contract for the real API. |
| 2026-11-19 | A hidden screen-reader label (`sr-only`, absolutely positioned) escaped a scrolling table and made the whole page scroll sideways on phones. Fix: `position: relative` on the scroll container. Check layouts at phone width on every phase. |
| 2026-11-19 | Test tooling can mislead: a browser script that timed out kept running in the page and produced a confusing "paused at 29.6 s" reading. Before calling something a bug, reproduce it cleanly — here a clean rerun showed the player was correct. |
| 2026-11-19 | CSS grid items default to `min-width: auto`, so a wide table inside a one-column grid stretched the whole page on phones. `grid-cols-1` (= `minmax(0, 1fr)`) lets the column shrink and the table scroll inside its card. |
| 2026-11-19 | Hot reload doesn't always update a page that Next.js is keeping alive in the background — a stale class name looked like a failed fix. When a fix "doesn't work", reload before digging deeper. |
| 2026-11-19 | Deleting is the dangerous operation in a content editor. Designing "what happens to learner records?" first led to the reword-not-remove rule. |
| 2026-11-23 | "Looks the same" should be measured: fingerprinting computed styles of every element found 11 differences out of 803 — and one turned out to be a bug in the original. |
| 2026-11-23 | Adding a URL hook to a component in the root layout broke the production build (needs `<Suspense>`). Small changes to shared layout pieces have wide effects — rebuild after touching them. |
| 2026-11-24 | Next.js 16 rejects `new Date()` during prerender even in Client Components. Time-dependent output must happen at request time or in the browser after hydration. |
| 2026-11-24 | A text-transform script broke the generated code because it edited a string *after* computing positions in it — the offsets were stale. Apply edits in an order where earlier changes can't move later targets, and verify the output automatically. |
| 2026-11-24 | A review checklist (links, one h1, heading order, alt text, labels, favicon, robots/sitemap, phone width, keyboard) found six real issues that eyeballing the pages had missed. Automate the boring checks; look with human eyes for the rest. |
