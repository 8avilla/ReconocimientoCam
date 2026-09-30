"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { Button, ConfirmDialog, Input, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { championshipPath } from "@/lib/paths";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import type { ChampionshipDTO } from "@/types/api";

interface FormValues {
  registrationFeeAmount: string;
  yellowCardFine: string;
  redCardFine: string;
}

function toValues(championship: ChampionshipDTO | null): FormValues {
  const rules = championship?.rules;
  return {
    registrationFeeAmount: String(rules?.registrationFeeAmount ?? 0),
    yellowCardFine: String(rules?.yellowCardFine ?? 0),
    redCardFine: String(rules?.redCardFine ?? 0),
  };
}

/** Registration fee and card fines — the "Finanzas y Multas" tab that used to live inside the "Editar torneo" modal. */
export function FinancesManager({ championshipId }: { championshipId: string }) {
  const { current, reload } = useChampionship();
  const toast = useToast();
  const [values, setValues] = useState<FormValues>(() => toValues(current));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(toValues(current));
  const { requestClose, confirmProps } = useUnsavedGuard(dirty, () => setValues(toValues(current)));

  const bind = (field: keyof FormValues) => ({
    value: values[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((prev) => ({ ...prev, [field]: event.target.value })),
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await http<ChampionshipDTO>(`/championships/${championshipId}`, {
        method: "PATCH",
        json: {
          rules: {
            registrationFeeAmount: Number(values.registrationFeeAmount),
            yellowCardFine: Number(values.yellowCardFine),
            redCardFine: Number(values.redCardFine),
          },
        },
      });
      toast.success("Finanzas y multas actualizadas");
      reload();
    } catch (error) {
      if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" style={{ gap: "var(--space-lg)" }} noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}

      <p className="text-secondary text-small">
        Aquí defines los valores. Lo que cada equipo debe y lo que ha pagado se ve en <Link href={championshipPath(championshipId, "sanciones")} className="text-strong">Sanciones → Multas y Cuotas</Link>.
      </p>

      <section className="card stack-sm" style={{ background: "var(--color-background)" }}>
        <h3>Cuota de inscripción por equipo</h3>
        <p className="text-secondary text-small">
          Monto que paga cada club al registrarse. Se genera automáticamente en la gestión financiera del torneo. Déjalo en 0 si la inscripción es gratuita.
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

      <div className="action-bar" style={{ marginTop: "var(--space-lg)" }}>
        <Button variant="secondary" onClick={requestClose} disabled={saving} type="button">Descartar cambios</Button>
        <Button type="submit" loading={saving}>Guardar cambios</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}
