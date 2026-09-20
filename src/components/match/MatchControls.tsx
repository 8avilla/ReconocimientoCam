"use client";

import { useState } from "react";
import { Flag, Pause, Play, Whistle } from "lucide-react";
import { Button, ConfirmDialog, Input, Modal, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import type { MatchDTO } from "@/types/api";

type Action = "start" | "halftime" | "resume" | "finish";

interface Props {
  match: MatchDTO;
  onChanged: () => void;
}

/** Start, half time, second half and end. Starting without the minimum of players needs a reason. */
export function MatchControls({ match, onChanged }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [forceMessage, setForceMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function run(action: Action, extra: { force?: boolean; reason?: string } = {}) {
    setBusy(action);
    try {
      await http(`/matches/${match._id}/transition`, { json: { action, ...extra } });
      toast.success({ start: "Partido iniciado", halftime: "Medio tiempo", resume: "Segundo tiempo en juego", finish: "Partido finalizado" }[action]);
      setForceMessage(null);
      setFinishOpen(false);
      setReason("");
      onChanged();
    } catch (error) {
      if (action === "start" && error instanceof HttpError && error.code === "not_enough_players") setForceMessage(error.message);
      else toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  if (match.status === "finished") {
    return <p className="text-secondary">El partido finalizó. Los eventos aún se pueden corregir anulándolos.</p>;
  }
  if (match.status !== "scheduled" && match.status !== "live") {
    return <p className="text-secondary">Este partido no se puede iniciar en su estado actual.</p>;
  }

  return (
    <>
      <div className="row-wrap">
        {match.status === "scheduled" && (
          <Button size="large" icon={<Play size={20} />} loading={busy === "start"} onClick={() => run("start")}>Iniciar partido</Button>
        )}
        {match.period === "first_half" && (
          <Button size="large" icon={<Pause size={20} />} loading={busy === "halftime"} onClick={() => run("halftime")}>Medio tiempo</Button>
        )}
        {match.period === "half_time" && (
          <Button size="large" icon={<Play size={20} />} loading={busy === "resume"} onClick={() => run("resume")}>Iniciar segundo tiempo</Button>
        )}
        {match.status === "live" && (
          <Button size="large" variant={match.period === "second_half" ? "primary" : "secondary"} icon={<Flag size={20} />} onClick={() => setFinishOpen(true)}>
            Finalizar partido
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={finishOpen}
        title="Finalizar partido"
        message="Se cerrará el partido y se contarán los partidos cumplidos de las suspensiones vigentes. Podrás corregir eventos después anulándolos."
        confirmLabel="Finalizar"
        loading={busy === "finish"}
        onConfirm={() => run("finish")}
        onClose={() => setFinishOpen(false)}
      />
      <Modal
        open={forceMessage !== null}
        title="Faltan jugadores presentes"
        onClose={() => setForceMessage(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForceMessage(null)} disabled={busy === "start"}>Cancelar</Button>
            <Button icon={<Whistle size={18} />} loading={busy === "start"} disabled={reason.trim().length < 3} onClick={() => run("start", { force: true, reason: reason.trim() })}>
              Iniciar de todos modos
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="text-secondary">{forceMessage}</p>
          <Input label="Motivo para iniciar" required value={reason} onChange={(e) => setReason(e.target.value)} hint="Queda registrado en la auditoría." />
        </div>
      </Modal>
    </>
  );
}
