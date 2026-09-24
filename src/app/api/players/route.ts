import { escapeRegex, json, parseBody, parseQuery, route, toObjectId, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { organizedPlayerIds } from "@/lib/permissions";
import { generatePublicId } from "@/lib/services/players";
import { skipFor } from "@/lib/validation/common";
import { playerCreateSchema, playerListQuery } from "@/lib/validation/schemas";
import { Player } from "@/models/Player";
import { Team } from "@/models/Team";
import { LIVE_REGISTRATION_STATUSES, TeamRegistration } from "@/models/TeamRegistration";

/** Lists player identities; optionally restricted to a team or championship roster. */
export const GET = route(async (request) => {
  const actor = getActor(request);
  const query = parseQuery(request, playerListQuery);
  const registrationFilter = {
    status: { $in: LIVE_REGISTRATION_STATUSES },
    ...(query.championshipId ? { championshipId: toObjectId(query.championshipId) } : {}),
    ...(query.teamId ? { teamId: toObjectId(query.teamId) } : {}),
  };

  const filter: Record<string, unknown> = {};
  if (query.q) {
    const pattern = { $regex: escapeRegex(query.q), $options: "i" };
    filter.$or = [{ fullName: pattern }, { documentId: pattern }];
  }
  if (query.teamId || query.championshipId) {
    filter._id = { $in: await TeamRegistration.distinct("playerId", registrationFilter) };
  }

  const [players, total] = await Promise.all([
    Player.find(filter).sort({ fullName: 1 }).skip(skipFor(query)).limit(query.limit).lean(),
    Player.countDocuments(filter),
  ]);

  const registrations = await TeamRegistration.find({
    ...registrationFilter,
    playerId: { $in: players.map((player) => player._id) },
  }).lean();
  const teams = await Team.find({ _id: { $in: registrations.map((registration) => registration.teamId) } })
    .select("name shieldUrl")
    .lean();
  const teamById = new Map(teams.map((team) => [team._id.toString(), team]));
  const registrationByPlayer = new Map(registrations.map((registration) => [registration.playerId.toString(), registration]));

  const organized = await organizedPlayerIds(actor, players.map((player) => player._id.toString()));
  const data = players.map((player) => {
    const registration = registrationByPlayer.get(player._id.toString());
    const { documentId, birthDate, ...rest } = player;
    const sensitive = organized.has(player._id.toString()) ? { documentId, birthDate } : {};
    return {
      ...rest,
      ...sensitive,
      // See [id]/route.ts: `biometricConsentAt` alone, not `photoUrl` — the carnet/profile picture
      // can go empty on its own (its gallery photo got deleted) without the biometric data changing.
      hasFace: Boolean(player.biometricConsentAt),
      registration: registration
        ? { ...registration, team: teamById.get(registration.teamId.toString()) ?? null }
        : null,
    };
  });
  const body: Paginated<(typeof data)[number]> = { data, meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});

export const POST = route(async (request) => {
  const input = await parseBody(request, playerCreateSchema);
  const player = await Player.create({ ...input, publicId: generatePublicId() });
  await recordAudit(getActor(request), {
    action: "create",
    entityType: "player",
    entityId: player._id,
    summary: `Jugador creado: ${player.fullName}`,
  });
  return json(player, 201);
});
