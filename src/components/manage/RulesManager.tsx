"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { Button, ConfirmDialog, Input, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import type { ChampionshipDTO } from "@/types/api";

interface FormValues {
  maxRosterSize: string;
  minPlayersToStart: string;
  yellowCardsForSuspension: string;
  yellowSuspensionMatches: string;
  redCardSuspensionMatches: string;
  pointsPerWin: string;
  pointsPerDraw: string;
  pointsPerLoss: string;
  walkoverGoals: string;
  periodsCount: string;
  periodLabels: string;
}

function toValues(championship: ChampionshipDTO | null): FormValues {
  const rules = championship?.rules;
  return {
    maxRosterSize: String(rules?.maxRosterSize ?? 25),
    minPlayersToStart: String(rules?.minPlayersToStart ?? 7),
    yellowCardsForSuspension: String(rules?.yellowCardsForSuspension ?? 3),
    yellowSuspensionMatches: String(rules?.yellowSuspensionMatches ?? 1),
    redCardSuspensionMatches: String(rules?.redCardSuspensionMatches ?? 1),
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

/** Roster limits, discipline and scoring rules — the "Reglas" tab that used to live inside the "Editar torneo" modal. */
export function RulesManager({ championshipId }: { championshipId: string }) {
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
            maxRosterSize: Number(values.maxRosterSize),
            minPlayersToStart: Number(values.minPlayersToStart),
            yellowCardsForSuspension: Number(values.yellowCardsForSuspension),
            yellowSuspensionMatches: Number(values.yellowSuspensionMatches),
            redCardSuspensionMatches: Number(values.redCardSuspensionMatches),
            pointsPerWin: Number(values.pointsPerWin),
            pointsPerDraw: Number(values.pointsPerDraw),
            pointsPerLoss: Number(values.pointsPerLoss),
            walkoverGoals: Number(values.walkoverGoals),
            periodsCount: Number(values.periodsCount),
            periodLabels: normalizePeriodLabels(values.periodLabels, Number(values.periodsCount)),
          },
        },
      });
      toast.success("Reglas actualizadas");
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

      <div className="action-bar" style={{ marginTop: "var(--space-lg)" }}>
        <Button variant="secondary" onClick={requestClose} disabled={saving} type="button">Descartar cambios</Button>
        <Button type="submit" loading={saving}>Guardar cambios</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}
