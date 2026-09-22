"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Check, CheckCircle2, ShieldAlert } from "lucide-react";
import { Avatar, Button, Input, Loading, Modal, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { QR_VERIFICATION_ENABLED } from "@/lib/features";
import { QrScanner } from "./QrScanner";
import type { LookupDTO, VerificationOutcomeDTO } from "@/types/api";

const FaceCapture = dynamic(() => import("@/components/camera/FaceCapture"), { ssr: false, loading: () => <Loading /> });

type Stage = "scan" | "lookup" | "face" | "verifying" | "result" | "confirmed";

const STEPS = [QR_VERIFICATION_ENABLED ? "Escanear QR" : "Identificar", "Capturar rostro", "Validar", "Confirmar"];
const STAGE_TO_STEP: Record<Stage, number> = { scan: 1, lookup: 1, face: 2, verifying: 3, result: 4, confirmed: 4 };

interface Props {
  open: boolean;
  matchId: string;
  /** When set, the flow starts by identifying this player (e.g. from a list row) instead of scanning. */
  initialCode?: string;
  onClose: () => void;
  /** Called after attendance is registered so the list can refresh. */
  onRegistered: () => void;
}

export function VerificationFlow({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Verificación de jugador" onClose={props.onClose} wide>
      <Flow key={props.initialCode ?? "scan"} {...props} />
    </Modal>
  );
}

function Flow({ matchId, initialCode, onClose, onRegistered }: Omit<Props, "open">) {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>(initialCode ? "lookup" : "scan");
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [error, setError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [player, setPlayer] = useState<LookupDTO | null>(null);
  const [outcome, setOutcome] = useState<VerificationOutcomeDTO | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmedVia, setConfirmedVia] = useState<"face" | "manual" | "qr">("face");

  /** Back to the start: the scanner when QR is enabled, otherwise back to the list. */
  function reset() {
    if (!QR_VERIFICATION_ENABLED) {
      onClose();
      return;
    }
    setStage("scan");
    setPlayer(null);
    setOutcome(null);
    setReviewing(false);
    setReason("");
    setError("");
    setManualCode("");
  }

  function lookup(code: string) {
    setLoading(true);
    setError("");
    return http<LookupDTO>(`/matches/${matchId}/lookup?code=${encodeURIComponent(code)}`)
      .then((data) => {
        setPlayer(data);
        setStage("lookup");
      })
      .catch((err) => {
        setError(errorMessage(err));
        setStage("scan");
      })
      .finally(() => setLoading(false));
  }

  // Identify the player right away when the flow is opened from a list row.
  useEffect(() => {
    if (!initialCode) return;
    let cancelled = false;
    http<LookupDTO>(`/matches/${matchId}/lookup?code=${encodeURIComponent(initialCode)}`)
      .then((data) => {
        if (cancelled) return;
        setPlayer(data);
        setStage("lookup");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err));
        setStage("scan");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [initialCode, matchId]);

  async function handleFace(image: string) {
    if (!player) return;
    setStage("verifying");
    setError("");
    try {
      setOutcome(await http<VerificationOutcomeDTO>(`/matches/${matchId}/verifications`, { json: { playerId: player.player._id, image } }));
      setStage("result");
    } catch (err) {
      setError(errorMessage(err));
      setStage(err instanceof HttpError && err.code === "too_many_attempts" ? "result" : "face");
      if (err instanceof HttpError && err.code === "too_many_attempts") {
        setOutcome({ verificationId: "", result: "mismatch", allowManualReview: player.allowManualReview });
      }
    }
  }

  async function handleManualReview() {
    if (!player) return;
    setBusy(true);
    setError("");
    try {
      const approved = await http<VerificationOutcomeDTO>(`/matches/${matchId}/verifications/manual`, { json: { playerId: player.player._id, reason } });
      setOutcome(approved);
      setReviewing(false);
    } catch (err) {
      setError(err instanceof HttpError && err.fieldErrors.reason ? err.fieldErrors.reason : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmAttendance(payload: { verificationId: string } | { method: "qr" }) {
    if (!player) return;
    setBusy(true);
    setError("");
    try {
      await http(`/matches/${matchId}/check-ins`, { json: { playerId: player.player._id, status: "present", ...payload } });
      setConfirmedVia("method" in payload ? "qr" : outcome?.confidence !== undefined ? "face" : "manual");
      setStage("confirmed");
      onRegistered();
      toast.success("Asistencia registrada");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const step = STAGE_TO_STEP[stage];
  const eligible = player?.registrationStatus === "active";
  const verified = outcome?.result === "verified";

  return (
    <div className="stack">
      <ol className="stepper" style={{ listStyle: "none" }} aria-label="Progreso de la verificación">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const state = number < step || stage === "confirmed" ? "done" : number === step ? "current" : "";
          return (
            <li key={label} className={`step ${state}`} aria-current={number === step ? "step" : undefined}>
              <span className="dot">{state === "done" ? <Check size={16} aria-hidden /> : number}</span>
              {label}
            </li>
          );
        })}
      </ol>

      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}

      {loading && <Loading />}

      {!loading && stage === "scan" && !QR_VERIFICATION_ENABLED && (
        <div className="action-bar"><Button variant="secondary" onClick={onClose}>Cerrar</Button></div>
      )}

      {!loading && stage === "scan" && QR_VERIFICATION_ENABLED && (
        <div className="stack">
          <QrScanner onDetect={(code) => void lookup(code)} />
          <form
            className="row" style={{ alignItems: "flex-end" }}
            onSubmit={(event) => { event.preventDefault(); if (manualCode.trim()) void lookup(manualCode.trim()); }}
          >
            <div className="grow">
              <Input label="Ingresar manualmente" placeholder="Código del carnet o documento" value={manualCode} onChange={(e) => setManualCode(e.target.value)} autoComplete="off" />
            </div>
            <Button type="submit" variant="secondary" disabled={!manualCode.trim()}>Buscar</Button>
          </form>
        </div>
      )}

      {!loading && player && stage !== "scan" && stage !== "confirmed" && (
        <PlayerSummary player={player} similarity={stage === "result" ? outcome?.confidence : undefined} />
      )}

      {!loading && stage === "lookup" && player && (
        <div className="stack">
          {!eligible && (
            <div className="alert error" role="alert">
              <ShieldAlert size={18} /> {player.registrationStatus === "suspended" ? "Jugador suspendido: no puede ser verificado." : "El jugador no está habilitado."}
            </div>
          )}
          {eligible && player.checkInStatus === "present" && (
            <div className="alert info" role="note"><CheckCircle2 size={18} /> El jugador ya está registrado como presente.</div>
          )}
          {eligible && player.checkInStatus !== "present" && !player.player.hasFace && (
            <div className="alert warning" role="note">
              <AlertCircle size={18} /> El jugador no tiene un rostro registrado, no se puede verificar automáticamente.
            </div>
          )}
          <div className="action-bar">
            <Button variant="secondary" onClick={reset}>{QR_VERIFICATION_ENABLED ? "Escanear otro" : "Cerrar"}</Button>
            {eligible && player.checkInStatus !== "present" && player.player.hasFace && (
              <Button size="large" onClick={() => setStage("face")}>Capturar rostro</Button>
            )}
            {eligible && player.checkInStatus !== "present" && !player.player.hasFace && (
              <>
                {player.allowManualReview && <Button variant="secondary" onClick={() => { setOutcome({ verificationId: "", result: "mismatch" }); setReviewing(true); setStage("result"); }}>Revisión manual</Button>}
                {QR_VERIFICATION_ENABLED && <Button loading={busy} onClick={() => void confirmAttendance({ method: "qr" })}>Registrar asistencia por QR</Button>}
              </>
            )}
          </div>
        </div>
      )}

      {stage === "face" && (
        <div className="stack">
          <FaceCapture onCapture={(image) => void handleFace(image)} buttonLabel="Verificar identidad" />
          <div className="action-bar"><Button variant="secondary" onClick={reset}>Cancelar</Button></div>
        </div>
      )}

      {stage === "verifying" && (
        <div className="stack" style={{ alignItems: "center" }}>
          <Loading label="Verificando identidad..." />
          <p className="text-secondary" role="status">Verificando identidad...</p>
        </div>
      )}

      {stage === "result" && outcome && (
        <div className="stack">
          {verified ? (
            <div className="alert info" role="status" style={{ background: "var(--color-success-bg)", color: "#166534" }}>
              <CheckCircle2 size={18} />
              {outcome.confidence !== undefined ? "IDENTIDAD VALIDADA" : "REVISIÓN MANUAL APROBADA"}
            </div>
          ) : (
            <div className="alert warning" role="alert">
              <ShieldAlert size={18} />
              <span>
                <strong>{outcome.result === "review" ? "VERIFICACIÓN NO CONCLUYENTE" : "VERIFICACIÓN FALLIDA"}</strong>
                <br />El rostro no coincide con el jugador registrado.
              </span>
            </div>
          )}

          {reviewing && (
            <div className="stack">
              <Input label="Motivo de la revisión manual" required value={reason} onChange={(e) => setReason(e.target.value)} hint="Queda registrado en la auditoría junto con tu usuario." />
              <div className="action-bar">
                <Button variant="secondary" onClick={() => setReviewing(false)} disabled={busy}>Cancelar</Button>
                <Button onClick={() => void handleManualReview()} loading={busy} disabled={reason.trim().length < 3}>Aprobar identidad</Button>
              </div>
            </div>
          )}

          {!reviewing && (
            <div className="action-bar">
              {verified ? (
                <>
                  <Button variant="secondary" onClick={reset}>{QR_VERIFICATION_ENABLED ? "Verificar otro jugador" : "Volver a la lista"}</Button>
                  <Button size="large" loading={busy} onClick={() => void confirmAttendance({ verificationId: outcome.verificationId })}>Confirmar asistencia</Button>
                </>
              ) : (
                <>
                  {(outcome.allowManualReview ?? player?.allowManualReview) && (
                    <Button variant="secondary" onClick={() => setReviewing(true)}>Revisión manual</Button>
                  )}
                  <Button size="large" onClick={() => { setOutcome(null); setError(""); setStage("face"); }}>Intentar nuevamente</Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {stage === "confirmed" && player && (
        <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
          <CheckCircle2 size={56} color="var(--color-success)" aria-hidden />
          <h3>Asistencia registrada</h3>
          <p className="text-secondary">
            {player.player.fullName} · {confirmedVia === "face" ? "verificado por rostro" : confirmedVia === "manual" ? "revisión manual" : "registrado por QR"}
          </p>
          <div className="action-bar" style={{ width: "100%" }}>
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            <Button onClick={reset}>{QR_VERIFICATION_ENABLED ? "Verificar otro jugador" : "Volver a la lista"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerSummary({ player, similarity }: { player: LookupDTO; similarity?: number }) {
  const percent = similarity === undefined ? null : Math.max(0, Math.min(100, similarity * 100));
  return (
    <div className="card row" style={{ alignItems: "flex-start" }}>
      {/* The tight reference crop is what a human should compare the live face against; falls back to the ID photo for players enrolled before it existed. */}
      <Avatar src={player.player.facePhotoUrl || player.player.photoUrl} name={player.player.fullName} size={72} />
      <div className="grow stack-sm">
        <div className="text-strong" style={{ fontSize: 16 }}>{player.player.fullName}</div>
        <div className="text-secondary">{player.team.name}</div>
        <div className="text-secondary">{player.shirtNumber != null ? `#${player.shirtNumber} · ` : ""}{player.position ?? "Sin posición"}</div>
        {percent !== null && (
          <div>
            <div className="text-small">Similitud: <strong>{percent.toFixed(1)}%</strong></div>
            <div style={{ height: 8, background: "var(--color-border)", borderRadius: 999, overflow: "hidden", marginTop: 4 }} role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Similitud">
              <div style={{ width: `${percent}%`, height: "100%", background: "var(--color-primary)" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
