import type { ChampionshipFormat, ChampionshipStatus, MatchEventType, MatchPeriod, MatchStatus, PhaseType, RegistrationStatus, SuspensionReason, SuspensionStatus } from "@/lib/constants";

export type Tone = "success" | "warning" | "error" | "info" | "neutral";

export const CHAMPIONSHIP_STATUS_LABEL: Record<ChampionshipStatus, { label: string; tone: Tone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  registration_open: { label: "Inscripciones abiertas", tone: "info" },
  in_progress: { label: "En curso", tone: "success" },
  finished: { label: "Finalizado", tone: "neutral" },
};

export const CHAMPIONSHIP_FORMAT_LABEL: Record<ChampionshipFormat, string> = {
  league: "Liga",
  groups: "Grupos",
  knockout: "Eliminatoria",
  mixed: "Mixto",
};

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, { label: string; tone: Tone }> = {
  active: { label: "Activo", tone: "success" },
  pending: { label: "Pendiente", tone: "warning" },
  suspended: { label: "Suspendido", tone: "error" },
  inactive: { label: "Inactivo", tone: "neutral" },
};

export const MATCH_STATUS_LABEL: Record<MatchStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Por jugar", tone: "info" },
  live: { label: "En curso", tone: "success" },
  finished: { label: "Finalizado", tone: "neutral" },
  postponed: { label: "Aplazado", tone: "warning" },
  suspended: { label: "Suspendido", tone: "error" },
  walkover: { label: "W.O.", tone: "neutral" },
};

export const MATCH_PERIOD_LABEL: Record<MatchPeriod, string> = {
  not_started: "Sin iniciar",
  first_half: "1.er tiempo",
  half_time: "Medio tiempo",
  second_half: "2.º tiempo",
  finished: "Finalizado",
};

export const EVENT_TYPE_LABEL: Record<MatchEventType, string> = {
  goal: "Gol",
  own_goal: "Autogol",
  penalty_goal: "Gol de penal",
  penalty_missed: "Penal fallado",
  yellow_card: "Amarilla",
  red_card: "Roja",
  substitution: "Cambio",
  incident: "Incidente",
};

export const SUSPENSION_REASON_LABEL: Record<SuspensionReason, string> = {
  red_card: "Tarjeta roja",
  yellow_accumulation: "Amarillas acumuladas",
  manual: "Manual",
};

export const SUSPENSION_STATUS_LABEL: Record<SuspensionStatus, { label: string; tone: Tone }> = {
  active: { label: "Vigente", tone: "error" },
  served: { label: "Cumplida", tone: "neutral" },
  lifted: { label: "Levantada", tone: "info" },
};

export const PHASE_TYPE_LABEL: Record<PhaseType, string> = {
  league: "Todos contra todos",
  groups: "Grupos",
  knockout: "Eliminatoria",
};

export const LEGS_LABEL: Record<1 | 2, string> = {
  1: "Partido único",
  2: "Ida y vuelta",
};

/** "Fase de grupos · Grupo A · Fecha 2": only the parts the match has. */
export function matchLabel(match: { phaseId?: { name: string } | string | null; group?: string; matchdayId?: { name: string } | string | null }): string {
  const phase = match.phaseId && typeof match.phaseId === "object" ? match.phaseId.name : "";
  const matchday = match.matchdayId && typeof match.matchdayId === "object" ? match.matchdayId.name : "";
  return [phase, match.group, matchday].filter(Boolean).join(" · ");
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "Sin fecha ni hora";
  return new Date(value).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Colombian pesos, e.g. "$ 10.000". */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export const FINE_STATUS_LABEL: Record<"pending" | "partial" | "paid" | "waived" | "cancelled", { label: string; tone: Tone }> = {
  pending: { label: "Por cobrar", tone: "warning" },
  partial: { label: "Pago parcial", tone: "info" },
  paid: { label: "Pagada", tone: "success" },
  waived: { label: "Perdonada", tone: "neutral" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

export const PAYMENT_METHOD_LABEL = { cash: "Efectivo", transfer: "Transferencia", nequi: "Nequi", daviplata: "Daviplata", other: "Otro" } as const;
