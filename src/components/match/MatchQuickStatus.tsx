"use client";

import { useState } from "react";
import { Button, Select, useToast } from "@/components/ui";
import { MATCH_STATUSES, type MatchStatus } from "@/lib/constants";
import { errorMessage, http } from "@/lib/client/http";
import { MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchDTO } from "@/types/api";

/**
 * One tap to change the match's status, no separate "Editar partido" form needed. Picking "W.O." asks for
 * the winner right here (it can also be changed later the same way, in case of a mistake).
 */
export function MatchQuickStatus({ match, onChanged }: { match: MatchDTO; onChanged: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  // True as soon as "W.O." is picked in the dropdown, even before a winner is confirmed and saved.
  const [pendingWalkover, setPendingWalkover] = useState(false);

  async function save(status: MatchStatus, walkoverWinnerTeamId?: string) {
    setSaving(true);
    try {
      await http(`/matches/${match._id}`, { method: "PATCH", json: { status, ...(walkoverWinnerTeamId ? { walkoverWinnerTeamId } : {}) } });
      toast.success(`Estado: ${MATCH_STATUS_LABEL[status].label}`);
      setPendingWalkover(false);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function handleChange(next: MatchStatus) {
    if (next === "walkover") {
      setPendingWalkover(true);
      return;
    }
    setPendingWalkover(false);
    save(next);
  }

  const showWinnerPicker = pendingWalkover || match.status === "walkover";

  return (
    <div className="stack-sm">
      <Select
        label="Estado del partido"
        value={pendingWalkover ? "walkover" : match.status}
        onChange={(event) => handleChange(event.target.value as MatchStatus)}
        disabled={saving}
      >
        {MATCH_STATUSES.map((item) => <option key={item} value={item}>{MATCH_STATUS_LABEL[item].label}</option>)}
      </Select>
      {showWinnerPicker && (
        <div className="row-wrap" role="group" aria-label="Ganador del W.O." style={{ alignItems: "center", gap: "var(--space-sm)" }}>
          <span className="text-secondary text-small">Ganador:</span>
          <Button
            size="small"
            loading={saving}
            variant={match.walkoverWinnerTeamId?._id === match.homeTeamId._id ? "primary" : "secondary"}
            onClick={() => save("walkover", match.homeTeamId._id)}
          >
            {match.homeTeamId.name}
          </Button>
          <Button
            size="small"
            loading={saving}
            variant={match.walkoverWinnerTeamId?._id === match.awayTeamId._id ? "primary" : "secondary"}
            onClick={() => save("walkover", match.awayTeamId._id)}
          >
            {match.awayTeamId.name}
          </Button>
          {pendingWalkover && match.status !== "walkover" && (
            <Button size="small" variant="ghost" onClick={() => setPendingWalkover(false)}>Cancelar</Button>
          )}
        </div>
      )}
    </div>
  );
}
