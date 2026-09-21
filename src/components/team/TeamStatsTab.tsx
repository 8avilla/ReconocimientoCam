"use client";

import { useState } from "react";
import { Button, ErrorState, Loading } from "@/components/ui";
import { PlayerRanking } from "@/components/stats/StatsView";
import { TeamStandingsTab } from "@/components/team/TeamStandingsTab";
import { useFetch } from "@/lib/client/useFetch";
import type { PlayerStatsDTO } from "@/types/api";

type Section = "general" | "scorers" | "yellow" | "red";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "general", label: "General" },
  { id: "scorers", label: "Anotadores" },
  { id: "yellow", label: "Amarillas" },
  { id: "red", label: "Rojas" },
];

/** Team statistics: the general table (team highlighted) and the team's scorers and cards. */
export function TeamStatsTab({ teamId, championshipId }: { teamId: string; championshipId: string }) {
  const [section, setSection] = useState<Section>("general");
  const stats = useFetch<PlayerStatsDTO>(section === "general" ? null : `/championships/${championshipId}/stats`);
  const mine = (rows: PlayerStatsDTO["scorers"]) => rows.filter((row) => row.teamId === teamId);

  return (
    <div className="stack">
      <div className="row-wrap" role="tablist" aria-label="Estadísticas del equipo" style={{ gap: "var(--space-sm)" }}>
        {SECTIONS.map((item) => (
          <Button key={item.id} role="tab" size="small" aria-selected={section === item.id} variant={section === item.id ? "primary" : "secondary"} onClick={() => setSection(item.id)}>
            {item.label}
          </Button>
        ))}
      </div>

      {section === "general" ? (
        <TeamStandingsTab teamId={teamId} championshipId={championshipId} />
      ) : stats.error ? (
        <ErrorState message={stats.error.message} onRetry={stats.reload} />
      ) : !stats.data ? (
        <Loading />
      ) : section === "scorers" ? (
        <PlayerRanking
          showTeam={false}
          rows={mine(stats.data.scorers)}
          empty="Aún no hay goles registrados de este equipo."
          value={(row) => row.goals}
          unit="goles"
          extra={(row) => (row.assists ? `${row.assists} asist.` : "")}
        />
      ) : section === "yellow" ? (
        <PlayerRanking
          showTeam={false}
          rows={mine(stats.data.cards).filter((row) => row.yellowCards > 0).sort((a, b) => b.yellowCards - a.yellowCards || a.fullName.localeCompare(b.fullName, "es"))}
          empty="Aún no hay tarjetas amarillas de este equipo."
          value={(row) => row.yellowCards}
          unit="amarillas"
          extra={() => ""}
        />
      ) : (
        <PlayerRanking
          showTeam={false}
          rows={mine(stats.data.cards).filter((row) => row.redCards > 0).sort((a, b) => b.redCards - a.redCards || a.fullName.localeCompare(b.fullName, "es"))}
          empty="Aún no hay tarjetas rojas de este equipo."
          value={(row) => row.redCards}
          unit="rojas"
          extra={() => ""}
        />
      )}
    </div>
  );
}
