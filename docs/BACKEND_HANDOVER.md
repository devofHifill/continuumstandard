# Backend handover — Continuum-Standard Phase 1

What the backend team needs to replace the frontend's mock data with a real server.
Written at the end of the frontend build (F7, 2026-11-24).

**The short version:** the UI talks to one TypeScript interface, `DataService`
([web/src/lib/data/service.ts](../web/src/lib/data/service.ts)). Today `MockDataService`
implements it in the browser using localStorage. Build an HTTP API with the same
operations, write an `ApiDataService` that calls it, and switch the export in
[web/src/lib/data/index.ts](../web/src/lib/data/index.ts). The screens don't change.

The mock already enforces every rule below, and 74 unit tests cover them
(`web/src/lib/**/*.test.ts`). **Treat those tests as the specification.** Port them as API tests.

---

## 1. The rule that matters most

> **The browser is not trusted.** The mock runs inside the browser, so anything it "enforces"
> can be bypassed by anyone with dev tools. Every check in §3 must be done again on the
> server, for every request.

The UI hides things a user can't do, but that is for convenience only. The server must enforce every permission.

---

## 2. Operations → suggested endpoints

Each `DataService` method becomes one endpoint. The paths below are a suggestion. Who can call each one is the part that matters.
"Own facility" means the facility comes from the **session**, never from the request.

### Auth & profile
| Method | Suggested endpoint | Who | Notes |
|---|---|---|---|
| `login` | `POST /auth/login` | anyone | Same error for wrong email and wrong password. Blocked if the user is INVITED/DEACTIVATED or their facility is inactive |
| `logout` | `POST /auth/logout` | signed in | Invalidate the session server-side |
| `getSession` / `refreshSession` | `GET /auth/session` | signed in | The UI re-checks on load and on focus; return 401 if the account or facility was switched off since sign-in |
| `requestPasswordReset` | `POST /auth/password-reset` | anyone | **Always 200**, whether or not the email exists (no user enumeration). Rate-limit |
| `checkAuthToken` | `GET /auth/tokens/:token?purpose=` | anyone | Invite or reset link: unknown, used or expired → the same VALIDATION error |
| `completeAuthToken` | `POST /auth/tokens/:token` | anyone | Single use. Set the password, activate an INVITED user, then sign in |
| `changePassword` | `POST /me/password` | signed in | Requires the current password |
| `updateMyProfile` | `PATCH /me` | signed in | Name and job title only. Email and role can't be changed here |

### Public website
| `submitDemoRequest` | `POST /public/demo-requests` | anyone | Re-validate every field (lengths are in `publicSite.ts`), rate-limit, add a captcha or honeypot. Shows up as a Lead |
|---|---|---|---|

