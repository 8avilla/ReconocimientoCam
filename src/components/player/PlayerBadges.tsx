import { Camera, CameraOff } from "lucide-react";
import { Badge } from "@/components/ui";
import type { RegistrationStatus } from "@/lib/constants";
import { REGISTRATION_STATUS_LABEL } from "@/lib/labels";

export function RegistrationBadge({ status }: { status: RegistrationStatus }) {
  const { label, tone } = REGISTRATION_STATUS_LABEL[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function FaceBadge({ hasFace }: { hasFace: boolean }) {
  return hasFace ? (
    <Badge tone="success" icon={<Camera size={12} aria-hidden />}>Rostro registrado</Badge>
  ) : (
    <Badge tone="warning" icon={<CameraOff size={12} aria-hidden />}>Sin rostro</Badge>
  );
}
