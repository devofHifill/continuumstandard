import { Badge } from "@/components/ui";
import type { ModuleStatus } from "@/lib/types";

const LABEL: Record<ModuleStatus, string> = { ACTIVE: "Published", DRAFT: "Draft", DISABLED: "Disabled" };
const TONE = { ACTIVE: "success", DRAFT: "warning", DISABLED: "neutral" } as const;

export function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
