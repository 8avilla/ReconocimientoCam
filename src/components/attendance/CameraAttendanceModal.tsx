"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, HelpCircle, Info, OctagonAlert, UserRoundX } from "lucide-react";
import { Avatar, Loading, Modal } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import type { IdentifiedPlayerDTO, IdentifyDTO } from "@/types/api";

const FaceCapture = dynamic(() => import("@/components/camera/FaceCapture"), { ssr: false, loading: () => <Loading variant="spinner" /> });

interface Props {
  open: boolean;
  matchId: string;
  present: number;
  called: number;
  onClose: () => void;
  /** Reload the attendance after players were registered. */
  onChanged: () => void;
}

type Banner =
  | { kind: "identified" | "already_present" | "suspended"; player: IdentifiedPlayerDTO }
  | { kind: "uncertain"; candidates: IdentifiedPlayerDTO[] }
  | { kind: "unknown" | "error"; message: string };

const BANNER_MS = 4000;
const SETTLE_MS = 2500;

/** Attendance by camera: keep the camera on the players; whoever is recognized is registered as present. */
export function CameraAttendanceModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Asistencia por cámara" onClose={props.onClose} wide>
      <Scanner {...props} />
    </Modal>
  );
}

function Scanner({ matchId, present, called, onChanged }: Omit<Props, "open" | "onClose">) {
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [recent, setRecent] = useState<{ id: string; name: string; team: string; shirt: number | null }[]>([]);
  const [withoutFace, setWithoutFace] = useState(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (next: Banner) => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setBanner(next);
    // "Unsure" stays until the operator answers; the rest fade back to the scanning state.
    if (next.kind !== "uncertain") clearTimer.current = setTimeout(() => setBanner(null), BANNER_MS);
  };

  async function handleFrame(image: string) {
    setBusy(true);
    let settled = false;
    try {
      const result = await http<IdentifyDTO>(`/matches/${matchId}/identify`, { json: { image } });
      setWithoutFace(result.pendingWithoutFace);
      // Someone who was just recognized may keep standing in front of the camera: pause before looking again.
      settled = result.status === "identified" || result.status === "already_present" || result.status === "suspended";
      switch (result.status) {
        case "identified":
          if (result.player) {
            const player = result.player;
            show({ kind: "identified", player });
            setRecent((list) => [{ id: player.playerId, name: player.fullName, team: player.teamName, shirt: player.shirtNumber }, ...list.filter((item) => item.id !== player.playerId)].slice(0, 5));
            navigator.vibrate?.(80);
            onChanged();
          }
          break;
        case "already_present":
        case "suspended":
          if (result.player) show({ kind: result.status, player: result.player });
          break;
        case "uncertain":
          show({ kind: "uncertain", candidates: result.candidates ?? [] });
          break;
        case "unknown":
          show({ kind: "unknown", message: result.message ?? "No reconocido: usa «Verificar» o «Manual» en la lista." });
          break;
        default:
          break; // no_face: keep scanning silently
      }
    } catch (error) {
      show({ kind: "error", message: errorMessage(error) });
    } finally {
      if (settled) setTimeout(() => setBusy(false), SETTLE_MS);
      else setBusy(false);
    }
  }

  async function confirm(candidate: IdentifiedPlayerDTO) {
    setBusy(true);
    try {
      await http(`/matches/${matchId}/check-ins`, { json: { playerId: candidate.playerId, status: "present", method: "manual", reason: "Confirmado por el operador desde la cámara" } });
      show({ kind: "identified", player: candidate });
      setRecent((list) => [{ id: candidate.playerId, name: candidate.fullName, team: candidate.teamName, shirt: candidate.shirtNumber }, ...list.filter((item) => item.id !== candidate.playerId)].slice(0, 5));
      onChanged();
    } catch (error) {
      show({ kind: "error", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row-between">
        <span className="text-strong">{present} de {called} presentes</span>
        <span className="text-secondary text-small">{busy ? "Comparando…" : "Buscando jugadores…"}</span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={present} aria-valuemin={0} aria-valuemax={called} aria-label="Asistencia">
        <span style={{ width: `${called ? (present / called) * 100 : 0}%` }} />
      </div>

      <FaceCapture auto busy={busy || banner?.kind === "uncertain"} onCapture={(image) => void handleFrame(image)} />

      <div className={`scan-banner ${banner?.kind ?? "idle"}`} role="status" aria-live="polite">
        {!banner && <><Info size={20} aria-hidden /> Apunta la cámara al rostro de cada jugador, de a uno.</>}
        {banner && "player" in banner && (
          <>
            <Avatar src={banner.player.photoUrl} name={banner.player.fullName} size={48} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="text-strong truncate">{banner.player.fullName}</div>
              <div className="text-small">{banner.player.teamName}{banner.player.shirtNumber != null && ` · #${banner.player.shirtNumber}`}</div>
            </div>
            <span className="scan-label">
              {banner.kind === "identified" && <><CheckCircle2 size={18} aria-hidden /> Presente</>}
              {banner.kind === "already_present" && <><Info size={18} aria-hidden /> Ya estaba</>}
              {banner.kind === "suspended" && <><OctagonAlert size={18} aria-hidden /> Suspendido</>}
            </span>
          </>
        )}
        {banner?.kind === "uncertain" && (
          <div className="stack-sm grow">
            <div className="row" style={{ gap: 8 }}><HelpCircle size={18} aria-hidden /> <strong>¿Quién es?</strong></div>
            {banner.candidates.map((candidate) => (
              <button key={candidate.playerId} className="btn secondary block" onClick={() => void confirm(candidate)} disabled={busy}>
                {candidate.fullName} · {candidate.teamName}{candidate.shirtNumber != null && ` · #${candidate.shirtNumber}`}
              </button>
            ))}
            <button className="btn ghost small" onClick={() => setBanner(null)}>Ninguno</button>
          </div>
        )}
        {(banner?.kind === "unknown" || banner?.kind === "error") && <><UserRoundX size={20} aria-hidden /> <span>{banner.message}</span></>}
      </div>

      {withoutFace > 0 && (
        <p className="text-secondary text-small">
          {withoutFace} {withoutFace === 1 ? "jugador pendiente no tiene" : "jugadores pendientes no tienen"} rostro registrado: usa «Verificar» o «Manual» en la lista.
        </p>
      )}

      {recent.length > 0 && (
        <section aria-label="Registrados ahora">
          <h3 style={{ marginBottom: "var(--space-sm)" }}>Registrados ahora</h3>
          <ul style={{ listStyle: "none" }} className="stack-sm">
            {recent.map((item) => (
              <li key={item.id} className="row" style={{ gap: 8 }}>
                <CheckCircle2 size={16} color="var(--color-success)" aria-hidden />
                <span className="truncate"><strong>{item.name}</strong> <span className="text-secondary">· {item.team}{item.shirt != null && ` · #${item.shirt}`}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
