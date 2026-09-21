"use client";

import { useState } from "react";
import { AlertCircle, Shuffle } from "lucide-react";
import { Avatar, Button, ErrorState, Loading, Modal, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import type { MatchDTO, Paginated, PhaseDTO, TeamDTO } from "@/types/api";

interface Props {
  open: boolean;
  phase: PhaseDTO;
  onClose: () => void;
  onSaved: () => void;
}

export function PhaseTeamsModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={`Equipos · ${props.phase.name}`} onClose={props.onClose} wide>
      <PhaseTeams key={props.phase._id} {...props} />
    </Modal>
  );
}

const groupNames = (count: number) => Array.from({ length: count }, (_, index) => `Grupo ${String.fromCharCode(65 + index)}`);

function PhaseTeams({ phase, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const teams = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${phase.championshipId}&active=true&limit=100`);
  // Teams that already play in the phase cannot be removed or moved to another group, but others can be added.
  const phaseMatches = useFetch<Paginated<MatchDTO>>(phase.matches.total > 0 ? `/matches?phaseId=${phase._id}&limit=100` : null);
  const playing = new Set((phaseMatches.data?.data ?? []).flatMap((match) => [match.homeTeamId._id, match.awayTeamId._id]));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(phase.teamIds));
  // teamId -> group name ("" = no group yet)
  const [assignment, setAssignment] = useState<Record<string, string>>(() =>
    Object.fromEntries(phase.groups.flatMap((group) => group.teamIds.map((teamId) => [teamId, group.name])))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isGroups = phase.type === "groups";
  const hasCalendar = phase.matches.total > 0;
  const names = groupNames(phase.groupCount ?? 0);
  const list = teams.data?.data ?? [];
  const picked = list.filter((team) => selected.has(team._id));
  const ungrouped = isGroups ? picked.filter((team) => !assignment[team._id]).length : 0;

  const buildGroups = () => names.map((name) => ({ name, teamIds: picked.filter((team) => assignment[team._id] === name).map((team) => team._id) }));

  function toggle(teamId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await http(`/phases/${phase._id}/teams`, { method: "PUT", json: { teamIds: [...selected], ...(isGroups ? { groups: buildGroups() } : {}) } });
      toast.success("Equipos de la fase guardados");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function draw() {
    setSaving(true);
    setError("");
    try {
      await http(`/phases/${phase._id}/teams`, { method: "PUT", json: { teamIds: [...selected], groups: buildGroups() } });
      const drawn = await http<PhaseDTO>(`/phases/${phase._id}/draw-groups`, { method: "POST" });
      setAssignment(Object.fromEntries(drawn.groups.flatMap((group) => group.teamIds.map((teamId) => [teamId, group.name]))));
      toast.success("Grupos sorteados. Puedes ajustarlos a mano antes de guardar.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (phaseMatches.error) return <ErrorState message={phaseMatches.error.message} onRetry={phaseMatches.reload} />;
  if (teams.error) return <ErrorState message={teams.error.message} onRetry={teams.reload} />;
  if (!teams.data || (hasCalendar && !phaseMatches.data)) return <Loading />;

  return (
    <div className="stack">
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}
      {hasCalendar && (
        <div className="alert info" role="note">
          <AlertCircle size={18} /> La fase ya tiene calendario. Puedes agregar equipos; después usa «Generar calendario» para crear los partidos que les faltan. Los equipos que ya tienen partidos no se pueden quitar ni cambiar de grupo.
        </div>
      )}

      <div className="row-between">
        <span className="text-strong">{selected.size} equipos seleccionados</span>
        <div className="row-wrap">
          <Button variant="ghost" size="small" onClick={() => setSelected(new Set(list.map((team) => team._id)))}>Todos</Button>
          <Button variant="ghost" size="small" onClick={() => setSelected(new Set(list.filter((team) => playing.has(team._id)).map((team) => team._id)))}>Ninguno</Button>
        </div>
      </div>

      {isGroups && (
        <div className="row-between">
          <span className={ungrouped > 0 ? "text-strong" : "text-secondary"} style={ungrouped > 0 ? { color: "var(--color-warning)" } : undefined}>
            {ungrouped > 0 ? `${ungrouped} equipo(s) sin grupo` : names.map((name) => `${name}: ${picked.filter((team) => assignment[team._id] === name).length}`).join(" · ")}
          </span>
          <Button variant="secondary" size="small" icon={<Shuffle size={16} />} loading={saving} disabled={hasCalendar || selected.size < names.length * 2} onClick={draw}>Sortear grupos</Button>
        </div>
      )}

      <div className="card flush" style={{ maxHeight: "50vh", overflowY: "auto" }}>
        {list.length === 0 && <p className="text-secondary" style={{ padding: "var(--space-lg)" }}>El campeonato no tiene equipos activos.</p>}
        {list.map((team) => {
          const checked = selected.has(team._id);
          const fixed = playing.has(team._id);
          return (
            <div key={team._id} className="list-row">
              <label className="row grow" style={{ cursor: fixed ? "not-allowed" : "pointer" }}>
                <input type="checkbox" style={{ width: 20, height: 20, accentColor: "var(--color-primary)" }} checked={checked} disabled={fixed} onChange={() => toggle(team._id)} aria-label={`Incluir a ${team.name}`} />
                <Avatar src={team.shieldUrl} name={team.name} size={36} square />
                <span className="text-strong truncate">{team.name}</span>
                {fixed && <span className="text-secondary text-small">Ya tiene partidos</span>}
              </label>
              {isGroups && checked && (
                <select className="select" style={{ width: "auto", minWidth: 130 }} aria-label={`Grupo de ${team.name}`} disabled={fixed} value={assignment[team._id] ?? ""} onChange={(e) => setAssignment((current) => ({ ...current, [team._id]: e.target.value }))}>
                  <option value="">Sin grupo</option>
                  {names.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cerrar</Button>
        <Button size="large" loading={saving} onClick={save}>Guardar equipos</Button>
      </div>
    </div>
  );
}
