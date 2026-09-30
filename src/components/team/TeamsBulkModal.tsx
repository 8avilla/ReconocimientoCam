"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button, Modal, Select, useToast } from "@/components/ui";
import { TextFileButton } from "@/components/ui/TextFileButton";
import { errorMessage, http } from "@/lib/client/http";
import { parseNames } from "@/lib/client/parseRoster";
import { useFetch } from "@/lib/client/useFetch";
import { currentPhase } from "@/lib/rules/currentPhase";
import type { PhaseDTO } from "@/types/api";

interface Props {
  open: boolean;
  championshipId: string;
  onClose: () => void;
  /** Called once when the modal closes after creating at least one team. */
  onCreated: () => void;
}

export function TeamsBulkModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Agregar varios equipos" onClose={props.onClose}>
      <TeamsBulk {...props} />
    </Modal>
  );
}

/** One team name per line (pasted from a list or typed); escudo and colors can be added later from each team. */
function TeamsBulk({ championshipId, onClose, onCreated }: Omit<Props, "open">) {
  const toast = useToast();
  const phases = useFetch<{ data: PhaseDTO[] }>(`/championships/${championshipId}/phases`);
  const joinable = (phases.data?.data ?? []).filter((phase) => phase.type !== "knockout");
  const [text, setText] = useState("");
  const [phaseChoice, setPhaseChoice] = useState<string | null>(null);
  const phaseId = phaseChoice ?? currentPhase(joinable)?._id ?? "";
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<{ name: string; message: string }[]>([]);
  const [created, setCreated] = useState(0);

  const names = parseNames(text);

  async function create() {
    setSaving(true);
    const errors: { name: string; message: string }[] = [];
    let ok = 0;
    for (const name of names) {
      try {
        await http("/teams", { json: { championshipId, name, phaseId: phaseId || null } });
        ok += 1;
      } catch (error) {
        errors.push({ name, message: errorMessage(error) });
      }
    }
    setSaving(false);
    setCreated((current) => current + ok);
    setFailed(errors);
    if (errors.length === 0) {
      toast.success(`${ok} equipos creados`);
      onCreated();
      return;
    }
    // Keep only the lines that failed so they can be fixed and sent again.
    setText(errors.map((item) => item.name).join("\n"));
    if (ok > 0) toast.success(`${ok} equipos creados; ${errors.length} con problemas`);
  }

  return (
    <div className="stack">
      <p className="text-secondary">Escribe o pega un equipo por línea. Después puedes subir el escudo y los colores desde cada equipo.</p>
      <div className="field">
        <label htmlFor="bulk-teams">Equipos</label>
        <textarea id="bulk-teams" className="input" rows={8} autoFocus placeholder={"Tigres FC\nLeones\nÁguilas"} value={text} onChange={(event) => setText(event.target.value)} />
        <span className="field-hint">{names.length} {names.length === 1 ? "equipo" : "equipos"} detectados</span>
        <div><TextFileButton onText={(incoming) => setText((current) => (current.trim() ? `${current.trim()}\n${incoming}` : incoming))} /></div>
      </div>
      {joinable.length > 0 && (
        <Select label="Fase" value={phaseId} onChange={(event) => setPhaseChoice(event.target.value)} hint="Todos entran a esta fase; puedes cambiarlo después.">
          <option value="">Sin fase</option>
          {joinable.map((phase) => <option key={phase._id} value={phase._id}>{phase.name}</option>)}
        </Select>
      )}
      {failed.length > 0 && (
        <div className="alert error" role="alert">
          <AlertCircle size={18} />
          <span className="grow">{failed.map((item) => `${item.name}: ${item.message}`).join(" · ")}</span>
        </div>
      )}
      {created > 0 && failed.length > 0 && <p className="text-secondary text-small"><CheckCircle2 size={14} aria-hidden /> {created} ya creados; abajo quedan solo los que fallaron.</p>}
      <div className="action-bar">
        <Button variant="secondary" onClick={() => { if (created > 0) onCreated(); else onClose(); }} disabled={saving}>{created > 0 ? "Listo" : "Cancelar"}</Button>
        <Button loading={saving} disabled={names.length === 0} onClick={create}>Crear {names.length || ""} {names.length === 1 ? "equipo" : "equipos"}</Button>
      </div>
    </div>
  );
}
