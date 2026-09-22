"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";

const NUDGE_SECONDS = 60;

function format(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Floating stopwatch for the match: independent from the match's status/events, lives only in this
 * browser tab (it does not sync between devices). Any discipline can set how many periods it has and
 * what they're called (championship rules); this widget just times whichever one is selected.
 */
export function MatchClock({ periodLabels }: { periodLabels: string[] }) {
  const labels = periodLabels.length > 0 ? periodLabels : ["Tiempo 1"];
  const [periodIndex, setPeriodIndex] = useState(0);
  const [secondsByPeriod, setSecondsByPeriod] = useState<number[]>(() => labels.map(() => 0));
  const [running, setRunning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If the championship's period count changes while this is open, don't point past the new last one.
  const clampedIndex = Math.min(periodIndex, labels.length - 1);
  const seconds = secondsByPeriod[clampedIndex] ?? 0;

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsByPeriod((current) => current.map((value, index) => (index === clampedIndex ? value + 1 : value)));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, clampedIndex]);

  function changePeriod(delta: number) {
    setRunning(false);
    setPeriodIndex(Math.min(Math.max(clampedIndex + delta, 0), labels.length - 1));
  }

  function nudge(delta: number) {
    setSecondsByPeriod((current) => current.map((value, index) => (index === clampedIndex ? Math.max(0, value + delta) : value)));
  }

  function reset() {
    setRunning(false);
    setSecondsByPeriod((current) => current.map((value, index) => (index === clampedIndex ? 0 : value)));
  }

  return (
    <>
      <button
        type="button"
        className="fab match-clock-fab"
        aria-label={panelOpen ? "Cerrar cronómetro" : "Abrir cronómetro"}
        onClick={() => setPanelOpen((value) => !value)}
      >
        <Timer size={22} />
      </button>

      {panelOpen && (
        <>
          <div className="match-clock-backdrop" onClick={() => setPanelOpen(false)} />
          <div className="match-clock-panel" role="dialog" aria-label="Cronómetro">
            <div className="row-between">
              <button type="button" className="icon-button" aria-label="Tiempo anterior" disabled={clampedIndex === 0} onClick={() => changePeriod(-1)}>
                <ChevronLeft size={20} />
              </button>
              <span className="text-strong">{labels[clampedIndex]}</span>
              <button type="button" className="icon-button" aria-label="Tiempo siguiente" disabled={clampedIndex === labels.length - 1} onClick={() => changePeriod(1)}>
                <ChevronRight size={20} />
              </button>
              <button type="button" className="icon-button" aria-label="Cerrar" onClick={() => setPanelOpen(false)} style={{ marginLeft: "var(--space-sm)" }}>
                <X size={18} />
              </button>
            </div>

            <div className="match-clock-display-row">
              <button type="button" className="icon-button" aria-label="Restar un minuto" onClick={() => nudge(-NUDGE_SECONDS)}>−</button>
              <button type="button" className="match-clock-display" onClick={() => setEditOpen(true)} aria-label="Escribir el tiempo exacto">
                {format(seconds)}
              </button>
              <button type="button" className="icon-button" aria-label="Sumar un minuto" onClick={() => nudge(NUDGE_SECONDS)}>+</button>
            </div>

            <div className="row" style={{ justifyContent: "center", gap: "var(--space-md)" }}>
              <Button size="large" icon={running ? <Pause size={20} /> : <Play size={20} />} onClick={() => setRunning((value) => !value)}>
                {running ? "Pausar" : "Iniciar"}
              </Button>
              <Button variant="secondary" size="large" icon={<RotateCcw size={20} />} onClick={reset}>Reiniciar</Button>
            </div>
          </div>
        </>
      )}

      <Modal open={editOpen} title="Cronómetro de juego" onClose={() => setEditOpen(false)}>
        <EditClockForm
          seconds={seconds}
          onCancel={() => setEditOpen(false)}
          onSave={(next) => {
            setSecondsByPeriod((current) => current.map((value, index) => (index === clampedIndex ? next : value)));
            setEditOpen(false);
          }}
        />
      </Modal>
    </>
  );
}

function EditClockForm({ seconds, onCancel, onSave }: { seconds: number; onCancel: () => void; onSave: (seconds: number) => void }) {
  const [minutes, setMinutes] = useState(String(Math.floor(seconds / 60)));
  const [secs, setSecs] = useState(String(seconds % 60));

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        const total = Math.max(0, Number(minutes) || 0) * 60 + Math.min(59, Math.max(0, Number(secs) || 0));
        onSave(total);
      }}
    >
      <div className="form-grid two">
        <Input label="Minutos" type="number" min={0} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <Input label="Segundos" type="number" min={0} max={59} inputMode="numeric" value={secs} onChange={(e) => setSecs(e.target.value)} />
      </div>
      <div className="action-bar">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Guardar</Button>
      </div>
    </form>
  );
}
