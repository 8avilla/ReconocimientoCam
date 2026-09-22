import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { refereeUpdateSchema } from "@/lib/validation/schemas";
import { Match } from "@/models/Match";
import { Referee } from "@/models/Referee";

type Params = { id: string };

export const PATCH = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const input = await parseBody(request, refereeUpdateSchema);
  const existing = await Referee.findById(id).select("championshipId").lean();
  if (!existing) throw notFound("Árbitro no encontrado");
  await requireOrganizerOfChampionship(actor, existing.championshipId);
  const referee = await Referee.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  if (!referee) throw notFound("Árbitro no encontrado");
  await recordAudit(actor, { action: "update", entityType: "referee", entityId: referee._id, championshipId: referee.championshipId, summary: `Árbitro actualizado: ${referee.fullName}` });
  return json(referee);
});

export const DELETE = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const referee = await Referee.findById(id);
  if (!referee) throw notFound("Árbitro no encontrado");
  await requireOrganizerOfChampionship(actor, referee.championshipId);
  if (await Match.exists({ refereeId: referee._id })) {
    throw conflict("Este árbitro tiene partidos asignados; desactívalo en lugar de eliminarlo", "referee_has_matches");
  }
  await referee.deleteOne();
  await recordAudit(actor, { action: "delete", entityType: "referee", entityId: referee._id, championshipId: referee.championshipId, summary: `Árbitro eliminado: ${referee.fullName}` });
  return json({ ok: true });
});
