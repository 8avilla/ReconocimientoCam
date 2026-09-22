import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { venueUpdateSchema } from "@/lib/validation/schemas";
import { Venue } from "@/models/Venue";

type Params = { id: string };

export const PATCH = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const input = await parseBody(request, venueUpdateSchema);
  const venue = await Venue.findById(id);
  if (!venue) throw notFound("Sitio no encontrado");
  await requireOrganizerOfChampionship(actor, venue.championshipId);
  if (input.name && input.name !== venue.name && (await Venue.exists({ championshipId: venue.championshipId, name: input.name }))) {
    throw conflict("Ya existe un sitio con ese nombre", "duplicate");
  }
  venue.set(input);
  await venue.save();
  await recordAudit(actor, { action: "update", entityType: "venue", entityId: venue._id, championshipId: venue.championshipId, summary: `Sitio actualizado: ${venue.name}` });
  return json(venue);
});

/** Deleting a venue does not touch the matches already played there: they keep the name they were given. */
export const DELETE = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const existing = await Venue.findById(id).select("championshipId").lean();
  if (!existing) throw notFound("Sitio no encontrado");
  await requireOrganizerOfChampionship(actor, existing.championshipId);
  const venue = await Venue.findByIdAndDelete(id);
  if (!venue) throw notFound("Sitio no encontrado");
  await recordAudit(actor, { action: "delete", entityType: "venue", entityId: venue._id, championshipId: venue.championshipId, summary: `Sitio eliminado: ${venue.name}` });
  return json({ ok: true });
});
