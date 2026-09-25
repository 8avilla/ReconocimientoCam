import React, { useState } from "react";
import { AlertCircle, Award, Copy, DollarSign, ImagePlus, Link2, Settings } from "lucide-react";
import { Avatar, Button, ConfirmDialog, Input, Modal, Select, useToast } from "@/components/ui";
import { CHAMPIONSHIP_FORMATS, CHAMPIONSHIP_STATUSES } from "@/lib/constants";
import { CHAMPIONSHIP_FORMAT_LABEL, CHAMPIONSHIP_STATUS_LABEL } from "@/lib/labels";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { fileToResizedDataUrl } from "@/lib/client/image";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import { championshipPath } from "@/lib/paths";
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
  slug: string;
  visibility: string;
  maxRosterSize: string;
  minPlayersToStart: string;
  yellowCardsForSuspension: string;
  yellowSuspensionMatches: string;
  redCardSuspensionMatches: string;
  yellowCardFine: string;
  redCardFine: string;
  registrationFeeAmount: string;
  pointsPerWin: string;
  pointsPerDraw: string;
  pointsPerLoss: string;
  walkoverGoals: string;
  periodsCount: string;
  periodLabels: string;
}

type FormTab = "general" | "link" | "finances" | "rules";

function toValues(championship: ChampionshipDTO | null): FormValues {
  const rules = championship?.rules;
  return {
    name: championship?.name ?? "",
    season: championship?.season ?? String(new Date().getFullYear()),
    status: championship?.status ?? "draft",
    format: championship?.format ?? "league",
    startDate: championship?.startDate?.slice(0, 10) ?? "",
    endDate: championship?.endDate?.slice(0, 10) ?? "",
    slug: championship?.slug ?? "",
    visibility: championship?.visibility ?? "public",
    maxRosterSize: String(rules?.maxRosterSize ?? 25),
    minPlayersToStart: String(rules?.minPlayersToStart ?? 7),
    yellowCardsForSuspension: String(rules?.yellowCardsForSuspension ?? 3),
    yellowSuspensionMatches: String(rules?.yellowSuspensionMatches ?? 1),
    redCardSuspensionMatches: String(rules?.redCardSuspensionMatches ?? 1),
    yellowCardFine: String(rules?.yellowCardFine ?? 0),
    redCardFine: String(rules?.redCardFine ?? 0),
    registrationFeeAmount: String(rules?.registrationFeeAmount ?? 0),
    pointsPerWin: String(rules?.pointsPerWin ?? 3),
    pointsPerDraw: String(rules?.pointsPerDraw ?? 1),
    pointsPerLoss: String(rules?.pointsPerLoss ?? 0),
    walkoverGoals: String(rules?.walkoverGoals ?? 0),
    periodsCount: String(rules?.periodsCount ?? 2),
    periodLabels: (rules?.periodLabels ?? ["1er Tiempo", "2do Tiempo"]).join(", "),
  };
}

function normalizePeriodLabels(csv: string, count: number): string[] {
  const given = csv.split(",").map((label) => label.trim()).filter(Boolean);
  return Array.from({ length: count }, (_, index) => given[index] || `Tiempo ${index + 1}`);
}

