import { json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireOrganizer } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { deleteImage } from "@/lib/azureBlob";
import { uploadChampionshipLogo } from "@/lib/services/players";
import { imageUploadSchema } from "@/lib/validation/schemas";
import { Championship } from "@/models/Championship";

type Params = { id: string };

/** Uploads or replaces the championship's logo (base64 data URL in the body). */
export const POST = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const { image } = await parseBody(request, imageUploadSchema);
  const championship = await Championship.findById(id);
  if (!championship) throw notFound("Campeonato no encontrado");
  requireOrganizer(actor, championship);

  const uploaded = await uploadChampionshipLogo(image);
  const previousBlob = championship.logoBlobName;
  championship.set({ logoUrl: uploaded.url, logoBlobName: uploaded.blobName });
  await championship.save();

  if (previousBlob) {
    deleteImage(previousBlob).catch((error) => console.error("Failed to delete previous championship logo:", error));
  }
  await recordAudit(actor, {
    action: "update",
    entityType: "championship",
    entityId: championship._id,
    championshipId: championship._id,
    summary: `Logo actualizado: ${championship.name}`,
  });
  return json({ logoUrl: championship.logoUrl });
});
