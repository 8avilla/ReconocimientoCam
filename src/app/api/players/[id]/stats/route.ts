import { json, notFound, parseQuery, route, toObjectId } from "@/lib/api";
import { playerCardQuery } from "@/lib/validation/schemas";
import { Match } from "@/models/Match";
import { MatchCallUp } from "@/models/MatchCallUp";
import { MatchEvent } from "@/models/MatchEvent";
import { Player } from "@/models/Player";
import type { PlayerStatsSummaryDTO } from "@/types/api";

type Params = { id: string };

/**
 * Season totals for a player: matches played and their own goals/cards, from finished matches only.
 * No minutes-played total yet: see the note on `/players/[id]/matches` about the missing lineup data.
 */
export const GET = route<Params>(async (request, { id }) => {
  const { championshipId } = parseQuery(request, playerCardQuery);
  if (!(await Player.exists({ _id: id }))) throw notFound("Jugador no encontrado");

  const matchFilter = { status: "finished" as const, ...(championshipId ? { championshipId: toObjectId(championshipId) } : {}) };
  const calledUpMatchIds = await MatchCallUp.distinct("matchId", { playerId: id });
  const finishedMatchIds = (await Match.find({ _id: { $in: calledUpMatchIds }, ...matchFilter }).select("_id").lean()).map((match) => match._id);

  const events = await MatchEvent.find({
    matchId: { $in: finishedMatchIds },
    playerId: id,
    voided: false,
    type: { $in: ["goal", "penalty_goal", "yellow_card", "red_card"] },
  })
    .select("type")
    .lean();

  const body: PlayerStatsSummaryDTO = {
    matchesPlayed: finishedMatchIds.length,
    goals: events.filter((event) => event.type === "goal" || event.type === "penalty_goal").length,
    yellowCards: events.filter((event) => event.type === "yellow_card").length,
    redCards: events.filter((event) => event.type === "red_card").length,
  };
  return json(body);
});
