"use client";

import React, { useState } from "react";
import { AlertCircle, Copy, Link2 } from "lucide-react";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { Button, ConfirmDialog, Input, Select, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import { championshipPath } from "@/lib/paths";
import type { ChampionshipDTO } from "@/types/api";

interface FormValues {
  slug: string;
  visibility: string;
}

function toValues(championship: ChampionshipDTO | null): FormValues {
  return { slug: championship?.slug ?? "", visibility: championship?.visibility ?? "public" };
}

/** The custom link (slug) and public/private visibility — the "Enlace y Visibilidad" tab that used to live inside the "Editar torneo" modal. */
export function LinkVisibilityManager({ championshipId }: { championshipId: string }) {
  const { current, reload } = useChampionship();
  const toast = useToast();
  const [values, setValues] = useState<FormValues>(() => toValues(current));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(toValues(current));
  const { requestClose, confirmProps } = useUnsavedGuard(dirty, () => setValues(toValues(current)));
  const previewPath = championshipPath(values.slug.trim().toLowerCase() || championshipId);
  const previewUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${previewPath}`;

  const bind = (field: keyof FormValues) => ({
    value: values[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((prev) => ({ ...prev, [field]: event.target.value })),
  });

  async function copyPreviewUrl() {
    try {
      await navigator.clipboard.writeText(previewUrl);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (values.slug.trim() && !/^[a-z0-9-]+$/.test(values.slug.trim().toLowerCase())) {
      clientErrors.slug = "Solo minúsculas, números y guiones, sin espacios";
    }
    setErrors(clientErrors);
    setFormError("");
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      await http<ChampionshipDTO>(`/championships/${championshipId}`, {
        method: "PATCH",
        json: { slug: values.slug.trim() ? values.slug.trim().toLowerCase() : null, visibility: values.visibility },
      });
      toast.success("Enlace y visibilidad actualizados");
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

      <div className="form-grid two">
        <Input
          label="Enlace personalizado (Slug)" placeholder="ej. ligamaster"
          hint="Solo letras minúsculas, números y guiones."
          error={errors.slug} {...bind("slug")}
        />
        <Select label="Visibilidad en la plataforma" {...bind("visibility")}>
          <option value="public">Público (Aparece en la lista de torneos)</option>
          <option value="private">Privado (Solo con enlace directo)</option>
        </Select>
      </div>

      <div className="link-preview-box">
        <div className="row" style={{ gap: "var(--space-sm)" }}>
          <Link2 size={18} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.8 }}>
              Dirección pública del torneo
            </div>
            <div style={{ fontWeight: 400, fontSize: 13 }}>{previewUrl}</div>
          </div>
        </div>
        <Button size="small" variant="secondary" icon={<Copy size={14} />} onClick={copyPreviewUrl} type="button">
          Copiar
        </Button>
      </div>

      <div className="action-bar" style={{ marginTop: "var(--space-lg)" }}>
        <Button variant="secondary" onClick={requestClose} disabled={saving} type="button">Descartar cambios</Button>
        <Button type="submit" loading={saving}>Guardar cambios</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}
