import { badRequest, json, notFound, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { requireOrganizer } from "@/lib/permissions";
import { Championship } from "@/models/Championship";

type Params = { id: string; userId: string };

/** Removes a co-organizer (not the owner: transfer ownership first, or ask an admin). `userId` may also be a pending invite email. */
export const DELETE = route<Params>(async (request, { id, userId }) => {
  const actor = getActor(request);
  const championship = await Championship.findById(id);
  if (!championship) throw notFound("Campeonato no encontrado");
  requireOrganizer(actor, championship);
  if (championship.ownerUserId?.toString() === userId) throw badRequest("No se puede quitar a la persona dueña del campeonato");

  const before = (championship.organizerUserIds ?? []).length + (championship.organizerInviteEmails ?? []).length;
  championship.organizerUserIds = (championship.organizerUserIds ?? []).filter((organizerId) => organizerId.toString() !== userId);
  championship.organizerInviteEmails = (championship.organizerInviteEmails ?? []).filter((email) => email !== userId);
  if (championship.organizerUserIds.length + championship.organizerInviteEmails.length === before) {
    throw notFound("Esa persona no organiza este campeonato");
  }
  await championship.save();

  await recordAudit(actor, {
    action: "update",
    entityType: "championship",
    entityId: championship._id,
    championshipId: championship._id,
    summary: "Organizador quitado",
  });
  return json(championship);
});
