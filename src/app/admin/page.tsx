"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Avatar, Button, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import type { AuditLogDTO, Paginated } from "@/types/api";

const PAGE_SIZE = 30;
const ACTION_LABEL: Record<string, string> = { create: "Creó", update: "Modificó", delete: "Eliminó" };

/** Administration: app-wide activity log (who did what and when). Only the admin role reaches this screen. */
export default function AdminPage() {
  const [pages, setPages] = useState(1);
  const { data, error, loading, reload } = useFetch<Paginated<AuditLogDTO>>(`/audit-logs?limit=${PAGE_SIZE * pages}`);
  const logs = data?.data ?? [];
  const hasMore = data ? logs.length < data.meta.total : false;

  return (
    <>
      <PageHeader title="Administración" description="Registro de actividad de toda la app: quién hizo qué y cuándo." />
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
      )}
    </>
  );
}
