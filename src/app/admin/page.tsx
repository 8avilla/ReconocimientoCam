"use client";

import { useState, type ReactNode } from "react";
import { History, ScrollText, Settings, ShieldCheck, Users } from "lucide-react";
import { RolesManager } from "@/components/admin/RolesManager";
import { SystemSettingsManager } from "@/components/admin/SystemSettingsManager";
import { UsersManager } from "@/components/admin/UsersManager";
import { Avatar, Badge, Button, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import type { AuditLogDTO, Paginated } from "@/types/api";

type Tab = "activity" | "users" | "roles" | "settings";

/** Administration: activity log, users, roles and system-wide configuration. Only the admin role reaches this screen. */
export default function AdminPage() {
  const [tab, setTab] = useStoredState<Tab>("super-torneos:admin:tab", "activity", (value) => ["activity", "users", "roles", "settings"].includes(value));

  const totalUsers = useFetch<Paginated<unknown>>("/users?limit=1");
  const totalRoles = useFetch<Paginated<unknown>>("/roles?limit=1");

  const tabs: { id: Tab; label: string; icon: ReactNode; count?: number }[] = [
    { id: "activity", label: "Actividad", icon: <ScrollText size={16} aria-hidden /> },
    { id: "users", label: "Usuarios", icon: <Users size={16} aria-hidden />, count: totalUsers.data?.meta.total },
    { id: "roles", label: "Roles", icon: <ShieldCheck size={16} aria-hidden />, count: totalRoles.data?.meta.total },
    { id: "settings", label: "Configuración", icon: <Settings size={16} aria-hidden /> },
  ];

  return (
    <>
      <PageHeader title="Administración" description="Usuarios, roles, configuración del sistema y el registro de actividad de toda la app." />

      <div className="tabs-line" role="tablist" aria-label="Secciones de administración">
        {tabs.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={`tab-line${tab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            <span className="row" style={{ gap: 6, justifyContent: "center" }}>
              {item.icon} {item.label}
              {item.count !== undefined && <span className="filter-chip-badge">{item.count}</span>}
            </span>
          </button>
        ))}
      </div>

      {tab === "activity" && <ActivityLog />}
      {tab === "users" && <UsersManager />}
      {tab === "roles" && <RolesManager />}
      {tab === "settings" && <SystemSettingsManager />}
    </>
  );
}

const PAGE_SIZE = 30;
const ACTION_LABEL: Record<string, string> = {
  create: "Creó",
  update: "Modificó",
  delete: "Eliminó",
  call_up_change: "Convocatoria",
  check_in: "Asistencia",
  face_enroll: "Rostro registrado",
  face_remove: "Rostro eliminado",
  void: "Anuló",
  transition: "Cambio de estado",
  lift: "Levantó",
  pay: "Pago",
};
/** Only these three get their own quick filter; anything else falls under "Todos". */
const ACTION_FILTERS: { id: "" | "create" | "update" | "delete"; label: string }[] = [
  { id: "", label: "Todos" },
  { id: "create", label: "Creó" },
  { id: "update", label: "Modificó" },
  { id: "delete", label: "Eliminó" },
];
const ACTION_TONE: Record<string, "success" | "info" | "error" | "neutral"> = { create: "success", update: "info", delete: "error" };

function ActivityLog() {
  const [pages, setPages] = useState(1);
  const [action, setAction] = useState<"" | "create" | "update" | "delete">("");
  const { data, error, loading, reload } = useFetch<Paginated<AuditLogDTO>>(`/audit-logs?limit=${PAGE_SIZE * pages}${action ? `&action=${action}` : ""}`);
  const logs = data?.data ?? [];
  const hasMore = data ? logs.length < data.meta.total : false;

  return (
    <>
      <div className="phase-chips" role="tablist" aria-label="Filtrar por tipo de acción">
        {ACTION_FILTERS.map((filter) => (
          <button
            key={filter.id || "all"}
            role="tab"
            aria-selected={action === filter.id}
            className={`filter-chip${action === filter.id ? " active" : ""}`}
            onClick={() => {
              setAction(filter.id);
              setPages(1);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : logs.length === 0 ? (
        <div className="card"><EmptyState icon={<History size={28} />} title="Sin actividad" description="Aquí aparecerán los cambios que se hagan en la app." /></div>
      ) : (
        <>
          <div className="flush-list">
            <h2 className="band band-muted band-small">Actividad reciente ({data?.meta.total ?? logs.length})</h2>
            {logs.map((log) => {
              const tone = ACTION_TONE[log.action] ?? "neutral";
              return (
                <div key={log._id} className="list-row" style={{ alignItems: "flex-start" }}>
                  <Avatar name={log.actorName} size={36} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="champ-caption truncate row" style={{ gap: 6 }}>
                      {log.actorName} · <Badge tone={tone}>{ACTION_LABEL[log.action] ?? log.action}</Badge> · {log.entityType}
                    </div>
                    <div className="text-strong">{log.summary}</div>
                  </div>
                  <span className="text-secondary text-small" style={{ textAlign: "right", flexShrink: 0 }}>
                    {new Date(log.createdAt).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                    <br />
                    {new Date(log.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </span>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-lg)" }}>
              <Button variant="secondary" loading={loading} onClick={() => setPages((current) => current + 1)}>Mostrar más</Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
