"use client";

import { use } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button, ErrorState, Loading } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import { formatDateTime, matchLabel } from "@/lib/labels";
import type { AttendanceDTO, AttendanceRowDTO, MatchDTO } from "@/types/api";
import styles from "./planilla.module.css";

/** Printable match sheet ("planilla de juego"): both squads with room for signatures, plus blank lines for events. */
export default function MatchSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const match = useFetch<MatchDTO>(`/matches/${id}`);
  const attendance = useFetch<AttendanceDTO>(`/matches/${id}/attendance`);

  if (match.error) return <ErrorState message={match.error.message} onRetry={match.reload} />;
  if (attendance.error) return <ErrorState message={attendance.error.message} onRetry={attendance.reload} />;
  if (!match.data || !attendance.data) return <Loading />;

  const { data: current } = match;
  const rows = attendance.data.checkIns;
  const squad = (teamId: string) => rows.filter((row) => row.teamId === teamId).sort((a, b) => (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999));

  return (
    <article className={styles.sheet}>
      <div className={`${styles.toolbar} no-print`}>
        <Link href={`/matches/${id}?tab=attendance`} className="btn secondary">Volver al partido</Link>
        <Button icon={<Printer size={18} />} onClick={() => window.print()}>Imprimir o guardar como PDF</Button>
      </div>

      <header className={styles.header}>
        <h1>Planilla de juego</h1>
        <p className={styles.versus}>{current.homeTeamId.name} <span>vs</span> {current.awayTeamId.name}</p>
        <dl className={styles.meta}>
          <div><dt>Fecha y hora</dt><dd>{current.scheduledAt ? formatDateTime(current.scheduledAt) : "Sin programar"}</dd></div>
          <div><dt>Etapa</dt><dd>{matchLabel(current) || current.phaseId.name}</dd></div>
          <div><dt>Cancha</dt><dd>{current.venue || "—"}</dd></div>
          <div><dt>Árbitro</dt><dd>{current.refereeId?.fullName ?? "—"}</dd></div>
        </dl>
      </header>

      <div className={styles.squads}>
        {[current.homeTeamId, current.awayTeamId].map((team) => (
          <section key={team._id} aria-label={`Plantilla de ${team.name}`}>
            <h2>{team.name}</h2>
            <SquadTable rows={squad(team._id)} />
          </section>
        ))}
      </div>

      <section className={styles.events} aria-label="Eventos del partido">
        <h2>Eventos</h2>
        <table>
          <thead><tr><th>Min.</th><th>Equipo</th><th>Jugador (#)</th><th>Gol</th><th>Amarilla</th><th>Roja</th><th>Cambio</th></tr></thead>
          <tbody>
            {Array.from({ length: 10 }, (_, index) => (
              <tr key={index}>{Array.from({ length: 7 }, (_, cellIndex) => <td key={cellIndex} />)}</tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className={styles.result}>
        <span>Resultado final:</span>
        <b>{current.homeTeamId.name}</b> <i /> <b>—</b> <i /> <b>{current.awayTeamId.name}</b>
      </div>

      <div className={styles.signatures}>
        {["Árbitro", `Delegado ${current.homeTeamId.name}`, `Delegado ${current.awayTeamId.name}`].map((label) => (
          <div key={label}><span /><p>{label}</p></div>
        ))}
      </div>
      <p className={styles.observations}>Observaciones:</p>
    </article>
  );
}

function SquadTable({ rows }: { rows: AttendanceRowDTO[] }) {
  return (
    <table>
      <thead><tr><th>#</th><th>Jugador</th><th>Pres.</th><th>Firma</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row._id}>
            <td>{row.shirtNumber ?? ""}</td>
            <td>{row.playerId.fullName}</td>
            <td className={styles.check}>{row.status === "present" ? "✓" : row.status === "absent" ? "✗" : ""}</td>
            <td />
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={4}>Sin jugadores convocados</td></tr>}
      </tbody>
    </table>
  );
}
