import type {
  ActivityEvent,
  AssessmentAttempt,
  CheckpointResponse,
  DecisionCheckpoint,
  Facility,
  KnowledgeAssessment,
  Lead,
  LearnerProgress,
  ScenarioVideo,
  TrainingAssignment,
  TrainingModule,
  User,
} from "@/lib/types";

/**
 * Seed data for the mock backend.
 *
 * ⚠ All training content is SYNTHETIC PLACEHOLDER content (decision D14).
 * Prompts, options and rationales are deliberately generic; the real, clinically
 * approved content is supplied by The Continuum-Standard. Never replace these with
 * invented clinical advice.
 *
 * Two facilities exist so tenant isolation can be demonstrated (decision log #9).
 */

/** Shared password for every seeded demo account. Mock only — never a real credential. */
export const DEMO_PASSWORD = "Demo#2026";

export interface MockDb {
  version: number;
  facilities: Facility[];
  users: User[];
  modules: TrainingModule[];
  videos: ScenarioVideo[];
  checkpoints: DecisionCheckpoint[];
  checkpointResponses: CheckpointResponse[];
  assessments: KnowledgeAssessment[];
  attempts: AssessmentAttempt[];
  assignments: TrainingAssignment[];
  progress: LearnerProgress[];
  leads: Lead[];
  activity: ActivityEvent[];
  /** userId → password. MOCK ONLY: a real backend stores a slow salted hash (e.g. Argon2/bcrypt), never the password. */
  credentials: Record<string, string>;
  /** Single-use links for invites (set password) and password resets. */
  authTokens: AuthToken[];
  /** Emails the mock "sent", so demos can open invite/reset links without a mail server. */
  outbox: OutboxEmail[];
}

export interface AuthToken {
  token: string;
  userId: string;
  purpose: "INVITE" | "RESET";
  expiresAt: string;
  usedAt?: string;
}

export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  link: string;
  createdAt: string;
}

export const MOCK_DB_VERSION = 3;

/** Public test stream (Big Buck Bunny, ~10 min) used until the client's videos are hosted. */
const SAMPLE_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const SAMPLE_DURATION = 635; // measured: 634.6 s

const PLACEHOLDER_RATIONALE =
  "Placeholder rationale. The approved explanation for this decision point will be supplied by The Continuum-Standard.";

function placeholderCheckpoint(
  id: string,
  videoId: string,
  timestampSec: number,
  sortOrder: number,
): DecisionCheckpoint {
  return {
    id,
    videoId,
    timestampSec,
    sortOrder,
    prompt: `[Sample decision point ${sortOrder}] What would you do next in this situation?`,
    options: ["A", "B", "C", "D"].map((letter) => ({
      id: `${id}-opt-${letter.toLowerCase()}`,
      label: `Response option ${letter} (placeholder)`,
      rationale:
        letter === "A"
          ? `Placeholder feedback for option ${letter}. Per-option feedback is optional (decision D5).`
          : undefined,
    })),
    generalRationale: PLACEHOLDER_RATIONALE,
  };
}

function placeholderAssessment(id: string, moduleId: string, count: number): KnowledgeAssessment {
  return {
    id,
    moduleId,
    passPercent: 80,
    maxAttempts: null,
    questions: Array.from({ length: count }, (_, i) => {
      const qid = `${id}-q${i + 1}`;
      return {
        id: qid,
        text: `[Sample question ${i + 1}] Which option is marked correct in this placeholder question?`,
        options: ["A", "B", "C", "D"].map((letter, j) => ({
          id: `${qid}-opt-${letter.toLowerCase()}`,
          label: j === i % 4 ? `Option ${letter} (correct in sample)` : `Option ${letter}`,
          isCorrect: j === i % 4,
        })),
        feedback: "Placeholder explanation. Client-approved feedback will replace this.",
      };
    }),
  };
}

