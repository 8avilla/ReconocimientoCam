"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { FaceEnrollment } from "@/components/player/FaceEnrollment";
import { Button, Input, Loading, PageHeader, Select, useToast } from "@/components/ui";
import { POSITIONS, type Position } from "@/lib/constants";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import type { Paginated, PlayerDTO, TeamDTO } from "@/types/api";

type Step = 1 | 2 | 3;
const STEPS = ["Datos", "Foto", "Confirmar"];

interface Values {
  fullName: string;
  documentId: string;
  birthDate: string;
  teamId: string;
  shirtNumber: string;
  position: Position;
}

export function NewPlayerWizard({ initialTeamId }: { initialTeamId: string }) {
  return (
    <RequireChampionship>
      {(championship) => <Wizard championshipId={championship._id} initialTeamId={initialTeamId} />}
    </RequireChampionship>
  );
}

function Wizard({ championshipId, initialTeamId }: { championshipId: string; initialTeamId: string }) {
  const router = useRouter();
  const toast = useToast();
  const teams = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${championshipId}&active=true&limit=100`);

  const [step, setStep] = useState<Step>(1);
  const [values, setValues] = useState<Values>({
    fullName: "", documentId: "", birthDate: "", teamId: initialTeamId, shirtNumber: "", position: "Delantero",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [consent, setConsent] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const teamOptions = teams.data?.data ?? [];
  const selectedTeam = teamOptions.find((team) => team._id === values.teamId);

  const set = (field: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  function goToPhoto() {
    const next: Record<string, string> = {};
    if (!values.fullName.trim()) next.fullName = "Este campo es obligatorio";
    if (!values.documentId.trim()) next.documentId = "Este campo es obligatorio";
    if (!values.birthDate) next.birthDate = "Este campo es obligatorio";
    if (!values.teamId) next.teamId = "Selecciona un equipo";
    if (values.shirtNumber === "" || !Number.isInteger(Number(values.shirtNumber)) || Number(values.shirtNumber) < 0) {
      next.shirtNumber = "Ingresa un número de camiseta válido";
    }
    setErrors(next);
    if (Object.keys(next).length === 0) setStep(2);
  }

  async function handleSave() {
    setSaving(true);
    setFormError("");
    let playerId: string | null = null;
    try {
      const player = await http<PlayerDTO>("/players", {
        json: { fullName: values.fullName.trim(), documentId: values.documentId.trim(), birthDate: values.birthDate },
      });
      playerId = player._id;
      await http("/registrations", {
        json: { teamId: values.teamId, playerId, shirtNumber: Number(values.shirtNumber), position: values.position },
      });
    } catch (error) {
      // Roll back the identity so a failed registration does not leave an orphan player behind.
      if (playerId) await http(`/players/${playerId}`, { method: "DELETE" }).catch(() => undefined);
      if (error instanceof HttpError && error.code === "duplicate") setErrors({ documentId: "El documento ya está registrado" });
      else if (error instanceof HttpError && error.code === "shirt_number_taken") setErrors({ shirtNumber: error.message });
      else if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
      setStep(1);
      setSaving(false);
      return;
    }

    if (image) {
      try {
        await http(`/players/${playerId}/face`, { json: { image, consent: true } });
        toast.success("Jugador registrado correctamente");
      } catch (error) {
        toast.error(`Jugador registrado, pero no se pudo guardar el rostro: ${errorMessage(error)}`);
      }
    } else {
      toast.success("Jugador registrado. Falta registrar su rostro.");
    }
    router.push(`/players/${playerId}`);
  }

  return (
    <>
      <PageHeader
        title="Registro de jugador"
        breadcrumb={[{ label: "Jugadores", href: "/players" }, { label: "Nuevo jugador" }]}
      />

      <div className="card featured stack" style={{ maxWidth: 720 }}>
        <ol className="stepper" style={{ listStyle: "none" }} aria-label="Progreso del registro">
          {STEPS.map((label, index) => {
            const number = index + 1;
            const state = number < step ? "done" : number === step ? "current" : "";
            return (
              <li key={label} className={`step ${state}`} aria-current={number === step ? "step" : undefined}>
                <span className="dot">{number < step ? <Check size={16} aria-hidden /> : number}</span>
                {label}
              </li>
            );
          })}
        </ol>

        {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}

        {step === 1 && (
          <form className="stack" noValidate onSubmit={(event) => { event.preventDefault(); goToPhoto(); }}>
            <Input label="Nombre completo" required autoComplete="off" value={values.fullName} onChange={set("fullName")} error={errors.fullName} />
            <div className="form-grid two">
              <Input label="Documento" required autoComplete="off" inputMode="numeric" value={values.documentId} onChange={set("documentId")} error={errors.documentId} />
              <Input label="Fecha de nacimiento" required type="date" value={values.birthDate} onChange={set("birthDate")} error={errors.birthDate} max={new Date().toISOString().slice(0, 10)} />
            </div>
            {teams.loading && !teams.data ? (
              <Loading />
            ) : (
              <Select label="Equipo" required value={values.teamId} onChange={set("teamId")} error={errors.teamId}>
                <option value="">Selecciona un equipo</option>
                {teamOptions.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
              </Select>
            )}
            <div className="form-grid two">
              <Input label="Número de camiseta" required type="number" min={0} max={999} inputMode="numeric" value={values.shirtNumber} onChange={set("shirtNumber")} error={errors.shirtNumber} />
              <Select label="Posición" value={values.position} onChange={set("position")}>
                {POSITIONS.map((position) => <option key={position} value={position}>{position}</option>)}
              </Select>
            </div>
            <div className="action-bar">
              <Button size="large" type="submit">Siguiente</Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="stack">
            <FaceEnrollment image={image} consent={consent} onConsentChange={(value) => { setConsent(value); if (!value) setImage(null); }} onImageChange={setImage} />
            <div className="action-bar">
              <Button variant="secondary" onClick={() => setStep(1)}>Atrás</Button>
              {image ? (
                <Button size="large" onClick={() => setStep(3)}>Siguiente</Button>
              ) : (
                <Button variant="ghost" onClick={() => setStep(3)}>Registrar sin foto (completar después)</Button>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="stack">
            <dl className="stack-sm">
              <SummaryRow label="Nombre" value={values.fullName} />
              <SummaryRow label="Documento" value={values.documentId} />
              <SummaryRow label="Fecha de nacimiento" value={values.birthDate} />
              <SummaryRow label="Equipo" value={selectedTeam?.name ?? "—"} />
              <SummaryRow label="Camiseta" value={`#${values.shirtNumber} · ${values.position}`} />
              <SummaryRow label="Rostro" value={image ? "Capturado" : "Pendiente"} />
            </dl>
            {!image && (
              <div className="alert warning" role="note">
                <AlertCircle size={18} /> Sin foto no se podrá verificar la identidad del jugador en los partidos.
              </div>
            )}
            <div className="action-bar">
              <Button variant="secondary" onClick={() => setStep(2)} disabled={saving}>Atrás</Button>
              <Button size="large" onClick={handleSave} loading={saving}>Guardar jugador</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row-between">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-strong">{value}</dd>
    </div>
  );
}
