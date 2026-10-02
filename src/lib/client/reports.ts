import { MATCH_STATUS_LABEL } from "@/lib/labels";
import type { AttendanceRowDTO, MatchDTO, PlayerStatDTO, StandingsRowDTO } from "@/types/api";

type Cell = string | number | null;
export interface Report {
  headers: string[];
  rows: Cell[][];
}

const CHECK_IN_LABEL = { present: "Presente", absent: "Ausente", pending: "Pendiente" } as const;
const METHOD_LABEL = { qr: "QR", face: "Reconocimiento facial", manual: "Manual" } as const;
const VERIFICATION_LABEL = { verified: "Verificado", review: "Revisar", mismatch: "No coincide" } as const;

const time = (value?: string) => (value ? new Date(value).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : "");
const dateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

/** Attendance of one match, both squads: who was called up, who came and how it was confirmed. */
export function attendanceReport(match: Pick<MatchDTO, "homeTeamId" | "awayTeamId">, rows: AttendanceRowDTO[]): Report {
  const teamName = (teamId: string) => (teamId === match.homeTeamId._id ? match.homeTeamId.name : match.awayTeamId.name);
  const sorted = [...rows].sort(
    (a, b) => Number(b.teamId === match.homeTeamId._id) - Number(a.teamId === match.homeTeamId._id) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999)
  );
  return {
    headers: ["Equipo", "Número", "Jugador", "Asistencia", "Método", "Hora", "Verificación", "Registrado por", "Motivo manual"],
    rows: sorted.map((row) => [
      teamName(row.teamId),
      row.shirtNumber,
      row.playerId.fullName,
      CHECK_IN_LABEL[row.status],
      row.method ? METHOD_LABEL[row.method] : "",
      time(row.checkedInAt),
      row.verificationId ? VERIFICATION_LABEL[row.verificationId.result] : "Sin verificar",
      row.operatorName ?? "",
      row.manualReason ?? "",
    ]),
  };
}

/** The table of a phase; a phase with groups gets a leading "Grupo" column. */
export function standingsReport(tables: { group: string | null; rows: StandingsRowDTO[] }[]): Report {
  const grouped = tables.some((table) => table.group);
  const columns = ["Posición", "Equipo", "PJ", "G", "E", "P", "GF", "GC", "DG", "Puntos"];
  return {
    headers: grouped ? ["Grupo", ...columns] : columns,
    rows: tables.flatMap((table) =>
      table.rows.map((row) => [
        ...(grouped ? [table.group ?? ""] : []),
        row.position, row.name, row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst, row.goalDifference, row.points,
      ])
    ),
  };
}

/** A ranking of players (scorers, assists, cards): one column for the stat that sorts it. */
export function rankingReport(rows: PlayerStatDTO[], statLabel: string, value: (row: PlayerStatDTO) => number): Report {
  return {
    headers: ["Posición", "Jugador", "Equipo", statLabel],
    rows: rows.map((row, index) => [index + 1, row.fullName, row.teamName, value(row)]),
  };
}

/** The fixture list as shown: matchday, teams, date, venue, status and score when played. */
export function calendarReport(matches: MatchDTO[]): Report {
  return {
    headers: ["Etapa", "Fecha", "Local", "Visitante", "Fecha y hora", "Cancha", "Árbitro", "Estado", "Marcador"],
    rows: matches.map((match) => {
      const played = match.status === "finished" || match.status === "walkover" || match.status === "live";
      return [
        [match.phaseId?.name, match.group].filter(Boolean).join(" · "),
        match.matchdayId?.name ?? "",
        match.homeTeamId.name,
        match.awayTeamId.name,
        dateTime(match.scheduledAt),
        match.venue ?? "",
        match.refereeId?.fullName ?? "",
        MATCH_STATUS_LABEL[match.status].label,
        played ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}` : "",
      ];
    }),
  };
}
