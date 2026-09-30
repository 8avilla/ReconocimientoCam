"use client";

import { useState } from "react";
import { Flag, Pause, Play, Timer } from "lucide-react";
import { Button, ConfirmDialog, Input, Modal, Select, useToast } from "@/components/ui";
import { MATCH_STATUSES, type MatchStatus } from "@/lib/constants";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { MATCH_PERIOD_LABEL, MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchAction } from "@/lib/rules/match";
import type { MatchDTO } from "@/types/api";

/** The one button the organizer needs next, from the match's state machine (start → half time → 2nd half → finish). */
function nextStep(match: MatchDTO): { action: MatchAction; label: string; done: string; icon: React.ReactNode } | null {
  if (match.status === "scheduled") return { action: "start", label: "Iniciar partido", done: "Partido iniciado", icon: <Play size={20} /> };
  if (match.status !== "live") return null;
  if (match.period === "first_half") return { action: "halftime", label: "Medio tiempo", done: "Medio tiempo", icon: <Pause size={20} /> };
  if (match.period === "half_time") return { action: "resume", label: "Iniciar 2.º tiempo", done: "Segundo tiempo en juego", icon: <Timer size={20} /> };
  if (match.period === "second_half") return { action: "finish", label: "Finalizar partido", done: "Partido finalizado", icon: <Flag size={20} /> };
  return null;
}

/**
 * One tap to change the match's status, no separate "Editar partido" form needed. Picking "W.O." asks for
 * the winner right here (it can also be changed later the same way, in case of a mistake).
 */
export function MatchQuickStatus({ match, onChanged }: { match: MatchDTO; onChanged: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  // True as soon as "W.O." is picked in the dropdown, even before a winner is confirmed and saved.
  const [pendingWalkover, setPendingWalkover] = useState(false);

  const step = nextStep(match);
  const [confirmFinish, setConfirmFinish] = useState(false);
  // Starting with fewer present players than the rules ask for needs a reason (the server says so with this error).
  const [forceStart, setForceStart] = useState<{ message: string; reason: string } | null>(null);

  async function advance(action: MatchAction, force?: { reason: string }) {
    setSaving(true);
    try {
      await http(`/matches/${match._id}/transition`, { json: { action, ...(force ? { force: true, reason: force.reason } : {}) } });
      toast.success(step?.done ?? "Estado actualizado");
      setConfirmFinish(false);
      setForceStart(null);
      onChanged();
    } catch (error) {
      if (action === "start" && error instanceof HttpError && error.code === "not_enough_players") setForceStart({ message: error.message, reason: "" });
      else toast.error(errorMessage(error));
      setConfirmFinish(false);
    } finally {
      setSaving(false);
    }
  }

  async function save(status: MatchStatus, walkoverWinnerTeamId?: string) {
    setSaving(true);
    try {
      await http(`/matches/${match._id}`, { method: "PATCH", json: { status, ...(walkoverWinnerTeamId ? { walkoverWinnerTeamId } : {}) } });
      toast.success(`Estado: ${MATCH_STATUS_LABEL[status].label}`);
      setPendingWalkover(false);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function handleChange(next: MatchStatus) {
    if (next === "walkover") {
      setPendingWalkover(true);
      return;
    }
    setPendingWalkover(false);
    save(next);
  }

  const showWinnerPicker = pendingWalkover || match.status === "walkover";

  const manual = (
    <div className="stack-sm">
      <Select
        label="Estado del partido"
        value={pendingWalkover ? "walkover" : match.status}
        onChange={(event) => handleChange(event.target.value as MatchStatus)}
        disabled={saving}
      >
        {MATCH_STATUSES.map((item) => <option key={item} value={item}>{MATCH_STATUS_LABEL[item].label}</option>)}
      </Select>
      {showWinnerPicker && (
        <div className="row-wrap" role="group" aria-label="Ganador del W.O." style={{ alignItems: "center", gap: "var(--space-sm)" }}>
          <span className="text-secondary text-small">Ganador:</span>
          <Button
            size="small"
            loading={saving}
            variant={match.walkoverWinnerTeamId?._id === match.homeTeamId._id ? "primary" : "secondary"}
            onClick={() => save("walkover", match.homeTeamId._id)}
          >
            {match.homeTeamId.name}
          </Button>
          <Button
            size="small"
            loading={saving}
            variant={match.walkoverWinnerTeamId?._id === match.awayTeamId._id ? "primary" : "secondary"}
            onClick={() => save("walkover", match.awayTeamId._id)}
          >
            {match.awayTeamId.name}
          </Button>
          {pendingWalkover && match.status !== "walkover" && (
            <Button size="small" variant="ghost" onClick={() => setPendingWalkover(false)}>Cancelar</Button>
          )}
        </div>
      )}
    </div>
  );

  // No next step (finished, postponed...): the status selector is all there is, so show it directly.
  if (!step) return manual;

  return (
    <div className="stack-sm">
      {match.status === "live" && <p className="text-secondary text-small">En juego · {MATCH_PERIOD_LABEL[match.period]}</p>}
      <Button size="large" block icon={step.icon} loading={saving} onClick={() => (step.action === "finish" ? setConfirmFinish(true) : advance(step.action))}>
        {step.label}
      </Button>
      <details>
        <summary className="text-secondary text-small" style={{ cursor: "pointer", minHeight: 32 }}>Otros estados (W.O., aplazado, suspendido…)</summary>
        <div style={{ marginTop: "var(--space-sm)" }}>{manual}</div>
      </details>

      <ConfirmDialog
        open={confirmFinish}
        title="Finalizar partido"
        message="Se cierra el marcador y se descuentan las suspensiones cumplidas. Después solo podrás anular eventos."
        confirmLabel="Finalizar"
        loading={saving}
        onConfirm={() => advance("finish")}
        onClose={() => setConfirmFinish(false)}
      />
      <Modal
        open={forceStart !== null}
        title="Faltan jugadores presentes"
        onClose={() => setForceStart(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForceStart(null)} disabled={saving}>Cancelar</Button>
            <Button loading={saving} disabled={!forceStart?.reason.trim()} onClick={() => forceStart && advance("start", { reason: forceStart.reason.trim() })}>Iniciar de todos modos</Button>
          </>
        }
      >
        <div className="stack">
          <p className="text-secondary">{forceStart?.message}. Puedes iniciar igual indicando el motivo.</p>
          <Input label="Motivo" value={forceStart?.reason ?? ""} onChange={(event) => setForceStart((current) => current && { ...current, reason: event.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
