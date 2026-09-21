"use client";

import { useState } from "react";
import { AlertCircle, Plus, Trash2, Wand2 } from "lucide-react";
import { Button, ErrorState, Loading, Modal, Select, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { orderFromTables, randomPairs, seedPairs, sequentialPairs, type TiePair } from "@/lib/rules/knockout";
import type { BracketDTO, BracketRoundDTO, Paginated, PhaseDTO, PhaseStandingsDTO, TeamDTO } from "@/types/api";

interface Props {
  open: boolean;
  bracket: BracketDTO;
  round: BracketRoundDTO;
  /** The round played just before this one, source of the "winners / losers" proposals. */
  previousRound?: BracketRoundDTO;
  onClose: () => void;
  onSaved: () => void;
}

export function TiesEditorModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={`Cruces · ${props.round.name}`} onClose={props.onClose} wide>
      <TiesEditor key={props.round._id} {...props} />
    </Modal>
  );
}

const BYE = "bye";
interface Row {
  home: string;
  away: string; // team id, "" (not chosen) or BYE
}

const toRows = (pairs: TiePair[]): Row[] => pairs.map(([home, away]) => ({ home, away: away ?? BYE }));

function TiesEditor({ bracket, round, previousRound, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const teams = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${bracket.phase.championshipId}&limit=100`);
  const phases = useFetch<{ data: PhaseDTO[] }>(`/championships/${bracket.phase.championshipId}/phases`);
  const [rows, setRows] = useState<Row[]>(() => round.ties.map((tie) => ({ home: tie.homeTeam?._id ?? "", away: tie.bye ? BYE : tie.awayTeam?._id ?? "" })));
  const [seedPhase, setSeedPhase] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Ties cannot change once the round has matches.
  const locked = round.ties.some((tie) => tie.matches.length > 0);

  const inPhase = new Set(bracket.phase.teamIds);
  const options = (teams.data?.data ?? []).filter((team) => inPhase.has(team._id));
  const name = (id: string) => options.find((team) => team._id === id)?.name ?? "";

  const used = rows.flatMap((row) => [row.home, row.away]).filter((id) => id && id !== BYE);
  const duplicated = used.length !== new Set(used).size;
  const incomplete = rows.some((row) => !row.home || !row.away);

  const setRow = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  // ----- optional proposals: they only fill the draft; the organizer reviews and saves -----
  const decided = previousRound ? previousRound.ties.every((tie) => tie.winnerTeamId) : false;
  const winners = previousRound?.ties.map((tie) => tie.winnerTeamId).filter(Boolean) as string[] | undefined;
  const losers = previousRound?.ties
    .filter((tie) => tie.winnerTeamId && tie.awayTeam && !tie.bye)
    .map((tie) => (tie.winnerTeamId === tie.homeTeam?._id ? tie.awayTeam!._id : tie.homeTeam!._id));

  async function proposeFromStandings() {
    if (!seedPhase) return;
    try {
      const standings = await http<PhaseStandingsDTO>(`/phases/${seedPhase}/standings`);
      const ordered = orderFromTables(standings.tables.map((table) => table.rows)).filter((id) => inPhase.has(id));
      setRows(toRows(seedPairs(ordered)));
      toast.success("Propuesta cargada: revisa los cruces y guarda cuando estés conforme");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await http(`/phases/${bracket.phase._id}/rounds/${round._id}/ties`, {
        method: "PUT",
        json: { ties: rows.map((row) => ({ homeTeamId: row.home, awayTeamId: row.away === BYE ? null : row.away })) },
      });
      toast.success("Cruces guardados");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (teams.error) return <ErrorState message={teams.error.message} onRetry={teams.reload} />;
  if (!teams.data) return <Loading />;

  const seedSources = (phases.data?.data ?? []).filter((phase) => phase.type !== "knockout" && phase._id !== bracket.phase._id);
  return (
    <div className="stack">
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}
      {locked && (
        <div className="alert info" role="note">
          <AlertCircle size={18} /> La ronda ya tiene partidos: los cruces no se pueden cambiar. Elimina primero sus partidos si necesitas modificarlos.
        </div>
      )}
      <p className="text-secondary">Tú defines quién juega contra quién. Las ayudas de abajo son opcionales: solo rellenan el borrador y nada se guarda hasta que pulses <strong>Guardar cruces</strong>.</p>

      <details className="card" hidden={locked}>
        <summary className="text-strong" style={{ cursor: "pointer", minHeight: 32 }}><Wand2 size={16} aria-hidden style={{ verticalAlign: "-3px" }} /> Ayudas opcionales para proponer los cruces</summary>
        <div className="stack" style={{ marginTop: "var(--space-md)" }}>
          <div className="row-wrap">
            <Button variant="secondary" size="small" onClick={() => setRows(toRows(randomPairs(options.map((team) => team._id))))}>Sortear al azar entre los equipos de la fase</Button>
          </div>
          {previousRound && (
            <div className="row-wrap">
              <Button variant="secondary" size="small" disabled={!decided || !winners?.length} onClick={() => setRows(toRows(sequentialPairs(winners!)))}>Ganadores de {previousRound.name}</Button>
              <Button variant="secondary" size="small" disabled={!decided || !losers?.length} onClick={() => setRows(toRows(sequentialPairs(losers!)))}>Perdedores de {previousRound.name}</Button>
              {!decided && <span className="text-secondary text-small">Define primero todos los ganadores de {previousRound.name}.</span>}
            </div>
          )}
          {seedSources.length > 0 && (
            <div className="row-wrap" style={{ alignItems: "flex-end" }}>
              <div className="grow" style={{ minWidth: 200 }}>
                <Select label="Mejor contra peor, según la tabla de" value={seedPhase} onChange={(e) => setSeedPhase(e.target.value)}>
                  <option value="">Elige una fase</option>
                  {seedSources.map((phase) => <option key={phase._id} value={phase._id}>{phase.name}</option>)}
                </Select>
              </div>
              <Button variant="secondary" disabled={!seedPhase} onClick={proposeFromStandings}>Proponer</Button>
            </div>
          )}
        </div>
      </details>

      <div className="stack-sm">
        {rows.length === 0 && <p className="text-secondary">Aún no hay cruces. Agrega uno o usa una ayuda.</p>}
        {rows.map((row, index) => (
          <div key={index} className="row" style={{ alignItems: "flex-end" }}>
            <div className="grow"><Select label={`Cruce ${index + 1} · Local`} disabled={locked} value={row.home} onChange={(e) => setRow(index, { home: e.target.value })}>
              <option value="">Selecciona</option>
              {options.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
            </Select></div>
            <div className="grow"><Select label="Visitante" disabled={locked} value={row.away} onChange={(e) => setRow(index, { away: e.target.value })}>
              <option value="">Selecciona</option>
              <option value={BYE}>Descansa (avanza sin jugar)</option>
              {options.filter((team) => team._id !== row.home).map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
            </Select></div>
            <button className="icon-button" disabled={locked} onClick={() => setRows((current) => current.filter((_, position) => position !== index))} aria-label={`Quitar el cruce ${index + 1}`}><Trash2 size={20} /></button>
          </div>
        ))}
        <div><Button variant="ghost" size="small" icon={<Plus size={16} />} disabled={locked} onClick={() => setRows((current) => [...current, { home: "", away: "" }])}>Agregar cruce</Button></div>
      </div>

      {duplicated && <div className="alert warning" role="alert"><AlertCircle size={18} /> Un equipo no puede estar en dos cruces de la misma ronda.</div>}
      {rows.length > 0 && !duplicated && !incomplete && (
        <p className="text-secondary text-small">{rows.filter((row) => row.away !== BYE).map((row) => `${name(row.home)} vs ${name(row.away)}`).join(" · ")}</p>
      )}

      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button size="large" loading={saving} disabled={locked || duplicated || incomplete} onClick={save}>Guardar cruces</Button>
      </div>
    </div>
  );
}
