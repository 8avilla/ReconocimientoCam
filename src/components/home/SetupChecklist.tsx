import Link from "next/link";
import { Check } from "lucide-react";
import { championshipPath } from "@/lib/paths";
import type { OverviewDTO } from "@/types/api";

interface Step {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  href: string;
  action: string;
}

/** Guided setup: create phases, pick teams, generate the calendar, set days and times. Hidden once everything is done. */
export function SetupChecklist({ championshipId, overview }: { championshipId: string; overview: OverviewDTO }) {
  const { setup } = overview;
  const steps: Step[] = [
    { id: "phases", title: "Crear las fases", hint: "Liga, grupos o eliminatoria: tú decides cómo se juega.", done: setup.phases > 0, href: championshipPath(championshipId, "gestionar"), action: "Crear fases" },
    { id: "teams", title: "Elegir los equipos de cada fase", hint: "Marca qué equipos juegan en cada fase.", done: setup.phases > 0 && setup.phasesWithTeams === setup.tablePhases, href: championshipPath(championshipId, "gestionar"), action: "Elegir equipos" },
    { id: "calendar", title: "Generar el calendario", hint: "Crea los partidos de cada fase; los organizas en fechas.", done: setup.tablePhases > 0 && setup.phasesWithCalendar === setup.tablePhases, href: championshipPath(championshipId, "gestionar"), action: "Generar calendario" },
    { id: "schedule", title: "Programar días y horas", hint: "Asigna cuándo y dónde se juega cada partido; puedes cambiarlo cuando quieras.", done: setup.matches > 0 && overview.unscheduledMatches === 0, href: championshipPath(championshipId, "partidos", "?programacion=sin"), action: "Programar" },
  ];
  const completed = steps.filter((step) => step.done).length;
  if (completed === steps.length) return null;
  const next = steps.find((step) => !step.done);

  return (
    <section className="card stack" aria-label="Configuración del campeonato">
      <div className="row-between">
        <h2>Configura tu campeonato</h2>
        <span className="text-secondary text-small">{completed} de {steps.length}</span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Pasos completados">
        <span style={{ width: `${(completed / steps.length) * 100}%` }} />
      </div>
      <ol className="checklist">
        {steps.map((step, index) => (
          <li key={step.id} className={`check-step${step.done ? " done" : ""}${step === next ? " current" : ""}`}>
            <span className="check-dot" aria-hidden>{step.done ? <Check size={16} /> : index + 1}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="text-strong">{step.title}</div>
              {step === next && <div className="text-secondary text-small">{step.hint}</div>}
            </div>
            {step === next && <Link href={step.href} className="btn primary small">{step.action}</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}