### Learner (signed-in learner only, always "me")
| Method | Suggested endpoint | Notes |
|---|---|---|
| `listMyTraining` | `GET /me/training` | Assigned **and ACTIVE or DISABLED** modules only; one row per module, a view model |
| `getMyTraining` | `GET /me/training/:moduleId` | 404 if not assigned (not 403, so it doesn't reveal that the module exists) |
| `getPlayback` | `GET /me/training/:moduleId/playback` | Video, checkpoints, saved position. *Improvement over the mock:* the mock sends option rationales up front (they're feedback, not a key — D5); the server can hold them back until the learner answers |
| `submitCheckpointResponse` | `POST /me/checkpoints/:id/response` | **Idempotent:** the first answer wins and a repeat returns it. Returns the feedback for the chosen option |
| `saveProgress` | `PUT /me/training/:moduleId/progress` | `furthestSec` only ever increases and is capped at the video length (the mock does this). *Add on the server:* accept `videoCompleted` only when `furthestSec` is near the end — the mock trusts the flag |
| `getMyAssessment` | `GET /me/training/:moduleId/assessment` | **Never send the answer key.** Only after the video is completed, not yet passed, and attempts remain |
| `submitAssessment` | `POST /me/training/:moduleId/assessment/attempts` | **Score on the server.** On a pass, mark the module COMPLETED. Reveal the correct answers only after a pass |
| `listMyActivity` | `GET /me/activity` | |

### Facility Admin (own facility; a Super Admin must name the facility)
| Method | Suggested endpoint | Notes |
|---|---|---|
| `getFacilitySummary` | `GET /facilities/:id/summary` | |
| `listFacilityLearners` | `GET /facilities/:id/learners` | |
| `createLearner` | `POST /facilities/:id/learners` | Creates an INVITED learner and emails a set-password link. Email unique platform-wide |
| `updateLearner` | `PATCH /learners/:id` | 404 if the learner isn't in the caller's facility |
| `setLearnerActive` | `POST /learners/:id/(de)activate` | Deactivating keeps history and kills the learner's sessions |
| `resendInvite` | `POST /learners/:id/invite` | The old link stops working |
| `assignTraining` | `POST /facilities/:id/assignments` | `userIds × moduleIds`. ACTIVE modules only; skip existing pairs; every user must be in the facility |
| `listFacilityAssignments` | `GET /facilities/:id/assignments` | |
| `getLearnerReport` | `GET /learners/:id/report` | |

### Super Admin only
| Method | Suggested endpoint | Notes |
|---|---|---|
| `getPlatformSummary` | `GET /admin/summary` | |
| `listFacilityRows` / `createFacility` / `updateFacility` | `GET/POST /admin/facilities`, `PATCH /admin/facilities/:id` | |
| `setFacilityActive` | `POST /admin/facilities/:id/(de)activate` | Switching off blocks sign-in and ends the sessions of everyone in that facility. Nothing is deleted |
| `listFacilityAdmins` / `createFacilityAdmin` / `updateFacilityAdmin` | `/admin/facility-admins…` | Several admins per facility are allowed (D11). Created as INVITED |
| `setAdminActive` / `resendAdminInvite` / `sendAdminPasswordReset` | `/admin/facility-admins/:id/…` | |
| `listActivity` | `GET /admin/activity?facilityId&type&limit` | |
| `listLeads` | `GET /admin/leads` | Demo requests (D9) |
| `listModuleRows` / `getModuleForEdit` / `createModule` / `updateModuleDetails` | `/admin/modules…` | New modules start as DRAFT and can be incomplete |
| `saveModuleVideo` | `PUT /admin/modules/:id/video` | https-only URLs (`isSafeMediaUrl`) |
| `saveCheckpoints` / `saveAssessment` | `PUT /admin/modules/:id/checkpoints`, `…/assessment` | Ids starting with `new-` are created. **Refuse to delete anything a learner has answered** (rewording is fine) |
| `setModuleStatus` | `POST /admin/modules/:id/status` | Publishing requires `publishProblems()` to be empty; going back to DRAFT is allowed only if never assigned; DISABLED blocks new assignments |

**Not needed on the server:**
- `resetDemoData` and `subscribe`, which are mock-only.
- `listFacilities`, `listUsers`, `listAssignments` and `listProgress`, which no screen calls any more. They can be dropped.

### Errors
The UI understands these `ServiceError` codes. Map HTTP to them as follows:

| HTTP | Code | UI behaviour |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Signs the user out and returns them to the sign-in page |
| 403 | `FORBIDDEN` | Shows the message; no "Try again" |
| 404 | `NOT_FOUND` | Shows "… not found"; no "Try again". **Use 404 for other facilities' data too** |
| 400/422 | `VALIDATION` | Shows the message next to the form, so write it for a person to read |
| network / 5xx | `NETWORK` | "Can't reach the server" with **Try again**; the user stays signed in |

---

## 3. Server rules to enforce (checklist)

**Tenant isolation**
- [ ] Every query that touches users, assignments, progress, responses or attempts is filtered by the caller's facility, unless the caller is a Super Admin.
- [ ] A Facility Admin's `facilityId` comes from the session. If a request names a different one, return 404.
- [ ] Learners only ever see their own records.
- [ ] Also enforce this at the database level (row-level security or a required `facility_id` in every repository query), not only in controllers.

**Accounts**
- [ ] Passwords are hashed (argon2id or bcrypt). The rules are in `lib/auth/password.ts`: 8+ characters, with at least one letter and one number.
- [ ] Invite and reset tokens are random, stored hashed, single-use, and expire (the mock uses 7 days for invites and 1 hour for resets).
- [ ] Deactivating a user or switching a facility off ends existing sessions.
- [ ] The `next=` redirect after sign-in only allows same-site paths. The UI checks this already; check again if the server redirects.

**Training integrity**
- [ ] The answer key never leaves the server before a pass.
- [ ] Assessment scoring happens on the server (`scoreAttempt` in `lib/learning.ts`).
- [ ] The attempt limit and pass mark are per module (D6: default 80% with unlimited attempts, **pending client confirmation**).
- [ ] Checkpoint answers are first-write-wins.
- [ ] Progress can't move backwards and can't skip ahead (D4: no seeking past the furthest point; the server should reject a `furthestSec` jump larger than the elapsed time).
- [ ] Content that learners have answered can't be deleted.

**Public endpoint**
- [ ] Validate, rate-limit and add bot protection on `/public/demo-requests`.
- [ ] Store the lead, then route it to an inbox or CRM (destination: **client decision**).

---

## 4. Data model

The source of truth is [web/src/lib/types.ts](../web/src/lib/types.ts), which follows scope §8 plus two additions.

```
Facility 1─* User (role: SUPER_ADMIN | FACILITY_ADMIN | LEARNER; status: INVITED | ACTIVE | DEACTIVATED)
TrainingModule (DRAFT | ACTIVE | DISABLED) 1─1 ScenarioVideo
TrainingModule 1─* DecisionCheckpoint 1─* CheckpointOption
TrainingModule 1─0..1 KnowledgeAssessment 1─* AssessmentQuestion 1─* AnswerOption
User *─* TrainingModule  via TrainingAssignment (facilityId, assignedBy, assignedAt)
User × Module → LearnerProgress (status, lastPositionSec, furthestSec, videoCompleted, completedAt)
User × Checkpoint → CheckpointResponse (unique pair)
User × Assessment → AssessmentAttempt* (answers, scorePercent, passed)
Lead (demo requests)          — addition for D9
ActivityEvent (audit-lite feed) — addition for F5.8
AuthToken (invite/reset)      — mock-only shape; store hashed server-side
```

Suggested constraints:
- unique `(userId, moduleId)` on assignments and progress
- unique `(userId, checkpointId)` on responses
- unique lower-cased email
- `facility_id NOT NULL` for everyone except Super Admins

---

## 5. Video

Playback goes through a provider adapter ([web/src/lib/player/videoSource.ts](../web/src/lib/player/videoSource.ts)):
- Safari uses its native HLS.
- Other browsers use hls.js.
- MP4 plays directly.

To move to Mux or AWS, store the playback URL (HLS) and duration on `ScenarioVideo`; the adapter needs no other change. Use signed playback URLs so only assigned learners can stream.

**Captions** are a WebVTT file on `ScenarioVideo.captionsUrl`. The player shows a CC toggle when one exists. The current file is a placeholder, and real captions must come with each client video (accessibility requirement).

---

## 6. Browser support (F7.4)

| Browser | Status |
|---|---|
| Chrome / Chromium (desktop + Android emulation) | ✅ Tested throughout F0–F7 |
| Edge | Same engine as Chrome — expected to work, **not separately tested** |
| Safari (macOS / iOS) | **Not tested** (no Mac available). Uses native HLS, so check playback and the checkpoint pause there first |
| Firefox | **Not tested** |

The minimum versions come from Next.js 16 itself (Chrome/Edge 111+, Safari 16.4+, Firefox 111+).
The newest features the app uses are:
- `<dialog>.showModal()` for modals
- `dvh` units for the sidebar
- `structuredClone` in the mock
- `:has()` in the public-site CSS

All of these are older than that baseline, so the app adds no extra limit. One edge case: `:has()` arrived in Firefox 121, so on Firefox 111–120 the public-site styles that rely on it are skipped. **Before launch:** run the MVP click-through on real Safari (iPhone + Mac) and Firefox.

---

## 7. Known limitations of the frontend build

- **All data lives in localStorage.** Each browser has its own copy, so two people never see each other's changes. **Reset demo data** in the toolbar restores the seed data.
- **Emails aren't sent.** Invite and reset links go to a demo "outbox" shown in the toolbar.
- **The demo toolbar and its one-click account switcher must be removed or disabled in production.** It is hidden on public pages, but present in the app.
- **Placeholder content** (D14): the videos, checkpoints, rationales and quiz questions are synthetic and labelled. The sample video is a public test stream.
- **Public site** (F6): it is a port of the client's static site.
  - Images are hot-linked from Pexels.
  - `[PRICE]` placeholders remain.
  - The legal pages are placeholders.
  - `robots.txt` blocks indexing until `SITE_ALLOW_INDEXING=true`.
  - `SITE_BASE_URL` needs the live domain.
- **Website CMS** (D10) is not built and is a team decision.
- **No dates or reminders, certificates, exports or billing.** These are Phase 2 and out of scope.

---

## 8. Open decisions for the client

1. Pass mark and number of attempts (D6). The default is 80% with unlimited attempts.
2. Keep the Demo Requests page (D9), and decide where leads should also be sent.
3. Approve the page split of the multi-page public site, the pricing and the share image.
4. Supply the real videos, captions, scripts, decision points, rationales and quiz content.
5. Confirm the features the site's illustrative dashboard shows that aren't in Phase 1: report downloads, settings and team groups.
