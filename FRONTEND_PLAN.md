# Continuum-Standard — Frontend Plan & Tracker (Phase 1)

Source: `Continuum_Standard_Phase1_Master_Development_Scope.docx` (FDG-TCS-2026)
Created: 2026-11-19 · Approach: frontend-first, backed by a mock data layer

**Status legend:** ⬜ Not started · 🟨 In progress · ✅ Done · ⛔ Blocked · ➖ Dropped

---

## 1. Progress overview

| Phase | Scope | Proves | Status | Done / Total |
|---|---|---|---|---|
| F0 | Setup, design tokens, mock data layer, seed, mock login | Foundation | ✅ | 7 / 7 |
| F1 | Scenario video engine POC | Gate 2 / §7.1 | 🟨 | 8 / 9 |
| F2 | App shell & auth screens | Auth & RBAC (UI) | ✅ | 7 / 7 |
| F3 | Learner experience | Learner half of MVP test | ⬜ | 0 / 8 |
| F4 | Facility Admin | Admin half of MVP test | ⬜ | 0 / 7 |
| F5 | Super Admin & content editor | Data-driven content | ⬜ | 0 / 9 |
| F6 | Public marketing website | Website + lead capture | ⬜ | 0 / 7 |
| F7 | QA & polish | Definition of Done | ⬜ | 0 / 7 |

---

## 2. Decisions (agreed defaults)

| # | Topic | Decision | Status |
|---|---|---|---|
| D1 | Navigation | Per-role nav built from the sitemap (§11); wireframes used for layout only | ✅ Agreed |
| D2 | "Settings" page | Dropped; only Profile exists | ✅ Agreed |
| D3 | "Groups" in assignments | Multi-select learners; no saved Group entity | ✅ Agreed |
| D4 | Video seeking | Learner can't skip forward past the furthest point reached; rewinding is allowed | ✅ Agreed |
| D5 | Checkpoint feedback | Supports a general rationale and/or per-option rationale; no right/wrong grading in video (grading only in knowledge check) | ✅ Agreed |
| D6 | Pass mark / retries | Configurable per module; default 80%, unlimited retries — **confirm with client before launch** | ✅ Agreed (confirm later) |
| D7 | Revisit completed module | Allowed, read-only; original result kept | ✅ Agreed |
| D8 | New-user password | Invite link → "Set password" page | ✅ Agreed |
| D9 | Demo leads | Simple Leads list for Super Admin — **not in sitemap, confirm with client** | ✅ Agreed (confirm later) |
| D10 | Website "basic CMS" | Out of frontend scope; needs backend/headless CMS decision | ⏸ Deferred to backend |
| D11 | Admins per facility | Multiple Facility Admins allowed | ✅ Agreed |
| D12 | Module authoring | Super Admin only | ✅ Agreed |
| D13 | Stack | Next.js (App Router) + TypeScript + Tailwind; HTML5 video + hls.js behind a provider adapter (Mux/AWS later) | ✅ Agreed |
| D14 | Content | Clearly labelled synthetic placeholders; no invented clinical guidance | ✅ Agreed |

---

## 3. Task tracker

### F0 — Setup & foundation
| ID | Task | Status | Notes |
|---|---|---|---|
| F0.1 | Scaffold Next.js + TypeScript + Tailwind, lint/format | ✅ | Next.js 16.4 in `web/`; ESLint; no separate formatter yet |
| F0.2 | Design tokens (colors, type, spacing) + base components (button, input, card, table, badge, modal) | ✅ | Placeholder palette until client brand assets arrive |
| F0.3 | TypeScript types matching the §8 data model | ✅ | Facility, User, TrainingModule, ScenarioVideo, DecisionCheckpoint, CheckpointResponse, KnowledgeAssessment, AssessmentQuestion/AnswerOption, AssessmentAttempt, TrainingAssignment, LearnerProgress |
| F0.4 | Mock data service layer (same interface the real API will use), with localStorage persistence | ✅ | `DataService` interface; mock enforces role + facility scoping. Interface grows per phase |
| F0.5 | Seed data: 2 facilities, 1 Super Admin, admins + learners per facility, 2–3 sample modules | ✅ | 2 facilities, 12 users (incl. invited + deactivated), 3 modules (1 draft), sample progress |
| F0.6 | Mock login with seeded test accounts + role switcher (dev only) | ✅ | Login page + bottom demo toolbar; off via `NEXT_PUBLIC_DEMO_TOOLS=false` |
| F0.7 | "Reset demo data" control | ✅ | In demo toolbar, with confirmation |

