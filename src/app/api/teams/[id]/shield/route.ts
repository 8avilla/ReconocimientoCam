import { json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { deleteImage } from "@/lib/azureBlob";
import { uploadShieldImage } from "@/lib/services/players";
import { imageUploadSchema } from "@/lib/validation/schemas";
import { Team } from "@/models/Team";

type Params = { id: string };

/** Uploads or replaces the team shield (base64 data URL in the body). */
export const POST = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const { image } = await parseBody(request, imageUploadSchema);
  const team = await Team.findById(id);
  if (!team) throw notFound("Equipo no encontrado");
  await requireOrganizerOfChampionship(actor, team.championshipId);

  const uploaded = await uploadShieldImage(image);
  const previousBlob = team.shieldBlobName;
  team.set({ shieldUrl: uploaded.url, shieldBlobName: uploaded.blobName });
  await team.save();

  if (previousBlob) {
    deleteImage(previousBlob).catch((error) => console.error("Failed to delete previous shield:", error));
  }
  await recordAudit(actor, {
    action: "update",
    entityType: "team",
    entityId: team._id,
    championshipId: team.championshipId,
    summary: `Escudo actualizado: ${team.name}`,
  });
  return json({ shieldUrl: team.shieldUrl });
});
