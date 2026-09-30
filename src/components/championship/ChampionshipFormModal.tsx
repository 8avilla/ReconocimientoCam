import React, { useState } from "react";
import { AlertCircle, ImagePlus } from "lucide-react";
import { Avatar, Button, Input, Modal, Select, useToast } from "@/components/ui";
import { CHAMPIONSHIP_FORMATS, CHAMPIONSHIP_STATUSES } from "@/lib/constants";
import { CHAMPIONSHIP_FORMAT_LABEL, CHAMPIONSHIP_STATUS_LABEL } from "@/lib/labels";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { fileToResizedDataUrl } from "@/lib/client/image";
import type { ChampionshipDTO } from "@/types/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (championship: ChampionshipDTO) => void;
}

/** Optional starting structure: only what is chosen here gets created, and each phase can be edited or deleted afterwards. */
const PRESETS = {
  none: { label: "Las armo yo después", phases: [] },
  league: { label: "Liga: todos contra todos (una vuelta)", phases: [{ name: "Fase regular", type: "league", legs: 1 }] },
  league2: { label: "Liga: todos contra todos (ida y vuelta)", phases: [{ name: "Fase regular", type: "league", legs: 2 }] },
  groups: { label: "Grupos y luego eliminatoria", phases: [{ name: "Fase de grupos", type: "groups", legs: 1, groupCount: 2 }, { name: "Eliminatoria", type: "knockout", legs: 1 }] },
} as const;
type PresetId = keyof typeof PRESETS;

interface FormValues {
  name: string;
  season: string;
  status: string;
  format: string;
  visibility: string;
}

const initialValues = (): FormValues => ({
  name: "",
  season: String(new Date().getFullYear()),
  status: "draft",
  format: "league",
  visibility: "public",
});

/** Creates a new championship with just the essentials. Everything else — dates, custom link, finances,
 * rules — is configured afterwards from its own "Configuración" panel, once the championship exists. */
export function ChampionshipFormModal({ open, onClose, onSaved }: Props) {
  return (
    <Modal open={open} title="Nuevo torneo" onClose={onClose}>
      {/* Remounts on every open so a previous, half-filled attempt never lingers. */}
      <ChampionshipForm key={open ? "open" : "closed"} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function ChampionshipForm({ onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [logo, setLogo] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetId>("none");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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
    setErrors(clientErrors);
    setFormError("");
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      let saved = await http<ChampionshipDTO>("/championships", {
        json: {
          name: values.name.trim(),
          season: values.season.trim(),
          status: values.status,
          format: values.format,
          visibility: values.visibility,
        },
      });
      if (logo) {
        try {
          const { logoUrl } = await http<{ logoUrl: string }>(`/championships/${saved._id}/logo`, { json: { image: logo } });
          saved = { ...saved, logoUrl };
        } catch (error) {
          toast.error(`El torneo se creó, pero no se pudo subir el logo: ${errorMessage(error)}`);
        }
      }
      if (PRESETS[preset].phases.length > 0) {
        try {
          for (const phase of PRESETS[preset].phases) await http(`/championships/${saved._id}/phases`, { json: phase });
        } catch (error) {
          toast.error(`El torneo se creó, pero no se pudieron crear las fases: ${errorMessage(error)}. Créalas desde Configuración.`);
        }
      }
      toast.success("Torneo creado correctamente");
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

      <div className="logo-upload-card">
        <Avatar src={logo ?? undefined} name={values.name || "Torneo"} size={88} square />
        <div>
          <div className="text-strong" style={{ fontSize: 15, marginBottom: 4 }}>
            {logo ? "Logo del torneo cargado" : "Subir logo del torneo"}
          </div>
          <div className="text-secondary text-small" style={{ marginBottom: 12 }}>
            Formatos recomendados: PNG o JPG de al menos 512x512 px.
          </div>
          <label className="btn secondary" style={{ cursor: "pointer", display: "inline-flex" }}>
            <ImagePlus size={16} aria-hidden /> {logo ? "Cambiar imagen" : "Seleccionar imagen"}
            <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      <Input label="Nombre del torneo" required error={errors.name} {...bind("name")} />

      <div className="form-grid two">
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
        <Select label="Visibilidad" {...bind("visibility")}>
          <option value="public">Público (Aparece en la lista de torneos)</option>
          <option value="private">Privado (Solo con enlace directo)</option>
        </Select>
      </div>

      <Select
        label="Fases para empezar (opcional)"
        value={preset}
        onChange={(event) => setPreset(event.target.value as PresetId)}
        hint={PRESETS[preset].phases.length > 0 ? `Se crea: ${PRESETS[preset].phases.map((phase) => phase.name).join(" → ")}. Luego eliges los equipos y generas el calendario; todo se puede cambiar.` : "Sin fases por ahora: las creas tú desde Configuración."}
      >
        {(Object.keys(PRESETS) as PresetId[]).map((id) => <option key={id} value={id}>{PRESETS[id].label}</option>)}
      </Select>

      <div className="action-bar" style={{ marginTop: "var(--space-lg)" }}>
        <Button variant="secondary" onClick={onClose} disabled={saving} type="button">Cancelar</Button>
        <Button type="submit" loading={saving}>Crear torneo</Button>
      </div>
    </form>
  );
}
