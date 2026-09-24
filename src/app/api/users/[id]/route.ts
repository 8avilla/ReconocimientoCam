import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { diffChanges, recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/permissions";
import { loadPublicUser } from "@/lib/services/users";
import { userUpdateSchema } from "@/lib/validation/schemas";
import { IUser, User } from "@/models/User";

type Params = { id: string };

export const GET = route<Params>(async (request, { id }) => {
  requireAdmin(getActor(request));
  const user = await loadPublicUser(id);
  if (!user) throw notFound("Usuario no encontrado");
  return json(user);
});

export const PATCH = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  requireAdmin(actor);
  const input = await parseBody(request, userUpdateSchema);
  const user = await User.findById(id);
  if (!user) throw notFound("Usuario no encontrado");

  // Demoting yourself would immediately lock you out of the panel you're using to do it.
  if (input.isAdmin === false && user._id.toString() === actor.userId) {
    throw conflict("No puedes quitarte tu propio acceso de administrador", "self_demote");
  }
  if (input.isAdmin === false && user.isAdmin && (await User.countDocuments({ isAdmin: true })) <= 1) {
    throw conflict("Debe quedar al menos un administrador", "last_admin");
  }

  const before = user.toObject() as IUser;
  const { roleId, ...rest } = input;
  user.set(rest);
  if (roleId !== undefined) user.set("roleId", roleId ?? undefined);
  await user.save();

  const changes = diffChanges(before, input as Partial<IUser>, ["name", "roleId", "isAdmin"]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(actor, { action: "update", entityType: "user", entityId: user._id, summary: `Usuario actualizado: ${user.name}`, changes });
  }
  return json(await loadPublicUser(user._id));
});

export const DELETE = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  requireAdmin(actor);
  const user = await User.findById(id);
  if (!user) throw notFound("Usuario no encontrado");

  if (user._id.toString() === actor.userId) throw conflict("No puedes eliminar tu propia cuenta", "self_delete");
  if (user.isAdmin && (await User.countDocuments({ isAdmin: true })) <= 1) {
    throw conflict("Debe quedar al menos un administrador", "last_admin");
  }

  await user.deleteOne();
  await recordAudit(actor, { action: "delete", entityType: "user", entityId: user._id, summary: `Usuario eliminado: ${user.name} (${user.email})` });
  return json({ ok: true });
});
