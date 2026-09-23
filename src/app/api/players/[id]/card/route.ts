import { json, notFound, parseQuery, route, toObjectId } from "@/lib/api";
import { playerCardQuery } from "@/lib/validation/schemas";
import { IChampionship } from "@/models/Championship";
import { Player } from "@/models/Player";
import { ITeam } from "@/models/Team";
import { LIVE_REGISTRATION_STATUSES, TeamRegistration } from "@/models/TeamRegistration";

type Params = { id: string };

/** Digital ID card data. The QR only encodes `publicId`, never personal data. */
export const GET = route<Params>(async (request, { id }) => {
  const { championshipId } = parseQuery(request, playerCardQuery);
  const player = await Player.findById(id).lean();
  if (!player) throw notFound("Jugador no encontrado");

  const registration = await TeamRegistration.findOne({
    playerId: id,
    status: { $in: LIVE_REGISTRATION_STATUSES },
    ...(championshipId ? { championshipId: toObjectId(championshipId) } : {}),
  })
    .sort({ createdAt: -1 })
    .populate<{ teamId: ITeam }>({ path: "teamId", select: "name shieldUrl primaryColor secondaryColor" })
    .populate<{ championshipId: IChampionship }>({ path: "championshipId", select: "name season logoUrl" })
    .lean();

  return json({
    publicId: player.publicId,
    fullName: player.fullName,
    documentId: player.documentId,
    birthDate: player.birthDate,
    photoUrl: player.photoUrl,
    team: registration?.teamId ?? null,
    championship: registration?.championshipId ?? null,
    shirtNumber: registration?.shirtNumber ?? null,
    position: registration?.position ?? null,
    status: registration?.status ?? "inactive",
    qrPayload: player.publicId,
  });
});
