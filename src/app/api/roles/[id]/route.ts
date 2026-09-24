import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { diffChanges, recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/permissions";
import { roleUpdateSchema } from "@/lib/validation/schemas";
import { IRole, Role } from "@/models/Role";
import { User } from "@/models/User";

type Params = { id: string };

export const GET = route<Params>(async (request, { id }) => {
  requireAdmin(getActor(request));
  const role = await Role.findById(id).lean();
  if (!role) throw notFound("Rol no encontrado");
  return json(role);
});

export const PATCH = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  requireAdmin(actor);
  const input = await parseBody(request, roleUpdateSchema);
  const role = await Role.findById(id);
  if (!role) throw notFound("Rol no encontrado");

  if (input.name && input.name !== role.name && (await Role.exists({ name: input.name, _id: { $ne: role._id } }))) {
    throw conflict("Ya existe un rol con ese nombre", "duplicate");
  }

  const before = role.toObject() as IRole;
  role.set(input);
  await role.save();

  const changes = diffChanges(before, input, ["name", "permissions"]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(actor, { action: "update", entityType: "role", entityId: role._id, summary: `Rol actualizado: ${role.name}`, changes });
  }
  return json(role);
});

export const DELETE = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  requireAdmin(actor);
  const role = await Role.findById(id);
  if (!role) throw notFound("Rol no encontrado");

  if (await User.exists({ roleId: role._id })) throw conflict("Hay usuarios con este rol asignado; quítaselo primero", "role_in_use");

  await role.deleteOne();
  await recordAudit(actor, { action: "delete", entityType: "role", entityId: role._id, summary: `Rol eliminado: ${role.name}` });
  return json({ ok: true });
});
