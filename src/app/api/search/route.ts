import { escapeRegex, json, parseQuery, route, toObjectId } from "@/lib/api";
import { searchQuery } from "@/lib/validation/schemas";
import { Match } from "@/models/Match";
import { Player } from "@/models/Player";
import { Team } from "@/models/Team";
import { LIVE_REGISTRATION_STATUSES, TeamRegistration } from "@/models/TeamRegistration";

const LIMIT = 5;

/** Quick search inside a championship: teams by name, players by name or document, matches of the matching teams. */
export const GET = route(async (request) => {
  const { q, championshipId } = parseQuery(request, searchQuery);
  const championship = toObjectId(championshipId);
  const pattern = { $regex: escapeRegex(q), $options: "i" };

  const registrations = await TeamRegistration.find({ championshipId: championship, status: { $in: LIVE_REGISTRATION_STATUSES } })
    .select("playerId teamId shirtNumber")
    .lean();
  const [teams, players] = await Promise.all([
    Team.find({ championshipId: championship, name: pattern }).select("name shieldUrl").sort({ name: 1 }).limit(LIMIT).lean(),
    Player.find({ _id: { $in: registrations.map((registration) => registration.playerId) }, $or: [{ fullName: pattern }, { documentId: pattern }] })
      .select("fullName photoUrl")
      .sort({ fullName: 1 })
      .limit(LIMIT)
      .lean(),
  ]);

  const teamNames = new Map(
    (await Team.find({ _id: { $in: registrations.filter((r) => players.some((p) => p._id.equals(r.playerId))).map((r) => r.teamId) } }).select("name").lean()).map((team) => [team._id.toString(), team.name])
  );
  const registrationByPlayer = new Map(registrations.map((registration) => [registration.playerId.toString(), registration]));

  const matches = teams.length
    ? await Match.find({ championshipId: championship, $or: [{ homeTeamId: { $in: teams.map((team) => team._id) } }, { awayTeamId: { $in: teams.map((team) => team._id) } }] })
        .populate("homeTeamId", "name")
        .populate("awayTeamId", "name")
        .populate("phaseId", "name")
        .populate("matchdayId", "name")
        .sort({ scheduledAt: 1 })
        .limit(LIMIT)
        .lean()
    : [];

  return json({
    teams,
    players: players.map((player) => {
      const registration = registrationByPlayer.get(player._id.toString());
      return {
        _id: player._id,
        fullName: player.fullName,
        photoUrl: player.photoUrl,
        teamName: registration ? teamNames.get(registration.teamId.toString()) ?? null : null,
        shirtNumber: registration?.shirtNumber ?? null,
      };
    }),
    matches: matches.map((match) => {
      const home = match.homeTeamId as unknown as { name: string };
      const away = match.awayTeamId as unknown as { name: string };
      const phase = match.phaseId as unknown as { name: string };
      const matchday = match.matchdayId as unknown as { name: string };
      return { _id: match._id, label: `${home.name} vs ${away.name}`, phase: `${phase.name} · ${matchday.name}`, status: match.status };
    }),
  });
});