### F1 — Scenario video engine POC (Gate 2)
| ID | Task | Status | Notes |
|---|---|---|---|
| F1.1 | Video player component with provider adapter (HTML5 + hls.js) | ✅ | `ScenarioPlayer` + `videoSource.ts`; custom controls, keyboard, fullscreen, captions track support |
| F1.2 | Sample module with one video and a checkpoint at 00:30 | ✅ | `mod-intake` on `/poc` (Mux public test stream, 10:34) |
| F1.3 | Auto-pause when the checkpoint timestamp is reached | ✅ | Measured 30.000 s; rAF loop + `timeupdate` fallback |
| F1.4 | Checkpoint overlay: question + 4 options, blocks skipping | ✅ | Play/seek locked; overlay on desktop, panel below video on phones |
| F1.5 | Save selected answer + submission time | ✅ | Idempotent: first answer wins |
| F1.6 | Show approved feedback/rationale → Continue resumes from the correct position | ✅ | General + optional per-option rationale (D5) |
| F1.7 | Progress persists after refresh/revisit (resume position, answered checkpoints) | ✅ | Refresh mid-question reopens the question |
| F1.8 | Seeking rules (D4), repeat visits, network interruption handling | ✅ | Seek clamp + snap-back; answered points not re-asked; save-failure retry; hls.js reconnect |
| F1.9 | Test in Chrome, Edge, Firefox, Safari + throttled network | 🟨 | Done in the app's Chromium (native-HLS and hls.js paths, simulated save failures). **Still to do:** real Safari/iOS, Firefox, Edge and a throttled network — needs a person with those browsers. Gate 2 sign-off pending |

### F2 — App shell & auth screens
| ID | Task | Status | Notes |
|---|---|---|---|
| F2.1 | Login page | ✅ | `next=` return, sign-out/ended messages, show-password toggle |
| F2.2 | Forgot password + reset password pages | ✅ | Same reply for any email; single-use 60-min links; demo inbox shows the link |
| F2.3 | Set password page (invite link) | ✅ | D8. Seeded invite for Chris Park; activates account and signs in |
| F2.4 | Logout + Profile page | ✅ | Edit name/job title, change password, sign out (user menu + profile) |
| F2.5 | App layout with per-role navigation | ✅ | D1. Sidebar on desktop, slide-in menu on phones; placeholder pages for every sitemap section |
| F2.6 | Route guards by role; facility-scoped data access in mock layer | ✅ | `AuthGate` + `canAccess()`. UI-only; real enforcement is backend |
| F2.7 | Deactivated-account handling | ✅ | Re-checked on every request/navigation and across tabs; signed out with explanation |

### F3 — Learner
| ID | Task | Status | Notes |
|---|---|---|---|
| F3.1 | Learner dashboard: welcome, assigned training cards, status, Start/Continue | ⬜ | |
| F3.2 | Assigned Training list | ⬜ | |
| F3.3 | Module intro page (title, objectives, Start) | ⬜ | |
| F3.4 | Module player integrating F1 engine with multiple checkpoints | ⬜ | |
| F3.5 | Knowledge check (multiple choice) | ⬜ | |
| F3.6 | Result screen: score, pass/fail, retry per D6 | ⬜ | |
| F3.7 | My Progress: completed / in progress / results, recent activity | ⬜ | |
| F3.8 | Read-only revisit of completed modules | ⬜ | D7 |

### F4 — Facility Admin
| ID | Task | Status | Notes |
|---|---|---|---|
| F4.1 | Dashboard: facility summary, quick actions | ⬜ | |
| F4.2 | Learner roster with search/filter | ⬜ | |
| F4.3 | Add / edit / deactivate learner (sends invite per D8) | ⬜ | |
| F4.4 | Assign training: select learners × modules (active modules only) | ⬜ | D3 |
| F4.5 | Assignments list with status | ⬜ | |
| F4.6 | Learner Progress: status + assessment results, filters | ⬜ | |
| F4.7 | Learner detail: assignments, checkpoint responses, attempts | ⬜ | |

### F5 — Super Admin & content
| ID | Task | Status | Notes |
|---|---|---|---|
| F5.1 | Dashboard: summary cards, recent activity, quick actions | ⬜ | |
| F5.2 | Facilities list + create/edit + activate/deactivate | ⬜ | |
| F5.3 | Facility Admins: create/edit, resend invite/reset access | ⬜ | D11 |
| F5.4 | Training content list (draft/active, enable/disable) | ⬜ | |
| F5.5 | Module editor: details, category, thumbnail, video | ⬜ | D12 |
| F5.6 | Checkpoint editor: timestamp picker on video, question, options, rationale(s) | ⬜ | D5 |
| F5.7 | Knowledge check editor: questions, options, correct answer, pass mark, retries | ⬜ | D6 |
| F5.8 | Basic activity view | ⬜ | |
| F5.9 | Leads list (demo requests) | ⬜ | D9 — confirm |

