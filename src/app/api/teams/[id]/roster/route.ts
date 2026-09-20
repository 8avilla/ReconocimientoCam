import { json, notFound, parseQuery, route } from "@/lib/api";
import { registrationListQuery } from "@/lib/validation/schemas";
import { Team } from "@/models/Team";
import { TeamRegistration } from "@/models/TeamRegistration";

type Params = { id: string };

/** Roster of a team: registrations with the player identity attached. */
export const GET = route<Params>(async (request, { id }) => {
  const { status } = parseQuery(request, registrationListQuery.pick({ status: true }));
  const team = await Team.exists({ _id: id });
  if (!team) throw notFound("Equipo no encontrado");

  const roster = await TeamRegistration.find({ teamId: id, ...(status ? { status } : {}) })
    .sort({ shirtNumber: 1 })
    .populate({ path: "playerId", select: "publicId fullName documentId photoUrl birthDate" })
    .lean();
  return json({ data: roster });
});