export function createSeed(): MockDb {
  const facilities: Facility[] = [
    {
      id: "fac-harbor",
      name: "Harbor Light Recovery Center",
      contactName: "Dana Whitfield",
      contactEmail: "admin@harborlight.test",
      phone: "555-0101",
      isActive: true,
      createdAt: "2026-10-01T15:00:00Z",
    },
    {
      id: "fac-pinecrest",
      name: "Pinecrest Detox Clinic",
      contactName: "Sam Okafor",
      contactEmail: "admin@pinecrest.test",
      phone: "555-0102",
      isActive: true,
      createdAt: "2026-10-08T15:00:00Z",
    },
  ];

  const u = (
    id: string,
    role: User["role"],
    facilityId: string | null,
    name: string,
    email: string,
    jobTitle?: string,
    status: User["status"] = "ACTIVE",
  ): User => ({ id, role, facilityId, name, email, jobTitle, status, createdAt: "2026-10-10T15:00:00Z" });

  const users: User[] = [
    u("usr-super", "SUPER_ADMIN", null, "Platform Admin", "super@continuum.test", "Super Admin"),

    u("usr-h-admin", "FACILITY_ADMIN", "fac-harbor", "Dana Whitfield", "dana@harborlight.test", "Clinical Director"),
    u("usr-h-admin2", "FACILITY_ADMIN", "fac-harbor", "Leo Marsh", "leo@harborlight.test", "Training Coordinator"),
    u("usr-h-l1", "LEARNER", "fac-harbor", "Alex Rivera", "alex@harborlight.test", "Behavioral Health Tech"),
    u("usr-h-l2", "LEARNER", "fac-harbor", "Jordan Lee", "jordan@harborlight.test", "Nurse"),
    u("usr-h-l3", "LEARNER", "fac-harbor", "Priya Nair", "priya@harborlight.test", "Case Manager"),
    u("usr-h-l4", "LEARNER", "fac-harbor", "Chris Park", "chris@harborlight.test", "Behavioral Health Tech", "INVITED"),
    u("usr-h-l5", "LEARNER", "fac-harbor", "Morgan Blake", "morgan@harborlight.test", "Night Supervisor", "DEACTIVATED"),

    u("usr-p-admin", "FACILITY_ADMIN", "fac-pinecrest", "Sam Okafor", "sam@pinecrest.test", "Program Director"),
    u("usr-p-l1", "LEARNER", "fac-pinecrest", "Taylor Brooks", "taylor@pinecrest.test", "Detox Technician"),
    u("usr-p-l2", "LEARNER", "fac-pinecrest", "Riley Chen", "riley@pinecrest.test", "Nurse"),
    u("usr-p-l3", "LEARNER", "fac-pinecrest", "Casey Diaz", "casey@pinecrest.test", "Intake Coordinator"),
  ];

  const now = "2026-11-01T15:00:00Z";
  const modules: TrainingModule[] = [
    {
      id: "mod-intake",
      title: "De-escalation at Intake",
      description:
        "A sample scenario showing a tense conversation during admission. Practice choosing your response at key moments.",
      category: "De-escalation",
      learningObjectives: [
        "Placeholder objective 1 — supplied by client",
        "Placeholder objective 2 — supplied by client",
      ],
      thumbnailUrl: "/thumbnails/mod-intake.svg",
      estimatedMinutes: 12,
      status: "ACTIVE",
      isPlaceholder: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "mod-ama",
      title: "Responding to a Request to Leave",
      description:
        "A sample scenario where a patient asks to leave treatment early. Practice communication under pressure.",
      category: "Patient Communication",
      learningObjectives: ["Placeholder objective — supplied by client"],
      thumbnailUrl: "/thumbnails/mod-ama.svg",
      estimatedMinutes: 15,
      status: "ACTIVE",
      isPlaceholder: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "mod-boundaries",
      title: "Boundaries on the Night Shift",
      description: "Draft module — content still being prepared. Can't be assigned until it's active.",
      category: "Professional Boundaries",
      learningObjectives: ["Placeholder objective — supplied by client"],
      thumbnailUrl: "/thumbnails/mod-boundaries.svg",
      estimatedMinutes: 10,
      status: "DRAFT",
      isPlaceholder: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const videos: ScenarioVideo[] = modules.map((m) => ({
    id: `vid-${m.id}`,
    moduleId: m.id,
    sourceUrl: SAMPLE_HLS,
    posterUrl: m.thumbnailUrl,
    durationSec: SAMPLE_DURATION,
  }));

  const checkpoints: DecisionCheckpoint[] = [
    // The §7.1 proof-of-concept checkpoint at 00:30.
    placeholderCheckpoint("cp-intake-1", "vid-mod-intake", 30, 1),
    placeholderCheckpoint("cp-intake-2", "vid-mod-intake", 95, 2),
    placeholderCheckpoint("cp-ama-1", "vid-mod-ama", 45, 1),
    placeholderCheckpoint("cp-ama-2", "vid-mod-ama", 120, 2),
    placeholderCheckpoint("cp-ama-3", "vid-mod-ama", 200, 3),
    placeholderCheckpoint("cp-bound-1", "vid-mod-boundaries", 40, 1),
  ];

  const assessments: KnowledgeAssessment[] = [
    placeholderAssessment("asm-intake", "mod-intake", 5),
    placeholderAssessment("asm-ama", "mod-ama", 5),
    placeholderAssessment("asm-boundaries", "mod-boundaries", 3),
  ];

  const assign = (id: string, facilityId: string, userId: string, moduleId: string, by: string, at: string) =>
    ({ id, facilityId, userId, moduleId, assignedById: by, assignedAt: at }) satisfies TrainingAssignment;

  const assignments: TrainingAssignment[] = [
    assign("asg-1", "fac-harbor", "usr-h-l1", "mod-intake", "usr-h-admin", "2026-11-03T14:00:00Z"),
    assign("asg-2", "fac-harbor", "usr-h-l1", "mod-ama", "usr-h-admin", "2026-11-03T14:00:00Z"),
    assign("asg-3", "fac-harbor", "usr-h-l2", "mod-intake", "usr-h-admin", "2026-11-05T14:00:00Z"),
    assign("asg-4", "fac-harbor", "usr-h-l3", "mod-ama", "usr-h-admin2", "2026-11-06T14:00:00Z"),
    assign("asg-5", "fac-pinecrest", "usr-p-l1", "mod-intake", "usr-p-admin", "2026-11-07T14:00:00Z"),
    assign("asg-6", "fac-pinecrest", "usr-p-l2", "mod-intake", "usr-p-admin", "2026-11-07T14:00:00Z"),
  ];

  const progress: LearnerProgress[] = [
    {
      userId: "usr-h-l1",
      moduleId: "mod-ama",
      status: "COMPLETED",
      lastPositionSec: SAMPLE_DURATION,
      furthestSec: SAMPLE_DURATION,
      videoCompleted: true,
      updatedAt: "2026-11-10T16:20:00Z",
      completedAt: "2026-11-10T16:20:00Z",
    },
    {
      userId: "usr-h-l1",
      moduleId: "mod-intake",
      status: "IN_PROGRESS",
      lastPositionSec: 62,
      furthestSec: 62,
      videoCompleted: false,
      updatedAt: "2026-11-12T15:05:00Z",
    },
    {
      userId: "usr-p-l1",
      moduleId: "mod-intake",
      status: "COMPLETED",
      lastPositionSec: SAMPLE_DURATION,
      furthestSec: SAMPLE_DURATION,
      videoCompleted: true,
      updatedAt: "2026-11-11T18:00:00Z",
      completedAt: "2026-11-11T18:00:00Z",
    },
  ];

  const checkpointResponses: CheckpointResponse[] = [
    { id: "cr-1", userId: "usr-h-l1", checkpointId: "cp-intake-1", optionId: "cp-intake-1-opt-b", answeredAt: "2026-11-12T15:03:00Z" },
    { id: "cr-2", userId: "usr-h-l1", checkpointId: "cp-ama-1", optionId: "cp-ama-1-opt-a", answeredAt: "2026-11-10T16:01:00Z" },
    { id: "cr-3", userId: "usr-h-l1", checkpointId: "cp-ama-2", optionId: "cp-ama-2-opt-c", answeredAt: "2026-11-10T16:05:00Z" },
    { id: "cr-4", userId: "usr-h-l1", checkpointId: "cp-ama-3", optionId: "cp-ama-3-opt-b", answeredAt: "2026-11-10T16:09:00Z" },
    { id: "cr-5", userId: "usr-p-l1", checkpointId: "cp-intake-1", optionId: "cp-intake-1-opt-d", answeredAt: "2026-11-11T17:40:00Z" },
    { id: "cr-6", userId: "usr-p-l1", checkpointId: "cp-intake-2", optionId: "cp-intake-2-opt-a", answeredAt: "2026-11-11T17:45:00Z" },
  ];

  const attempts: AssessmentAttempt[] = [
    {
      id: "att-1",
      userId: "usr-h-l1",
      assessmentId: "asm-ama",
      answers: {},
      scorePercent: 80,
      passed: true,
      submittedAt: "2026-11-10T16:20:00Z",
    },
    {
      id: "att-2",
      userId: "usr-p-l1",
      assessmentId: "asm-intake",
      answers: {},
      scorePercent: 60,
      passed: false,
      submittedAt: "2026-11-11T17:55:00Z",
    },
    {
      id: "att-3",
      userId: "usr-p-l1",
      assessmentId: "asm-intake",
      answers: {},
      scorePercent: 100,
      passed: true,
      submittedAt: "2026-11-11T18:00:00Z",
    },
  ];

  const leads: Lead[] = [
    {
      id: "lead-1",
      name: "Jamie Ortiz",
      email: "jamie@sample-clinic.test",
      organization: "Sample Residential Program",
      role: "Clinical Director",
      message: "Interested in a demo for our residential staff.",
      createdAt: "2026-11-14T13:00:00Z",
    },
  ];

  const activity: ActivityEvent[] = [
    { id: "act-1", type: "FACILITY_CREATED", actorId: "usr-super", facilityId: "fac-harbor", message: "Facility Harbor Light Recovery Center created", createdAt: "2026-10-01T15:00:00Z" },
    { id: "act-2", type: "FACILITY_CREATED", actorId: "usr-super", facilityId: "fac-pinecrest", message: "Facility Pinecrest Detox Clinic created", createdAt: "2026-10-08T15:00:00Z" },
    { id: "act-3", type: "MODULE_COMPLETED", actorId: "usr-h-l1", facilityId: "fac-harbor", message: "Alex Rivera completed Responding to a Request to Leave", createdAt: "2026-11-10T16:20:00Z" },
    { id: "act-4", type: "MODULE_COMPLETED", actorId: "usr-p-l1", facilityId: "fac-pinecrest", message: "Taylor Brooks completed De-escalation at Intake", createdAt: "2026-11-11T18:00:00Z" },
  ];

  return {
    version: MOCK_DB_VERSION,
    facilities,
    users,
    modules,
    videos,
    checkpoints,
    checkpointResponses,
    assessments,
    attempts,
    assignments,
    progress,
    leads,
    activity,
    credentials: Object.fromEntries(users.filter((x) => x.status !== "INVITED").map((x) => [x.id, DEMO_PASSWORD])),
    authTokens: [
      // Chris Park was invited but hasn't set a password yet — open /set-password?token=demo-invite-chris
      { token: "demo-invite-chris", userId: "usr-h-l4", purpose: "INVITE", expiresAt: "2027-12-31T00:00:00Z" },
    ],
    outbox: [
      {
        id: "mail-1",
        to: "chris@harborlight.test",
        subject: "You're invited to The Continuum-Standard",
        link: "/set-password?token=demo-invite-chris",
        createdAt: "2026-11-12T14:00:00Z",
      },
    ],
  };
}
