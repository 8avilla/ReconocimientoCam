"use client";

import React, { useState } from "react";
import { AlertCircle, ImagePlus } from "lucide-react";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { Avatar, Button, ConfirmDialog, Input, Select, useToast } from "@/components/ui";
import { CHAMPIONSHIP_FORMATS, CHAMPIONSHIP_STATUSES } from "@/lib/constants";
import { CHAMPIONSHIP_FORMAT_LABEL, CHAMPIONSHIP_STATUS_LABEL } from "@/lib/labels";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { fileToResizedDataUrl } from "@/lib/client/image";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import type { ChampionshipDTO } from "@/types/api";

interface FormValues {
  name: string;
  season: string;
  status: string;
  format: string;
  startDate: string;
  endDate: string;
}

function toValues(championship: ChampionshipDTO | null): FormValues {
  return {
    name: championship?.name ?? "",
    season: championship?.season ?? String(new Date().getFullYear()),
    status: championship?.status ?? "draft",
    format: championship?.format ?? "league",
    startDate: championship?.startDate?.slice(0, 10) ?? "",
    endDate: championship?.endDate?.slice(0, 10) ?? "",
  };
}

/** Name, season, logo, status, format and dates — the "General" tab that used to live inside the "Editar torneo" modal. */
export function GeneralInfoManager({ championshipId }: { championshipId: string }) {
  const { current, reload } = useChampionship();
  const toast = useToast();
  const [values, setValues] = useState<FormValues>(() => toValues(current));
  const [logo, setLogo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(toValues(current)) || logo !== null;
  const { requestClose, confirmProps } = useUnsavedGuard(dirty, () => {
    setValues(toValues(current));
    setLogo(null);
  });

  const bind = (field: keyof FormValues) => ({
    value: values[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((prev) => ({ ...prev, [field]: event.target.value })),
  });

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setLogo(await fileToResizedDataUrl(file, 512));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

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

    setSaving(true);
    try {
      let saved = await http<ChampionshipDTO>(`/championships/${championshipId}`, {
        method: "PATCH",
        json: {
          name: values.name.trim(),
          season: values.season.trim(),
          status: values.status,
          format: values.format,
          startDate: values.startDate || null,
          endDate: values.endDate || null,
        },
      });
      if (logo) {
        try {
          const { logoUrl } = await http<{ logoUrl: string }>(`/championships/${saved._id}/logo`, { json: { image: logo } });
          saved = { ...saved, logoUrl };
        } catch (error) {
          toast.error(`Se guardó, pero no se pudo subir el logo: ${errorMessage(error)}`);
        }
      }
      toast.success("Información general actualizada");
      setLogo(null);
      reload();
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

      <div className="logo-upload-card">
        <Avatar src={logo ?? current?.logoUrl} name={values.name || "Torneo"} size={88} square />
        <div>
          <div className="text-strong" style={{ fontSize: 15, marginBottom: 4 }}>
            {current?.logoUrl || logo ? "Logo del torneo cargado" : "Subir logo del torneo"}
          </div>
          <div className="text-secondary text-small" style={{ marginBottom: 12 }}>
            Formatos recomendados: PNG o JPG de al menos 512x512 px.
          </div>
          <label className="btn secondary" style={{ cursor: "pointer", display: "inline-flex" }}>
            <ImagePlus size={16} aria-hidden /> {current?.logoUrl || logo ? "Cambiar imagen" : "Seleccionar imagen"}
            <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      <div className="form-grid two">
        <Input label="Nombre del torneo" required error={errors.name} {...bind("name")} />
        <Input label="Temporada" required error={errors.season} {...bind("season")} />
        <Select label="Estado del torneo" {...bind("status")}>
          {CHAMPIONSHIP_STATUSES.map((status) => (
            <option key={status} value={status}>{CHAMPIONSHIP_STATUS_LABEL[status].label}</option>
          ))}
        </Select>
        <Select label="Formato de competición" {...bind("format")}>
          {CHAMPIONSHIP_FORMATS.map((format) => (
            <option key={format} value={format}>{CHAMPIONSHIP_FORMAT_LABEL[format]}</option>
          ))}
        </Select>
        <Input label="Fecha estimada de inicio" type="date" error={errors.startDate} {...bind("startDate")} />
        <Input label="Fecha estimada de fin" type="date" error={errors.endDate} {...bind("endDate")} />
      </div>

      <div className="action-bar" style={{ marginTop: "var(--space-lg)" }}>
        <Button variant="secondary" onClick={requestClose} disabled={saving} type="button">Descartar cambios</Button>
        <Button type="submit" loading={saving}>Guardar cambios</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}
