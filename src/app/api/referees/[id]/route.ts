import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { refereeUpdateSchema } from "@/lib/validation/schemas";
import { Match } from "@/models/Match";
import { Referee } from "@/models/Referee";

type Params = { id: string };

export const PATCH = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, refereeUpdateSchema);
  const referee = await Referee.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  if (!referee) throw notFound("Árbitro no encontrado");
  await recordAudit(getActor(request), { action: "update", entityType: "referee", entityId: referee._id, championshipId: referee.championshipId, summary: `Árbitro actualizado: ${referee.fullName}` });
  return json(referee);
});

export const DELETE = route<Params>(async (request, { id }) => {
  const referee = await Referee.findById(id);
  if (!referee) throw notFound("Árbitro no encontrado");
  if (await Match.exists({ refereeId: referee._id })) {
    throw conflict("Este árbitro tiene partidos asignados; desactívalo en lugar de eliminarlo", "referee_has_matches");
  }
  await referee.deleteOne();
  await recordAudit(getActor(request), { action: "delete", entityType: "referee", entityId: referee._id, championshipId: referee.championshipId, summary: `Árbitro eliminado: ${referee.fullName}` });
  return json({ ok: true });
});
