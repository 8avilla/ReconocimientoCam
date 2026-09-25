"use client";

import Link from "next/link";
import { ChevronRight, Layers, MapPin } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { useRole } from "@/components/layout/RoleContext";
import { MATCH_PERIOD_LABEL, MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchDTO } from "@/types/api";

const RESULT = {
  W: { text: "G", name: "Ganó", color: "var(--color-success)" },
  D: { text: "E", name: "Empató", color: "var(--color-text-disabled)" },
  L: { text: "P", name: "Perdió", color: "var(--color-error)" },
} as const;

const shortDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("es", { day: "2-digit", month: "2-digit" }).replace("/", ".") : "—";
const timeOf = (value?: string | null) => (value ? new Date(value).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false }) : null);

/**
 * Compact match list: a header per phase and fecha (in the order received) and one row per match with the date,
 * both teams stacked and the time on the right (or the score once it started). With `teamId` the result of that
 * team is marked G/E/P and its name is bold.
 */
export function MatchList({ matches, teamId }: { matches: MatchDTO[]; teamId?: string }) {
  const { can } = useRole();
  const canOperate = can("match.operate");
  const groups: { key: string; phase: string; sub: string; items: MatchDTO[] }[] = [];
  for (const match of matches) {
    const key = `${match.phaseId?._id}:${match.matchdayId?._id}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(match);
    else groups.push({ key, phase: match.phaseId?.name ?? "Partidos", sub: [match.group, match.matchdayId?.name].filter(Boolean).join(" · "), items: [match] });
  }

  return (
    <div className="flush-list">
      {groups.map((group, index) => (
        <section key={`${group.key}:${index}`} aria-label={`${group.phase} ${group.sub}`}>
          <div className="match-group-head">
            <span className="group-tile" aria-hidden><Layers size={18} /></span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="text-strong truncate">{group.phase}</div>
              {group.sub && <div className="champ-caption">{group.sub}</div>}
            </div>
          </div>
          {group.items.map((match) => {
            const started = match.status === "live" || match.status === "finished" || match.status === "walkover";
            const home = match.homeScore ?? 0;
            const away = match.awayScore ?? 0;
            const mine = match.homeTeamId._id === teamId ? home : away;
            const theirs = match.homeTeamId._id === teamId ? away : home;
            // A walkover's result comes from the recorded winner, not the score (its goals are optional).
            const result = match.walkoverWinnerTeamId
              ? match.walkoverWinnerTeamId._id === teamId ? "W" : "L"
              : mine > theirs ? "W" : mine === theirs ? "D" : "L";
            const status = MATCH_STATUS_LABEL[match.status];
            const finished = match.status === "finished" || match.status === "walkover";
            const winner = finished
              ? match.walkoverWinnerTeamId?._id ?? (home > away ? match.homeTeamId._id : away > home ? match.awayTeamId._id : null)
              : null;
            return (
              <Link key={match._id} href={`/matches/${match._id}`} className={`list-row match-row${match.status === "live" ? " match-row-live" : ""}`}>
                <div className="match-date">
                  {shortDate(match.scheduledAt)}
                  {match.status === "scheduled" && match.venue && (
                    <div className="text-secondary text-small row" style={{ gap: 2, whiteSpace: "nowrap" }}><MapPin size={11} aria-hidden /> {match.venue}</div>
                  )}
                </div>
                <div className="grow stack-sm" style={{ gap: 6, minWidth: 0 }}>
                  {[match.homeTeamId, match.awayTeamId].map((team) => (
                    <div key={team._id} className="row" style={{ gap: 8, minWidth: 0 }}>
                      <Avatar src={team.shieldUrl} name={team.name} size={32} square />
                      <span className={`truncate${team._id === teamId || team._id === winner ? " text-strong" : ""}`}>{team.name}</span>
                    </div>
                  ))}
                </div>
                {started ? (
                  <>
                    <div className="match-score" aria-label={`Marcador ${home} a ${away}`}><span>{home}</span><span>{away}</span></div>
                    {match.status === "live" ? (
                      <Badge tone="error">En vivo · {MATCH_PERIOD_LABEL[match.period]}</Badge>
                    ) : (
                      teamId && <span className="result-chip" style={{ background: RESULT[result].color }} title={RESULT[result].name} aria-label={RESULT[result].name}>{RESULT[result].text}</span>
                    )}
                  </>
                ) : match.status !== "scheduled" ? (
                  <Badge tone={status.tone}>{status.label}</Badge>
                ) : timeOf(match.scheduledAt) ? (
                  <span className="match-time">{timeOf(match.scheduledAt)}</span>
                ) : (
                  <span className="match-time text-secondary" style={{ fontSize: 12 }}>Sin día ni hora</span>
                )}
                {match.status === "live" && canOperate ? (
                  <span className="text-small text-strong row" style={{ gap: 2, color: "var(--color-error)", flexShrink: 0 }}>Registrar <ChevronRight size={14} aria-hidden /></span>
                ) : (
                  <ChevronRight size={18} aria-hidden color="var(--color-text-disabled)" style={{ flexShrink: 0 }} />
                )}
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
