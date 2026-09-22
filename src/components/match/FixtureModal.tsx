"use client";

import { championshipPath } from "@/lib/paths";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarPlus } from "lucide-react";
import { Button, Modal, Select, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { LEGS_LABEL, PHASE_TYPE_LABEL } from "@/lib/labels";
import type { FixturePreviewDTO, PhaseDTO } from "@/types/api";

interface Props {
  open: boolean;
  championshipId: string;
  /** Phases of the championship: the matches always belong to one of them. */
  phases: PhaseDTO[];
  /** Phase selected when the modal opens. */
  initialPhaseId?: string;
  /** Fixed target (e.g. one knockout round): its own endpoint, no phase choice. */
  target?: { endpoint: string; title: string; note?: string };
  onClose: () => void;
  onCreated: () => void;
}

export function FixtureModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={props.target?.title ?? "Generar partidos"} onClose={props.onClose} wide>
      <FixtureWizard {...props} />
    </Modal>
  );
}

function FixtureWizard({ championshipId, phases, initialPhaseId, target, onClose, onCreated }: Omit<Props, "open">) {
  const toast = useToast();
  // Knockout phases are created round by round from their bracket.
  const eligible = phases.filter((item) => item.type !== "knockout");
  const [phaseId, setPhaseId] = useState(eligible.find((item) => item._id === initialPhaseId)?._id ?? eligible[0]?._id ?? "");
  const phase = eligible.find((item) => item._id === phaseId);
  const endpoint = target?.endpoint ?? `/phases/${phaseId}/fixture`;

  const [preview, setPreview] = useState<FixturePreviewDTO | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(replaceScheduled: boolean) {
    setBusy(true);
    setError("");
    try {
      setPreview(await http<FixturePreviewDTO>(endpoint, { json: { preview: true, replaceScheduled } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await http<FixturePreviewDTO>(endpoint, { json: { preview: false, replaceScheduled: replace } });
      toast.success(`Se crearon ${result.created} partidos. Ahora asígnales día y hora.`);
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!target && eligible.length === 0) {
    return (
      <div className="stack">
        <div className="alert warning" role="note">
          <AlertCircle size={18} /> Todo partido pertenece a una fase. Crea una fase de liga o grupos, elige sus equipos y luego genera sus partidos.
        </div>
        <div className="action-bar">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Link href={championshipPath(championshipId, "gestionar")} className="btn primary">Configurar fases</Link>
        </div>
      </div>
    );
  }

  if (preview) {
    const rounds = [...new Set(preview.matches.map((match) => match.round))];
    return (
      <div className="stack">
        {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}
        {preview.matches.length === 0 ? (
          <div className="alert info" role="note"><AlertCircle size={18} /> No hay partidos nuevos por crear: todos los cruces ya existen{preview.replaceable > 0 ? ". Si quieres volver a generarlos, marca la opción de reemplazar." : "."}</div>
        ) : (
          <>
            <p className="text-strong">{preview.matches.length} partidos en {preview.rounds} fechas</p>
            <p className="text-secondary text-small">Se crean sin día ni hora: los programarás después, y podrás cambiarlos las veces que haga falta.</p>
          </>
        )}

        {preview.replaceable > 0 && (
          <div className="alert warning" role="note">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={replace}
                onChange={(event) => {
                  setReplace(event.target.checked);
                  void load(event.target.checked);
                }}
              />
              <span>
                Reemplazar los {preview.replaceable} partido(s) por jugar y sin asistencia que ya existen. <strong>Se perderán sus días y horas.</strong>
                {!replace && " Si no lo marcas, solo se agregan los cruces que falten."}
              </span>
            </label>
          </div>
        )}
        {preview.kept > 0 && <p className="text-secondary text-small">Se conservan {preview.kept} partido(s) existentes; sus cruces no se repiten.</p>}

        <div className="card flush" style={{ maxHeight: "48vh", overflowY: "auto" }}>
          {rounds.map((round) => {
            const inRound = preview.matches.filter((match) => match.round === round);
            const byes = preview.byes.find((entry) => entry.round === round);
            return (
              <section key={round} aria-label={preview.roundLabels?.[round] ?? `Fecha ${round}`}>
                <h4 className="text-secondary text-small" style={{ padding: "var(--space-sm) var(--space-lg)", background: "var(--color-background)" }}>
                  {preview.roundLabels?.[round] ?? `Fecha ${round}`}{byes && ` · Descansa: ${byes.teams.join(", ")}`}
                </h4>
                {inRound.map((match, index) => (
                  <div key={index} className="list-row">
                    <span className="grow truncate">{match.group && <span className="text-secondary">{match.group} · </span>}<span className="text-strong">{match.homeTeam.name}</span> vs <span className="text-strong">{match.awayTeam.name}</span></span>
                  </div>
                ))}
              </section>
            );
          })}
        </div>

        <div className="action-bar">
          <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy}>Atrás</Button>
          <Button size="large" icon={<CalendarPlus size={18} />} loading={busy} disabled={preview.matches.length === 0} onClick={create}>Crear {preview.matches.length} partidos</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}
      <p className="text-secondary">
        {target?.note ?? "Crea los cruces de la fase agrupados en fechas (Fecha 1, Fecha 2…). Los partidos se crean sin día ni hora; tú se los asignas cuando los tengas definidos."}
      </p>
      {!target && (
        <Select label="Fase" required value={phaseId} onChange={(e) => setPhaseId(e.target.value)} hint={phase ? `${PHASE_TYPE_LABEL[phase.type]} · ${LEGS_LABEL[phase.legs]} · ${phase.teamCount} equipos` : undefined}>
          {eligible.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
        </Select>
      )}
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button loading={busy} onClick={() => load(replace)}>Ver partidos</Button>
      </div>
    </div>
  );
}
