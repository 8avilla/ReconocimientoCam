import { Badge } from "@/components/ui";
import type { MatchStatus } from "@/lib/constants";
import { MATCH_STATUS_LABEL } from "@/lib/labels";

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const { label, tone } = MATCH_STATUS_LABEL[status];
  return <Badge tone={tone}>{label}</Badge>;
}
