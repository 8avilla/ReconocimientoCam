import { Avatar } from "@/components/ui";
import type { MatchEventDTO, SuspensionDTO } from "@/types/api";

interface Team {
  _id: string;
  name: string;
  shieldUrl: string;
}

/** "Juan ×2, Pedro" from a list of names. */
function names(list: string[]): string {
  const counts = new Map<string, number>();
  for (const name of list) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(", ");
}

/** Short recap per team, built from the non-voided events; suspensions only when the match produced some. */
export function MatchSummary({ events, teams, suspensions }: { events: MatchEventDTO[]; teams: [Team, Team]; suspensions: SuspensionDTO[] }) {
  const valid = events.filter((event) => !event.voided && event.playerId);

  const lines = (team: Team) => {
    const opponent = teams.find((other) => other._id !== team._id)!;
    const goals = [
      ...valid.filter((event) => event.teamId === team._id && (event.type === "goal" || event.type === "penalty_goal")).map((event) => event.playerId!.fullName),
      // An own goal by the opponent counts for this team.
      ...valid.filter((event) => event.teamId === opponent._id && event.type === "own_goal").map((event) => `${event.playerId!.fullName} (autogol)`),
    ];
    const cards = (type: string) => valid.filter((event) => event.teamId === team._id && event.type === type).map((event) => event.playerId!.fullName);
    return [
      { label: "Goles", value: names(goals) },
      { label: "Amarillas", value: names(cards("yellow_card")) },
      { label: "Rojas", value: names(cards("red_card")) },
    ];
  };

  return (
    <div className="stack">
      <div className="form-grid two" style={{ alignItems: "start" }}>
        {teams.map((team) => (
          <section key={team._id} className="card stack" aria-label={`Resumen de ${team.name}`}>
            <div className="row"><Avatar src={team.shieldUrl} name={team.name} size={32} square /><h3>{team.name}</h3></div>
            <dl className="stack-sm">
              {lines(team).map((line) => (
                <div key={line.label}>
                  <dt className="text-secondary text-small">{line.label}</dt>
                  <dd>{line.value || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {suspensions.length > 0 && (
        <section className="card stack-sm" aria-label="Suspendidos">
          <h3>Suspendidos</h3>
          <p>{suspensions.map((suspension) => `${suspension.playerId.fullName} (${suspension.teamId.name})`).join(", ")}</p>
        </section>
      )}
    </div>
  );
}
