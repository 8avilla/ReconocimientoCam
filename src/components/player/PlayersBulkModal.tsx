"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Modal, Select, useToast } from "@/components/ui";
import { TextFileButton } from "@/components/ui/TextFileButton";
import { errorMessage, http } from "@/lib/client/http";
import { parseRoster } from "@/lib/client/parseRoster";
import { useFetch } from "@/lib/client/useFetch";
import type { Paginated, PlayerDTO, TeamDTO } from "@/types/api";

interface Props {
  open: boolean;
  championshipId: string;
  /** Team chosen when it opens (from a team's own screen). */
  teamId?: string;
  onClose: () => void;
  /** Called once when the modal closes after registering at least one player. */
  onCreated: () => void;
}

export function PlayersBulkModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Agregar varios jugadores" onClose={props.onClose} wide>
      <PlayersBulk {...props} />
    </Modal>
  );
}

/** Fast roster entry: one player per line ("10 Juan Pérez", "Juan Pérez, 10, Delantero"). Photo and face come later. */
function PlayersBulk({ championshipId, teamId: initialTeamId, onClose, onCreated }: Omit<Props, "open">) {
  const toast = useToast();
  const teams = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${championshipId}&active=true&limit=100`);
  const [teamId, setTeamId] = useState(initialTeamId ?? "");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<{ name: string; message: string }[]>([]);
  const [created, setCreated] = useState(0);

  const lines = parseRoster(text);
  const duplicatedNumbers = new Set(lines.filter((line, index) => line.shirtNumber !== undefined && lines.findIndex((other) => other.shirtNumber === line.shirtNumber) !== index).map((line) => line.shirtNumber));

  async function create() {
    setSaving(true);
    const errors: { name: string; message: string; line: string }[] = [];
    let ok = 0;
    for (const line of lines) {
      let playerId: string | null = null;
      try {
        const player = await http<PlayerDTO>("/players", { json: { fullName: line.fullName } });
        playerId = player._id;
        await http("/registrations", { json: { teamId, playerId, ...(line.shirtNumber !== undefined ? { shirtNumber: line.shirtNumber } : {}), ...(line.position ? { position: line.position } : {}) } });
        ok += 1;
      } catch (error) {
        // Roll back the identity so a failed registration does not leave an orphan player behind.
        if (playerId) await http(`/players/${playerId}`, { method: "DELETE" }).catch(() => undefined);
        errors.push({ name: line.fullName, message: errorMessage(error), line: [line.shirtNumber, line.fullName, line.position].filter((part) => part !== undefined).join(", ") });
      }
    }
    setSaving(false);
    setCreated((current) => current + ok);
    setFailed(errors);
    if (errors.length === 0) {
      toast.success(`${ok} jugadores registrados. Falta registrar sus rostros.`);
      onCreated();
      return;
    }
    setText(errors.map((item) => item.line).join("\n"));
    if (ok > 0) toast.success(`${ok} jugadores registrados; ${errors.length} con problemas`);
  }

  return (
    <div className="stack">
      <p className="text-secondary">Un jugador por línea, con el número y la posición si los tienes: «10 Juan Pérez», «Juan Pérez, 10, Delantero». Las fotos y el rostro se registran después.</p>
      <Select label="Equipo" required value={teamId} onChange={(event) => setTeamId(event.target.value)}>
        <option value="">Selecciona un equipo</option>
        {(teams.data?.data ?? []).map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
      </Select>
      <div className="field">
        <label htmlFor="bulk-players">Jugadores</label>
        <textarea id="bulk-players" className="input" rows={10} autoFocus placeholder={"1 Carlos Díaz\n10 Juan Pérez, Delantero\nLuis Gómez, 7"} value={text} onChange={(event) => setText(event.target.value)} />
        <span className="field-hint">{lines.length} {lines.length === 1 ? "jugador" : "jugadores"} detectados</span>
        <div><TextFileButton onText={(incoming) => setText((current) => (current.trim() ? `${current.trim()}\n${incoming}` : incoming))} /></div>
      </div>
      {duplicatedNumbers.size > 0 && (
        <div className="alert warning" role="note"><AlertCircle size={18} /> Hay números de camiseta repetidos ({[...duplicatedNumbers].join(", ")}): el segundo de cada uno fallará.</div>
      )}
      {failed.length > 0 && (
        <div className="alert error" role="alert">
          <AlertCircle size={18} />
          <span className="grow">{failed.map((item) => `${item.name}: ${item.message}`).join(" · ")}</span>
        </div>
      )}
      <div className="action-bar">
        <Button variant="secondary" onClick={() => { if (created > 0) onCreated(); else onClose(); }} disabled={saving}>{created > 0 ? "Listo" : "Cancelar"}</Button>
        <Button loading={saving} disabled={lines.length === 0 || !teamId} onClick={create}>Registrar {lines.length || ""} {lines.length === 1 ? "jugador" : "jugadores"}</Button>
      </div>
    </div>
  );
}
