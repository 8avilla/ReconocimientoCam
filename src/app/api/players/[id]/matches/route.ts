import { json, notFound, parseQuery, route, Paginated } from "@/lib/api";
import { paginationSchema, skipFor } from "@/lib/validation/common";
import { IMatch, Match } from "@/models/Match";
import { MatchCallUp } from "@/models/MatchCallUp";
import { MatchEvent } from "@/models/MatchEvent";
import { Player } from "@/models/Player";
import type { PlayerMatchActivityDTO } from "@/types/api";

type Params = { id: string };

/**
 * Matches this player was called up for, newest first, with their own goals/cards tally per match.
 * No "titular"/minutes-played data yet: the app has no starting-lineup concept to derive it from.
 */
export const GET = route<Params>(async (request, { id }) => {
  const query = parseQuery(request, paginationSchema);
  if (!(await Player.exists({ _id: id }))) throw notFound("Jugador no encontrado");

  const matchIds = await MatchCallUp.distinct("matchId", { playerId: id });
  const [matches, total] = await Promise.all([
    Match.find({ _id: { $in: matchIds } })
      .sort({ scheduledAt: -1, _id: -1 })
      .skip(skipFor(query))
      .limit(query.limit)
      .populate({ path: "championshipId", select: "name season" })
      .populate({ path: "homeTeamId", select: "name shieldUrl" })
      .populate({ path: "awayTeamId", select: "name shieldUrl" })
      .lean<(IMatch & { championshipId: { _id: string; name: string; season: string } })[]>(),
    MatchCallUp.countDocuments({ playerId: id }),
  ]);

  const events = await MatchEvent.find({
    matchId: { $in: matches.map((match) => match._id) },
    playerId: id,
    voided: false,
    type: { $in: ["goal", "penalty_goal", "yellow_card", "red_card"] },
  })
    .select("matchId type")
    .lean();
  const tallyByMatch = new Map<string, { goals: number; yellowCards: number; redCards: number }>();
  for (const event of events) {
    const key = event.matchId.toString();
    const tally = tallyByMatch.get(key) ?? { goals: 0, yellowCards: 0, redCards: 0 };
    if (event.type === "goal" || event.type === "penalty_goal") tally.goals += 1;
    else if (event.type === "yellow_card") tally.yellowCards += 1;
    else if (event.type === "red_card") tally.redCards += 1;
    tallyByMatch.set(key, tally);
  }

  const data: PlayerMatchActivityDTO[] = matches.map((match) => {
    const tally = tallyByMatch.get(match._id.toString()) ?? { goals: 0, yellowCards: 0, redCards: 0 };
    return {
      _id: match._id.toString(),
      scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : null,
      status: match.status,
      championship: match.championshipId as unknown as PlayerMatchActivityDTO["championship"],
      homeTeamId: match.homeTeamId as unknown as PlayerMatchActivityDTO["homeTeamId"],
      awayTeamId: match.awayTeamId as unknown as PlayerMatchActivityDTO["awayTeamId"],
      homeScore: match.homeScore ?? null,
      awayScore: match.awayScore ?? null,
      ...tally,
    };
  });

  const body: Paginated<PlayerMatchActivityDTO> = { data, meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});
