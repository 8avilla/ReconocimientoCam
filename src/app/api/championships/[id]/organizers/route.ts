import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { requireOrganizer } from "@/lib/permissions";
import { organizerInviteSchema } from "@/lib/validation/schemas";
import { Championship } from "@/models/Championship";
import { User } from "@/models/User";

type Params = { id: string };

/**
 * Who owns and organizes the championship, with name/email (unlike the public championship object, which
 * only carries ids to avoid leaking emails to visitors) — so only an organizer or admin can call this.
 */
export const GET = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const championship = await Championship.findById(id).select("ownerUserId organizerUserIds organizerInviteEmails").lean();
  if (!championship) throw notFound("Campeonato no encontrado");
  requireOrganizer(actor, championship);

  const organizerUserIds = championship.organizerUserIds ?? [];
  const userIds = [championship.ownerUserId, ...organizerUserIds].filter((value): value is NonNullable<typeof value> => Boolean(value));
  const users = await User.find({ _id: { $in: userIds } }).select("name email image").lean();
  const byId = new Map(users.map((user) => [user._id.toString(), user]));
  const asPerson = (userId: (typeof userIds)[number]) => {
    const found = byId.get(userId.toString());
    return { id: userId.toString(), name: found?.name ?? "(cuenta eliminada)", email: found?.email ?? "", image: found?.image };
  };
  return json({
    owner: championship.ownerUserId ? asPerson(championship.ownerUserId) : null,
    organizers: organizerUserIds.map(asPerson),
    invited: championship.organizerInviteEmails ?? [],
  });
});

/** Adds a co-organizer to the championship, by email. Any current organizer (or admin) can invite another. */
export const POST = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const { email } = await parseBody(request, organizerInviteSchema);
  const championship = await Championship.findById(id);
  if (!championship) throw notFound("Campeonato no encontrado");
  requireOrganizer(actor, championship);

  const user = await User.findOne({ email }).select("_id").lean();
  if (user && championship.ownerUserId?.toString() === user._id.toString()) {
    throw conflict("Esa persona ya es la dueña de este campeonato", "already_owner");
  }
  if (user && (championship.organizerUserIds ?? []).some((organizerId) => organizerId.toString() === user._id.toString())) {
    throw conflict("Esa persona ya organiza este campeonato", "already_organizer");
  }
  if (!user && (championship.organizerInviteEmails ?? []).includes(email)) {
    throw conflict("Ya está invitada; falta que inicie sesión con ese correo", "already_invited");
  }

  if (user) (championship.organizerUserIds ??= []).push(user._id);
  else (championship.organizerInviteEmails ??= []).push(email);
  await championship.save();

  await recordAudit(actor, {
    action: "update",
    entityType: "championship",
    entityId: championship._id,
    championshipId: championship._id,
    summary: user ? `Organizador agregado: ${email}` : `Organizador invitado: ${email}`,
  });
  return json(championship, 201);
});