### F6 — Public website
| ID | Task | Status | Notes |
|---|---|---|---|
| F6.1 | Public header/footer (separate from app nav) | ⬜ | Footer: contact, privacy, terms, social |
| F6.2 | Home: hero ("Request a Demo" CTA), benefits, who we serve | ⬜ | |
| F6.3 | Product / Platform page | ⬜ | |
| F6.4 | Solutions / Who We Serve page | ⬜ | |
| F6.5 | Scenario Preview / Demo page | ⬜ | Sample/placeholder assets |
| F6.6 | Request a Demo / Contact form with validation + success state | ⬜ | Saves to mock Leads |
| F6.7 | Placeholder privacy/terms pages | ⬜ | Client supplies legal copy |

### F7 — QA & polish
| ID | Task | Status | Notes |
|---|---|---|---|
| F7.1 | Loading, empty and error states on all screens | ⬜ | |
| F7.2 | Responsive QA: mobile, tablet, desktop | ⬜ | |
| F7.3 | Accessibility (WCAG AA: keyboard, focus, contrast, captions) | ⬜ | |
| F7.4 | Cross-browser QA | ⬜ | |
| F7.5 | Full MVP click-through on mock data (assign → learn → result visible) | ⬜ | |
| F7.6 | Cross-facility isolation check in UI (Facility A can't see B) | ⬜ | |
| F7.7 | Known limitations + backend handover notes | ⬜ | |

---

## 4. Requirement coverage

| §13.1 acceptance item | Covered by | Frontend can fully prove? |
|---|---|---|
| Website responsive, demo submissions stored | F6, F7.2 | Partly — storage needs backend |
| Super Admin creates facility + Facility Admin | F5.2, F5.3 | UI yes |
| Facility Admin manages own learners | F4.2, F4.3 | UI yes |
| Facility Admin can't access other facilities | F2.6, F7.6 | No — needs server enforcement |
| Learner sees only assigned training | F3.1, F3.2 | UI yes |
| Content configurable without hardcoding | F0.4, F5.4–F5.7 | Yes |
| Video pauses at timestamp, correct checkpoint | F1 | Yes |
| Answer saved, feedback shown, video resumes | F1, F3.4 | Yes (local storage) |
| Assessment completed, scored, persisted | F3.5, F3.6 | Yes (local storage) |
| Status/outcome visible to learner and admin | F3.7, F4.6 | Yes |
| Responsive, cross-browser, regression | F7 | Yes |
| Production, SSL, backups, monitoring | — | No — infrastructure |

**Excluded (Phase 2+), do not build:** billing/Stripe, seats, certificates, audit/CSV/PDF exports, due dates & reminders, org/region hierarchy, Org Admin role, self-service signup, custom branding, AI roleplay, advanced analytics, SSO/EHR/HRIS.

---

## 5. Needs backend / client (not frontend)

| Item | Owner | Status |
|---|---|---|
| Real authentication, password hashing, sessions | Backend | ⬜ |
| Server-side RBAC + facility scoping on every query | Backend | ⬜ |
| Lead storage/routing destination | Backend + client | ⬜ |
| Website CMS approach (D10) | Team decision | ⬜ |
| Video hosting (Mux/AWS) | Backend | ⬜ |
| Confirm pass mark/retries (D6) and Leads page (D9) | Client | ⬜ |
| Real videos, scripts, checkpoints, rationales, quiz content | Client | ⬜ |
| Brand assets, website copy, legal text | Client | ⬜ |

---

## 6. Change log

| Date | Change |
|---|---|
| 2026-11-19 | Plan created; defaults D1–D14 agreed |
| 2026-11-19 | F2 complete: role areas `/admin`, `/facility`, `/learn` + `/profile`; route guard; login/forgot/reset/set-password; profile. Temporary `/dashboard` removed (its scoped-data preview now sits on each role dashboard). Mock DB version 3 (per-user passwords, auth tokens, demo outbox). Next.js instant-navigation validation set to opt-in |
| 2026-11-19 | F1 built (8/9): scenario player, pure engine with 17 unit tests, provider adapter, `/poc` page with §7.1 checklist and demo debug panel. Cross-browser testing (F1.9) still open. Mock DB version bumped to 2 (sample video duration corrected to 635 s) |
| 2026-11-19 | F0 complete: Next.js app in `web/`, mock data layer, seed data, demo login/toolbar. Temporary `/dashboard` preview shows scoped data per account. Added `Lead` and `ActivityEvent` types (not in §8) for D9 and F5.8 |
