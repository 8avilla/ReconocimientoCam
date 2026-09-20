"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import { CHAMPIONSHIP_FORMATS, CHAMPIONSHIP_STATUSES } from "@/lib/constants";
import { CHAMPIONSHIP_FORMAT_LABEL, CHAMPIONSHIP_STATUS_LABEL } from "@/lib/labels";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import type { ChampionshipDTO } from "@/types/api";

interface Props {
  open: boolean;
  /** Championship being edited; null creates a new one. */
  championship: ChampionshipDTO | null;
  onClose: () => void;
  onSaved: (championship: ChampionshipDTO) => void;
}

interface FormValues {
  name: string;
  season: string;
  status: string;
  format: string;
  startDate: string;
  endDate: string;
  maxRosterSize: string;
  minPlayersToStart: string;
  yellowCardsForSuspension: string;
  yellowSuspensionMatches: string;
  redCardSuspensionMatches: string;
  verifyThreshold: string;
  reviewThreshold: string;
  pointsPerWin: string;
  pointsPerDraw: string;
  pointsPerLoss: string;
}

function toValues(championship: ChampionshipDTO | null): FormValues {
  const rules = championship?.rules;
  return {
    name: championship?.name ?? "",
    season: championship?.season ?? String(new Date().getFullYear()),
    status: championship?.status ?? "draft",
    format: championship?.format ?? "league",
    startDate: championship?.startDate?.slice(0, 10) ?? "",
    endDate: championship?.endDate?.slice(0, 10) ?? "",
    maxRosterSize: String(rules?.maxRosterSize ?? 25),
    minPlayersToStart: String(rules?.minPlayersToStart ?? 7),
    yellowCardsForSuspension: String(rules?.yellowCardsForSuspension ?? 3),
    yellowSuspensionMatches: String(rules?.yellowSuspensionMatches ?? 1),
    redCardSuspensionMatches: String(rules?.redCardSuspensionMatches ?? 1),
    verifyThreshold: String(rules?.verifyThreshold ?? 0.35),
    reviewThreshold: String(rules?.reviewThreshold ?? 0.25),
    pointsPerWin: String(rules?.pointsPerWin ?? 3),
    pointsPerDraw: String(rules?.pointsPerDraw ?? 1),
    pointsPerLoss: String(rules?.pointsPerLoss ?? 0),
  };
}

/** The form remounts per open (see `key` below) so its state always starts from the given championship. */
export function ChampionshipFormModal({ open, championship, onClose, onSaved }: Props) {
  return (
    <Modal open={open} title={championship ? "Editar campeonato" : "Nuevo campeonato"} onClose={onClose} wide>
      <ChampionshipForm key={championship?._id ?? "new"} championship={championship} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function ChampionshipForm({ championship, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [values, setValues] = useState<FormValues>(() => toValues(championship));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const bind = (field: keyof FormValues) => ({
    value: values[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value })),
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!values.name.trim()) clientErrors.name = "Este campo es obligatorio";
    if (!values.season.trim()) clientErrors.season = "Este campo es obligatorio";
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      clientErrors.endDate = "La fecha de fin no puede ser anterior a la de inicio";
    }
    setErrors(clientErrors);
    setFormError("");
    if (Object.keys(clientErrors).length > 0) return;

    const isEdit = Boolean(championship);
    const payload = {
      name: values.name.trim(),
      season: values.season.trim(),
      status: values.status,
      format: values.format,
      startDate: values.startDate || (isEdit ? null : undefined),
      endDate: values.endDate || (isEdit ? null : undefined),
      rules: {
        maxRosterSize: Number(values.maxRosterSize),
        minPlayersToStart: Number(values.minPlayersToStart),
        yellowCardsForSuspension: Number(values.yellowCardsForSuspension),
        yellowSuspensionMatches: Number(values.yellowSuspensionMatches),
        redCardSuspensionMatches: Number(values.redCardSuspensionMatches),
        verifyThreshold: Number(values.verifyThreshold),
        reviewThreshold: Number(values.reviewThreshold),
        pointsPerWin: Number(values.pointsPerWin),
        pointsPerDraw: Number(values.pointsPerDraw),
        pointsPerLoss: Number(values.pointsPerLoss),
      },
    };

    setSaving(true);
    try {
      const saved = isEdit
        ? await http<ChampionshipDTO>(`/championships/${championship!._id}`, { method: "PATCH", json: payload })
        : await http<ChampionshipDTO>("/championships", { json: payload });
      toast.success(isEdit ? "Campeonato actualizado" : "Campeonato creado correctamente");
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
      {formError && (
        <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>
      )}
      <div className="form-grid two">
        <Input label="Nombre" required error={errors.name} {...bind("name")} />
        <Input label="Temporada" required error={errors.season} {...bind("season")} />
        <Select label="Estado" {...bind("status")}>
          {CHAMPIONSHIP_STATUSES.map((status) => (
            <option key={status} value={status}>{CHAMPIONSHIP_STATUS_LABEL[status].label}</option>
          ))}
        </Select>
        <Select label="Formato" {...bind("format")}>
          {CHAMPIONSHIP_FORMATS.map((format) => (
            <option key={format} value={format}>{CHAMPIONSHIP_FORMAT_LABEL[format]}</option>
          ))}
        </Select>
        <Input label="Fecha de inicio" type="date" error={errors.startDate} {...bind("startDate")} />
        <Input label="Fecha de fin" type="date" error={errors.endDate} {...bind("endDate")} />
      </div>

      <details>
        <summary className="text-strong" style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>
          Reglas del campeonato
        </summary>
        <div className="form-grid two" style={{ marginTop: "var(--space-md)" }}>
          <Input label="Máximo de jugadores por nómina" type="number" min={1} error={errors["rules.maxRosterSize"]} {...bind("maxRosterSize")} />
          <Input label="Mínimo de jugadores para iniciar" type="number" min={1} error={errors["rules.minPlayersToStart"]} {...bind("minPlayersToStart")} />
          <Input label="Amarillas para suspensión" type="number" min={1} hint="Se acumulan entre partidos." error={errors["rules.yellowCardsForSuspension"]} {...bind("yellowCardsForSuspension")} />
          <Input label="Partidos por acumulación de amarillas" type="number" min={1} error={errors["rules.yellowSuspensionMatches"]} {...bind("yellowSuspensionMatches")} />
          <Input label="Partidos por tarjeta roja" type="number" min={1} error={errors["rules.redCardSuspensionMatches"]} {...bind("redCardSuspensionMatches")} />
          <span />
          <Input label="Puntos por victoria" type="number" min={0} {...bind("pointsPerWin")} />
          <Input label="Puntos por empate" type="number" min={0} {...bind("pointsPerDraw")} />
          <Input label="Puntos por derrota" type="number" min={0} {...bind("pointsPerLoss")} />
          <span />
          <Input
            label="Umbral de verificación facial" type="number" step="0.01" min={0} max={1}
            hint="Similitud mínima para validar la identidad." error={errors["rules.verifyThreshold"]} {...bind("verifyThreshold")}
          />
          <Input
            label="Umbral de revisión manual" type="number" step="0.01" min={0} max={1}
            hint="Entre este valor y el de verificación se pide revisión manual." error={errors["rules.reviewThreshold"]} {...bind("reviewThreshold")}
          />
        </div>
      </details>

      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>{championship ? "Guardar cambios" : "Crear campeonato"}</Button>
      </div>
    </form>
  );
}
