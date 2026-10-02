"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button, EmptyState, Modal, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/client/push";
import { useRole } from "./RoleContext";

interface NotificationItem {
  _id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  readAt?: string;
  createdAt: string;
}

const POLL_MS = 60_000;

function ago(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

/** The bell in the top bar: what happened to the championships, teams and players the person follows. */
export function NotificationBell() {
  const { isSignedIn, signIn } = useRole();
  const [open, setOpen] = useState(false);
  const [loadedItems, setItems] = useState<NotificationItem[]>([]);
  const [loadedUnread, setUnread] = useState(0);
  // Nothing of the previous person shows once signed out.
  const items = isSignedIn ? loadedItems : [];
  const unread = isSignedIn ? loadedUnread : 0;

  // Look for news now, every minute, and whenever the app comes back to the front.
  useEffect(() => {
    if (!isSignedIn) return;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      http<{ data: NotificationItem[]; unread: number }>("/notifications?limit=30")
        .then((result) => {
          setItems(result.data);
          setUnread(result.unread);
        })
        .catch(() => undefined); // Offline or signed out meanwhile: keep what is shown.
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [isSignedIn]);

  // Opening the list is reading it: the badge clears, but the entries keep their "new" dot while it is open.
  useEffect(() => {
    if (!open || !isSignedIn || unread === 0) return;
    http("/notifications/read", { json: {} }).then(() => setUnread(0)).catch(() => undefined);
  }, [open, isSignedIn, unread]);

  return (
    <>
      <button
        className="icon-button topbar-search bell"
        aria-label={unread > 0 ? `Avisos, ${unread} sin leer` : "Avisos"}
        aria-haspopup="dialog"
        title="Avisos"
        onClick={() => setOpen(true)}
      >
        <Bell size={22} />
        {unread > 0 && <span className="bell-badge" aria-hidden>{unread > 9 ? "9+" : unread}</span>}
      </button>
      <Modal open={open} title="Avisos" onClose={() => setOpen(false)}>
        {!isSignedIn ? (
          <EmptyState
            icon={<BellOff size={28} />}
            title="Inicia sesión para recibir avisos"
            description="Sigue un torneo, un equipo o un jugador con la estrella y te avisaremos de sus partidos, goles y tarjetas."
            action={<Button onClick={signIn}>Iniciar sesión</Button>}
          />
        ) : (
          <div className="stack">
            {items.length === 0 ? (
              <EmptyState
                icon={<Bell size={28} />}
                title="Todavía no hay avisos"
                description="Sigue un torneo, un equipo o un jugador con la estrella (☆) y aquí verás sus partidos, goles y tarjetas."
              />
            ) : (
              <ul className="flush-list" aria-label="Avisos recientes">
                {items.map((item) => (
                  <li key={item._id}>
                    <Link href={item.url} className="list-row" onClick={() => setOpen(false)}>
                      <span className={`notification-dot${item.readAt ? " read" : ""}`} aria-hidden />
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="text-strong" style={{ display: "block" }}>
                          {!item.readAt && <span className="visually-hidden">Nuevo: </span>}
                          {item.title}
                        </span>
                        <span className="text-secondary text-small" style={{ display: "block" }}>{item.body}</span>
                        <span className="text-secondary text-small">{ago(item.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <PushSwitch />
          </div>
        )}
      </Modal>
    </>
  );
}

/** Turns pop-ups on or off for this device. */
function PushSwitch() {
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  if (state === null || state === "unsupported") return null;
  if (state === "unavailable") {
    return <p className="text-secondary text-small">Los avisos en el teléfono no están disponibles en esta versión; los verás aquí.</p>;
  }
  if (state === "denied") {
    return <p className="text-secondary text-small">Bloqueaste los avisos de este dispositivo. Para activarlos, permite las notificaciones en los ajustes del navegador o de la app.</p>;
  }

  async function toggle() {
    setBusy(true);
    try {
      if (state === "on") await disablePush();
      else await enablePush();
      setState(await getPushState());
    } catch (error) {
      toast.error(errorMessage(error));
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: "var(--space-md)" }}>
      <div className="row" style={{ gap: "var(--space-md)", alignItems: "center" }}>
        <BellRing size={20} aria-hidden />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="text-strong">Avisos en este dispositivo</div>
          <div className="text-secondary text-small">{state === "on" ? "Recibirás un aviso aunque la app esté cerrada." : "Recibe un aviso en el teléfono aunque la app esté cerrada."}</div>
        </div>
        <Button size="small" variant={state === "on" ? "secondary" : "primary"} loading={busy} onClick={toggle}>
          {state === "on" ? "Desactivar" : "Activar"}
        </Button>
      </div>
    </div>
  );
}
