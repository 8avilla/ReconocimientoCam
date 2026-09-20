import { CheckCircle2, Clock, ShieldAlert, ShieldCheck, ShieldQuestion, UserX } from "lucide-react";
import { Badge } from "@/components/ui";
import type { AttendanceRowDTO, CheckInStatusDTO } from "@/types/api";

export function CheckInBadge({ status }: { status: CheckInStatusDTO }) {
  if (status === "present") return <Badge tone="success" icon={<CheckCircle2 size={12} aria-hidden />}>Presente</Badge>;
  if (status === "absent") return <Badge tone="neutral" icon={<UserX size={12} aria-hidden />}>Ausente</Badge>;
  return <Badge tone="warning" icon={<Clock size={12} aria-hidden />}>Pendiente</Badge>;
}

/** Latest identity verification of a check-in; state is always icon + text, never color alone. */
export function VerificationBadge({ verification }: { verification: AttendanceRowDTO["verificationId"] }) {
  if (!verification) return <Badge tone="neutral" icon={<ShieldQuestion size={12} aria-hidden />}>Sin verificar</Badge>;
  if (verification.result === "verified") {
    return <Badge tone="success" icon={<ShieldCheck size={12} aria-hidden />}>{verification.method === "manual_review" ? "Verificado (manual)" : "Verificado"}</Badge>;
  }
  if (verification.result === "review") return <Badge tone="warning" icon={<ShieldAlert size={12} aria-hidden />}>Revisar</Badge>;
  return <Badge tone="error" icon={<ShieldAlert size={12} aria-hidden />}>No coincide</Badge>;
}