export function ChampionshipFormModal({ open, championship, onClose, onSaved }: Props) {
  return (
    <Modal open={open} title={championship ? "Editar campeonato" : "Nuevo campeonato"} onClose={onClose} wide>
      <ChampionshipForm key={championship?._id ?? "new"} championship={championship} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function ChampionshipForm({ championship, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [formTab, setFormTab] = useState<FormTab>("general");
  const [values, setValues] = useState<FormValues>(() => toValues(championship));
  const [logo, setLogo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(toValues(championship)) || logo !== null;
  const { requestClose, confirmProps } = useUnsavedGuard(dirty, onClose);
  const previewPath = championshipPath(values.slug.trim().toLowerCase() || championship?._id || "id-del-campeonato");
  const previewUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${previewPath}`;

  const bind = (field: keyof FormValues) => ({
    value: values[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value })),
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
    if (!values.name.trim()) clientErrors.name = "Este campo es obligatorio";
    if (!values.season.trim()) clientErrors.season = "Este campo es obligatorio";
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      clientErrors.endDate = "La fecha de fin no puede ser anterior a la de inicio";
    }
    if (values.slug.trim() && !/^[a-z0-9-]+$/.test(values.slug.trim().toLowerCase())) {
      clientErrors.slug = "Solo minúsculas, números y guiones, sin espacios";
    }
    setErrors(clientErrors);
    setFormError("");

    if (Object.keys(clientErrors).length > 0) {
      if (clientErrors.name || clientErrors.season || clientErrors.endDate) setFormTab("general");
      else if (clientErrors.slug) setFormTab("link");
      return;
    }

    const isEdit = Boolean(championship);
    const payload = {
      name: values.name.trim(),
      season: values.season.trim(),
      status: values.status,
      format: values.format,
      startDate: values.startDate || (isEdit ? null : undefined),
      endDate: values.endDate || (isEdit ? null : undefined),
      slug: values.slug.trim() ? values.slug.trim().toLowerCase() : isEdit ? null : undefined,
      visibility: values.visibility,
      rules: {
        maxRosterSize: Number(values.maxRosterSize),
        minPlayersToStart: Number(values.minPlayersToStart),
        yellowCardsForSuspension: Number(values.yellowCardsForSuspension),
        yellowSuspensionMatches: Number(values.yellowSuspensionMatches),
        redCardSuspensionMatches: Number(values.redCardSuspensionMatches),
        yellowCardFine: Number(values.yellowCardFine),
        redCardFine: Number(values.redCardFine),
        registrationFeeAmount: Number(values.registrationFeeAmount),
        pointsPerWin: Number(values.pointsPerWin),
        pointsPerDraw: Number(values.pointsPerDraw),
        pointsPerLoss: Number(values.pointsPerLoss),
        walkoverGoals: Number(values.walkoverGoals),
        periodsCount: Number(values.periodsCount),
        periodLabels: normalizePeriodLabels(values.periodLabels, Number(values.periodsCount)),
      },
    };

    setSaving(true);
    try {
      let saved = isEdit
        ? await http<ChampionshipDTO>(`/championships/${championship!._id}`, { method: "PATCH", json: payload })
        : await http<ChampionshipDTO>("/championships", { json: payload });

      if (logo) {
        try {
          const { logoUrl } = await http<{ logoUrl: string }>(`/championships/${saved._id}/logo`, { json: { image: logo } });
          saved = { ...saved, logoUrl };
        } catch (error) {
          toast.error(`El campeonato se guardó, pero no se pudo subir el logo: ${errorMessage(error)}`);
        }
      }
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

      {/* Form Navigation Tabs */}
      <div className="form-nav-tabs" role="tablist" aria-label="Secciones de configuración">
        <button type="button" role="tab" aria-selected={formTab === "general"} className={`form-nav-tab${formTab === "general" ? " active" : ""}`} onClick={() => setFormTab("general")}>
          <Settings size={16} /> General
        </button>
        <button type="button" role="tab" aria-selected={formTab === "link"} className={`form-nav-tab${formTab === "link" ? " active" : ""}`} onClick={() => setFormTab("link")}>
          <Link2 size={16} /> Enlace y Visibilidad
        </button>
        <button type="button" role="tab" aria-selected={formTab === "finances"} className={`form-nav-tab${formTab === "finances" ? " active" : ""}`} onClick={() => setFormTab("finances")}>
          <DollarSign size={16} /> Finanzas y Multas
        </button>
        <button type="button" role="tab" aria-selected={formTab === "rules"} className={`form-nav-tab${formTab === "rules" ? " active" : ""}`} onClick={() => setFormTab("rules")}>
          <Award size={16} /> Reglas
        </button>
      </div>

      {/* TAB 1: GENERAL */}
      {formTab === "general" && (
        <div className="stack" style={{ gap: "var(--space-md)" }}>
          {/* Logo Upload Card */}
          <div className="logo-upload-card">
            <Avatar src={logo ?? championship?.logoUrl} name={values.name || "Campeonato"} size={88} square />
            <div>
              <div className="text-strong" style={{ fontSize: 15, marginBottom: 4 }}>
                {championship?.logoUrl || logo ? "Logo del campeonato cargado" : "Subir logo del campeonato"}
              </div>
              <div className="text-secondary text-small" style={{ marginBottom: 12 }}>
                Formatos recomendados: PNG o JPG de al menos 512x512 px.
              </div>
              <label className="btn secondary" style={{ cursor: "pointer", display: "inline-flex" }}>
                <ImagePlus size={16} aria-hidden /> {championship?.logoUrl || logo ? "Cambiar imagen" : "Seleccionar imagen"}
                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
              </label>
            </div>
          </div>

          <div className="form-grid two">
            <Input label="Nombre del campeonato" required error={errors.name} {...bind("name")} />
            <Input label="Temporada" required error={errors.season} {...bind("season")} />
            <Select label="Estado del campeonato" {...bind("status")}>
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
        </div>
      )}

      {/* TAB 2: LINK & VISIBILITY */}
      {formTab === "link" && (
        <div className="stack" style={{ gap: "var(--space-lg)" }}>
          <div className="form-grid two">
            <Input
              label="Enlace personalizado (Slug)" placeholder="ej. ligamaster"
              hint="Solo letras minúsculas, números y guiones."
              error={errors.slug} {...bind("slug")}
            />
            <Select
              label="Visibilidad en la plataforma" {...bind("visibility")}
            >
              <option value="public">Público (Aparece en la lista de torneos)</option>
              <option value="private">Privado (Solo con enlace directo)</option>
            </Select>
          </div>

          {/* Live Link Preview Banner */}
          <div className="link-preview-box">
            <div className="row" style={{ gap: "var(--space-sm)" }}>
              <Link2 size={18} style={{ flexShrink: 0 }} />

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.8 }}>
                  Dirección pública del torneo
                </div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{previewUrl}</div>
              </div>
            </div>
            <Button size="small" variant="secondary" icon={<Copy size={14} />} onClick={copyPreviewUrl}>
              Copiar
            </Button>
          </div>
        </div>
      )}

      {/* TAB 3: FINANCES & FINES */}
      {formTab === "finances" && (
        <div className="stack" style={{ gap: "var(--space-lg)" }}>
          <section className="card stack-sm" style={{ background: "var(--color-background)" }}>
            <h3>Cuota de inscripción por equipo</h3>
            <p className="text-secondary text-small">
              Monto que paga cada club al registrarse. Se genera automáticamente en la gestión financiera del campeonato. Déjalo en 0 si la inscripción es gratuita.
            </p>
            <Input label="Cuota por equipo ($)" type="number" min={0} step={1000} inputMode="numeric" error={errors["rules.registrationFeeAmount"]} {...bind("registrationFeeAmount")} />
          </section>

          <section className="card stack-sm" style={{ background: "var(--color-background)" }}>
            <h3>Multas por tarjetas aplicadas en partidos</h3>
            <p className="text-secondary text-small">
              Valores que se cargan automáticamente a los equipos al recibir tarjetas durante los partidos.
            </p>
            <div className="form-grid two">
              <Input label="Multa por Tarjeta Amarilla ($)" type="number" min={0} step={1000} inputMode="numeric" error={errors["rules.yellowCardFine"]} {...bind("yellowCardFine")} />
              <Input label="Multa por Tarjeta Roja ($)" type="number" min={0} step={1000} inputMode="numeric" hint="Incluye roja directa y doble amarilla." error={errors["rules.redCardFine"]} {...bind("redCardFine")} />
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: RULES & BIOMETRICS */}
      {formTab === "rules" && (
        <div className="stack" style={{ gap: "var(--space-lg)" }}>
          <section className="card stack-sm" style={{ background: "var(--color-background)" }}>
            <h3>Límites de nómina y suspensiones</h3>
            <div className="form-grid two">
              <Input label="Máximo de jugadores por plantilla" type="number" min={1} error={errors["rules.maxRosterSize"]} {...bind("maxRosterSize")} />
              <Input label="Mínimo de jugadores para iniciar un partido" type="number" min={1} error={errors["rules.minPlayersToStart"]} {...bind("minPlayersToStart")} />
              <Input label="Amarillas acumuladas para suspensión" type="number" min={1} hint="Cantidad de tarjetas amarillas que generan 1 partido de sanción." error={errors["rules.yellowCardsForSuspension"]} {...bind("yellowCardsForSuspension")} />
              <Input label="Partidos de suspensión por amarillas" type="number" min={1} error={errors["rules.yellowSuspensionMatches"]} {...bind("yellowSuspensionMatches")} />
              <Input label="Partidos de suspensión por tarjeta roja" type="number" min={1} error={errors["rules.redCardSuspensionMatches"]} {...bind("redCardSuspensionMatches")} />
            </div>
          </section>

          <section className="card stack-sm" style={{ background: "var(--color-background)" }}>
            <h3>Puntos y reglas de partidos</h3>
            <div className="form-grid two">
              <Input label="Puntos por victoria" type="number" min={0} {...bind("pointsPerWin")} />
              <Input label="Puntos por empate" type="number" min={0} {...bind("pointsPerDraw")} />
              <Input label="Puntos por derrota" type="number" min={0} {...bind("pointsPerLoss")} />
              <Input label="Goles asignados por W.O." type="number" min={0} max={50} hint="Goles asignados al ganador por W.O." error={errors["rules.walkoverGoals"]} {...bind("walkoverGoals")} />
              <Input label="Cantidad de tiempos por partido" type="number" min={1} max={20} hint="2 para fútbol, 4 para baloncesto." error={errors["rules.periodsCount"]} {...bind("periodsCount")} />
              <Input label="Nombres de los tiempos" placeholder="1er Tiempo, 2do Tiempo" hint="Separados por coma." error={errors["rules.periodLabels"]} {...bind("periodLabels")} />
            </div>
          </section>
        </div>
      )}

      <div className="action-bar" style={{ marginTop: "var(--space-lg)" }}>
        <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>{championship ? "Guardar cambios" : "Crear campeonato"}</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}

