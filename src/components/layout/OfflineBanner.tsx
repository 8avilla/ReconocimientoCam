"use client";

import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { getOutbox, useOutbox, useOutboxSync } from "@/lib/client/useOutbox";
import { useRole } from "./RoleContext";

/**
 * Connection status for whoever registers attendance: says when the device is offline, how many changes wait to
 * be synced, and lists the ones the server refused. Mounted once in the app shell, which also keeps the sync running.
 */
export function OfflineBanner() {
  const { online } = useOutboxSync();
  const { pending, rejected, needsSignIn, flushing } = useOutbox();
  const { signIn } = useRole();

  if (online && pending.length === 0 && rejected.length === 0) return null;
  const waiting = pending.length;
  const plural = waiting === 1 ? "cambio" : "cambios";

  return (
    <div className="stack-sm" style={{ marginBottom: "var(--space-lg)" }} role="status" aria-live="polite" data-print-hide>
      {(!online || waiting > 0) && (
        <div className="card" style={{ display: "flex", gap: "var(--space-md)", alignItems: "center", padding: "var(--space-md)", background: online ? "var(--color-warning-bg, #fffbeb)" : "var(--color-background)" }}>
          {online ? <RefreshCw size={20} aria-hidden /> : <CloudOff size={20} aria-hidden />}
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="text-strong">
              {!online ? "Sin conexión" : needsSignIn ? "Inicia sesión para sincronizar" : flushing ? "Sincronizando…" : "Cambios por sincronizar"}
            </div>
            <div className="text-secondary text-small">
              {!online
                ? waiting > 0
                  ? `${waiting} ${plural} guardado${waiting === 1 ? "" : "s"} en este dispositivo. Se envían solos al volver la conexión.`
                  : "Puedes seguir marcando asistencia: se guarda en este dispositivo y se envía al volver la conexión."
                : `${waiting} ${plural} pendiente${waiting === 1 ? "" : "s"} de enviar.`}
            </div>
          </div>
          {online && needsSignIn && <Button size="small" onClick={signIn}>Iniciar sesión</Button>}
          {online && !needsSignIn && !flushing && <Button size="small" variant="secondary" onClick={() => void getOutbox().flush()}>Sincronizar</Button>}
        </div>
      )}
      {rejected.length > 0 && (
        <div className="card" style={{ padding: "var(--space-md)", borderColor: "var(--color-error)" }}>
          <div className="row" style={{ gap: "var(--space-sm)" }}>
            <TriangleAlert size={18} aria-hidden style={{ color: "var(--color-error)" }} />
            <span className="text-strong grow">{rejected.length === 1 ? "Un cambio no se pudo aplicar" : `${rejected.length} cambios no se pudieron aplicar`}</span>
            <Button size="small" variant="ghost" onClick={() => getOutbox().dismissRejected()}>Entendido</Button>
          </div>
          <ul className="text-secondary text-small" style={{ marginTop: "var(--space-xs)", paddingLeft: 20, listStyle: "disc" }}>
            {rejected.map(({ op, message }) => (
              <li key={op.id}>{message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
