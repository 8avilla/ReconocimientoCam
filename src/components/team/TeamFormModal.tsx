"use client";

import React, { useState } from "react";
import { AlertCircle, ImagePlus } from "lucide-react";
import { Avatar, Button, ConfirmDialog, Input, Modal, Select, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { fileToResizedDataUrl } from "@/lib/client/image";
import { useFetch } from "@/lib/client/useFetch";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import { currentPhase } from "@/lib/rules/currentPhase";
import type { PhaseDTO, TeamDTO } from "@/types/api";

interface Props {
  open: boolean;
  championshipId: string;
  /** Team being edited; null creates a new one. */
  team: TeamDTO | null;
  onClose: () => void;
  onSaved: (team: TeamDTO) => void;
}

export function TeamFormModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={props.team ? "Editar equipo" : "Nuevo equipo"} onClose={props.onClose}>
      <TeamForm key={props.team?._id ?? "new"} {...props} />
    </Modal>
  );
}

function TeamForm({ championshipId, team, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [name, setName] = useState(team?.name ?? "");
  const [delegateName, setDelegateName] = useState(team?.delegateName ?? "");
  const [primaryColor, setPrimaryColor] = useState(team?.primaryColor ?? "#16A34A");
  const [secondaryColor, setSecondaryColor] = useState(team?.secondaryColor ?? "#0F172A");
  const [active, setActive] = useState(team?.active ?? true);
  const [shield, setShield] = useState<string | null>(null);
  // New teams join a phase right away: by default the one being played, but the organizer can pick another or none.
  const phases = useFetch<{ data: PhaseDTO[] }>(team ? null : `/championships/${championshipId}/phases`);
  const joinable = (phases.data?.data ?? []).filter((phase) => phase.type !== "knockout");
  const [phaseChoice, setPhaseChoice] = useState<string | null>(null);
  const phaseId = phaseChoice ?? currentPhase(joinable)?._id ?? "";
  const selectedPhase = joinable.find((phase) => phase._id === phaseId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty =
    name.trim() !== (team?.name ?? "") ||
    delegateName.trim() !== (team?.delegateName ?? "") ||
    primaryColor !== (team?.primaryColor ?? "#16A34A") ||
    secondaryColor !== (team?.secondaryColor ?? "#0F172A") ||
    active !== (team?.active ?? true) ||
    shield !== null ||
    phaseChoice !== null;
  const { requestClose, confirmProps } = useUnsavedGuard(dirty, onClose);

  async function handleShieldChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setShield(await fileToResizedDataUrl(file, 512));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setErrors({ name: "Este campo es obligatorio" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const fields = { name: name.trim(), delegateName: delegateName.trim(), primaryColor, secondaryColor };
      let saved = team
        ? await http<TeamDTO>(`/teams/${team._id}`, { method: "PATCH", json: { ...fields, active } })
        : await http<TeamDTO>("/teams", { json: { ...fields, championshipId, phaseId: phaseId || null } });

      if (shield) {
        try {
          const { shieldUrl } = await http<{ shieldUrl: string }>(`/teams/${saved._id}/shield`, { json: { image: shield } });
          saved = { ...saved, shieldUrl };
        } catch (error) {
          toast.error(`El equipo se guardó, pero no se pudo subir el escudo: ${errorMessage(error)}`);
        }
      }
      toast.success(team ? "Equipo actualizado" : "Equipo creado correctamente");
      onSaved(saved);
    } catch (error) {
      if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}

      <div className="row">
        <Avatar src={shield ?? team?.shieldUrl} name={name || "Equipo"} size={72} square />
        <label className="btn secondary" style={{ cursor: "pointer" }}>
          <ImagePlus size={18} aria-hidden /> {team?.shieldUrl || shield ? "Cambiar escudo" : "Subir escudo"}
          <input type="file" accept="image/*" onChange={handleShieldChange} style={{ display: "none" }} />
        </label>
      </div>

      <Input label="Nombre del equipo" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <Input label="Delegado" value={delegateName} onChange={(e) => setDelegateName(e.target.value)} error={errors.delegateName} />
      <div className="form-grid two">
        <Input label="Color principal" type="color" className="color-input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
        <Input label="Color secundario" type="color" className="color-input" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
      </div>
      {!team && joinable.length > 0 && (
        <Select
          label="Fase"
          value={phaseId}
          onChange={(e) => setPhaseChoice(e.target.value)}
          hint={
            selectedPhase
              ? `Entra a ${selectedPhase.name}${selectedPhase.matches.total > 0 ? " (ya tiene calendario: luego genera los partidos que le faltan)" : ""}${selectedPhase.type === "groups" ? "; asígnale su grupo en «Equipos» de la fase" : ""}. Puedes cambiarlo cuando quieras.`
              : "No entra a ninguna fase por ahora. Puedes agregarlo después desde «Equipos» de la fase."
          }
        >
          <option value="">Sin fase</option>
          {joinable.map((phase) => <option key={phase._id} value={phase._id}>{phase.name}</option>)}
        </Select>
      )}
      {team && (
        <label className="checkbox-row">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Equipo activo en el campeonato
        </label>
      )}

      <div className="action-bar">
        <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>{team ? "Guardar cambios" : "Crear equipo"}</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}
