"use client";

import { useChampionship } from "@/components/layout/ChampionshipContext";
import { Badge } from "@/components/ui";
import { CHAMPIONSHIP_FORMAT_LABEL, CHAMPIONSHIP_STATUS_LABEL, formatDate, formatMoney } from "@/lib/labels";

const NO_FINE = "Sin multa";

/** The championship's data and rules at a glance. Use "Editar campeonato" above (in ManageView's hub
 * header) to change them — that's the single edit entry point across the app, so it isn't repeated here. */
export function RulesSummary() {
  const { current } = useChampionship();
  if (!current) return null;
  const rules = current.rules;
  const status = CHAMPIONSHIP_STATUS_LABEL[current.status];

  const groups: { title: string; rows: [string, string][] }[] = [
    {
      title: "Campeonato",
      rows: [
        ["Nombre", `${current.name} · ${current.season}`],
        ["Formato", CHAMPIONSHIP_FORMAT_LABEL[current.format]],
        ["Fechas", `${formatDate(current.startDate)} – ${formatDate(current.endDate)}`],
      ],
    },
    {
      title: "Puntos y plantilla",
      rows: [
        ["Victoria / empate / derrota", `${rules.pointsPerWin} / ${rules.pointsPerDraw} / ${rules.pointsPerLoss} puntos`],
        ["Jugadores por plantilla", `máximo ${rules.maxRosterSize}`],
        ["Mínimo para iniciar un partido", `${rules.minPlayersToStart} jugadores`],
        ["Goles por W.O.", rules.walkoverGoals ? `${rules.walkoverGoals} para el ganador` : "Sin goles, solo la victoria"],
        ["Tiempos del partido", `${rules.periodsCount ?? 2} (${(rules.periodLabels ?? ["1er Tiempo", "2do Tiempo"]).join(", ")})`],
      ],
    },
    {
      title: "Disciplina",
      rows: [
        ["Amarillas para suspensión", `${rules.yellowCardsForSuspension ?? 3} (${rules.yellowSuspensionMatches ?? 1} partido)`],
        ["Tarjeta roja", `${rules.redCardSuspensionMatches ?? 1} partido de suspensión`],
        ["Multa por amarilla", rules.yellowCardFine ? formatMoney(rules.yellowCardFine) : NO_FINE],
        ["Multa por roja", rules.redCardFine ? formatMoney(rules.redCardFine) : NO_FINE],
      ],
    },
  ];

  return (
    <>
      <div className="row" style={{ marginBottom: "var(--space-lg)" }}>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="stack">
        {groups.map((group) => (
          <section key={group.title} className="flush-list" aria-label={group.title}>
            <h2 className="band band-muted band-small">{group.title}</h2>
            {group.rows.map(([label, value]) => (
              <div key={label} className="list-row row-between">
                <span className="text-secondary">{label}</span>
                <span className="text-strong" style={{ textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
