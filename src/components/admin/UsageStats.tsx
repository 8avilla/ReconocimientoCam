"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { EmptyState, ErrorState, Loading } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";

interface UsageSummary {
  days: number;
  views: { route: string; count: number }[];
  viewsByRole: Record<string, number>;
  actions: { entityType: string; action: string; count: number }[];
}

const RANGES = [7, 30, 90];
const SCREEN_LABEL: Record<string, string> = {
  "/": "Torneos",
  "/c/:id": "Resumen del torneo",
  "/c/:id/partidos": "Partidos",
  "/c/:id/clasificacion": "Clasificación",
  "/c/:id/equipos": "Equipos",
  "/c/:id/jugadores": "Jugadores",
  "/c/:id/jugadores/nuevo": "Registro de jugador",
  "/c/:id/sanciones": "Sanciones",
  "/c/:id/gestionar": "Configuración",
  "/matches/:id": "Detalle de partido",
  "/teams/:id": "Detalle de equipo",
  "/phases/:id": "Llaves de fase",
  "/admin": "Administración",
};
const ACTION_LABEL: Record<string, string> = {
  create: "Crear", update: "Modificar", delete: "Eliminar", call_up_change: "Convocatoria", check_in: "Asistencia",
  face_enroll: "Registrar rostro", face_remove: "Quitar rostro", void: "Anular", transition: "Cambiar estado", lift: "Levantar", pay: "Pago",
};
const ENTITY_LABEL: Record<string, string> = {
  championship: "torneo", team: "equipo", player: "jugador", registration: "inscripción", match: "partido", call_up: "convocatoria",
  check_in: "asistencia", verification: "verificación", match_event: "evento", suspension: "suspensión", phase: "fase", tie: "cruce",
  matchday: "fecha", fine: "multa", referee: "árbitro", venue: "sitio", user: "usuario", role: "rol", system_settings: "ajustes",
};
const ROLE_LABEL: Record<string, string> = { visitor: "Visitantes", organizer: "Organizadores", admin: "Administradores" };

/** What the app is used for: most opened screens (by role) and most frequent changes, to decide what to make faster. */
export function UsageStats() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useFetch<UsageSummary>(`/usage/summary?days=${days}`);

  return (
    <>
      <div className="phase-chips" role="tablist" aria-label="Período">
        {RANGES.map((range) => (
          <button key={range} role="tab" aria-selected={days === range} className={`filter-chip${days === range ? " active" : ""}`} onClick={() => setDays(range)}>
            Últimos {range} días
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : !data || (data.views.length === 0 && data.actions.length === 0) ? (
        <div className="card"><EmptyState icon={<BarChart3 size={28} />} title="Aún no hay datos de uso" description="Las pantallas abiertas y los cambios aparecerán aquí a medida que se use la app." /></div>
      ) : (
        <div className="stack" style={{ gap: "var(--space-xl)" }}>
          {Object.keys(data.viewsByRole).length > 0 && (
            <p className="text-secondary">
              Vistas por tipo de usuario: {Object.entries(data.viewsByRole).map(([role, count]) => `${ROLE_LABEL[role] ?? role} ${count}`).join(" · ")}
            </p>
          )}
          <Ranking title="Pantallas más abiertas" rows={data.views.map((row) => ({ label: SCREEN_LABEL[row.route] ?? row.route, count: row.count }))} />
          <Ranking title="Cambios más frecuentes" rows={data.actions.map((row) => ({ label: `${ACTION_LABEL[row.action] ?? row.action} ${ENTITY_LABEL[row.entityType] ?? row.entityType}`, count: row.count }))} />
        </div>
      )}
    </>
  );
}

function Ranking({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="flush-list" aria-label={title}>
      <h2 className="band band-muted band-small">{title}</h2>
      {rows.length === 0 ? (
        <div className="list-row text-secondary">Sin datos todavía.</div>
      ) : (
        rows.map((row) => (
          <div key={row.label} className="list-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
            <div className="row-between"><span className="text-strong">{row.label}</span><span className="text-secondary">{row.count}</span></div>
            <div className="manage-progress-track"><div className="manage-progress-bar" style={{ width: `${(row.count / max) * 100}%` }} /></div>
          </div>
        ))
      )}
    </section>
  );
}
