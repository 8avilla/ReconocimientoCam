"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { RolesManager } from "@/components/admin/RolesManager";
import { UsersManager } from "@/components/admin/UsersManager";
import { Avatar, Button, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import type { AuditLogDTO, Paginated } from "@/types/api";

type Tab = "activity" | "users" | "roles";
const TABS: { id: Tab; label: string }[] = [
  { id: "activity", label: "Actividad" },
  { id: "users", label: "Usuarios" },
  { id: "roles", label: "Roles" },
];

/** Administration: activity log, users and roles. Only the admin role reaches this screen. */
export default function AdminPage() {
  const [tab, setTab] = useStoredState<Tab>("super-torneos:admin:tab", "activity", (value) => TABS.some((item) => item.id === value));

  return (
    <>
      <PageHeader title="Administración" description="Usuarios, roles y el registro de actividad de toda la app." />

      <div className="tabs-line" role="tablist" aria-label="Secciones de administración">
        {TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={`tab-line${tab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "activity" && <ActivityLog />}
      {tab === "users" && <UsersManager />}
      {tab === "roles" && <RolesManager />}
    </>
  );
}

const PAGE_SIZE = 30;
const ACTION_LABEL: Record<string, string> = { create: "Creó", update: "Modificó", delete: "Eliminó" };

function ActivityLog() {
  const [pages, setPages] = useState(1);
  const { data, error, loading, reload } = useFetch<Paginated<AuditLogDTO>>(`/audit-logs?limit=${PAGE_SIZE * pages}`);
  const logs = data?.data ?? [];
  const hasMore = data ? logs.length < data.meta.total : false;

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (logs.length === 0) {
    return <div className="card"><EmptyState icon={<History size={28} />} title="Sin actividad" description="Aquí aparecerán los cambios que se hagan en la app." /></div>;
  }

  return (
    <>
      <div className="flush-list">
        <h2 className="band band-muted band-small">Actividad reciente ({data?.meta.total ?? logs.length})</h2>
        {logs.map((log) => (
          <div key={log._id} className="list-row" style={{ alignItems: "flex-start" }}>
            <Avatar name={log.actorName} size={36} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="champ-caption truncate">{log.actorName} · {ACTION_LABEL[log.action] ?? log.action} · {log.entityType}</div>
              <div className="text-strong">{log.summary}</div>
            </div>
            <span className="text-secondary text-small" style={{ textAlign: "right", flexShrink: 0 }}>
              {new Date(log.createdAt).toLocaleDateString("es", { day: "2-digit", month: "short" })}
              <br />
              {new Date(log.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-lg)" }}>
          <Button variant="secondary" loading={loading} onClick={() => setPages((current) => current + 1)}>Mostrar más</Button>
        </div>
      )}
    </>
  );
}
