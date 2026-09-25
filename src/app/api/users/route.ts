import { conflict, escapeRegex, json, parseBody, parseQuery, route, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/permissions";
import { loadPublicUser } from "@/lib/services/users";
import { skipFor } from "@/lib/validation/common";
import { userCreateSchema, userListQuery } from "@/lib/validation/schemas";
import { User } from "@/models/User";

export const GET = route(async (request) => {
  const actor = getActor(request);
  requireAdmin(actor);
  const query = parseQuery(request, userListQuery);
  const filter = {
    ...(query.q ? { $or: [{ name: { $regex: escapeRegex(query.q), $options: "i" } }, { email: { $regex: escapeRegex(query.q), $options: "i" } }] } : {}),
    ...(query.isAdmin !== undefined ? { isAdmin: query.isAdmin } : {}),
  };
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name email image isAdmin roleId createdAt")
      .sort({ name: 1 })
      .skip(skipFor(query))
      .limit(query.limit)
      .populate({ path: "roleId", select: "name" })
      .lean(),
    User.countDocuments(filter),
  ]);
  const body: Paginated<(typeof users)[number]> = { data: users, meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});

/** Creates a user without a password: they get one later via "enviar enlace de contraseña" (reuses the reset-password flow). */
export const POST = route(async (request) => {
  const actor = getActor(request);
  requireAdmin(actor);
  const input = await parseBody(request, userCreateSchema);

  if (await User.exists({ email: input.email })) throw conflict("Ya existe un usuario con ese correo", "duplicate");

  const user = await User.create({ name: input.name, email: input.email, roleId: input.roleId || undefined, isAdmin: input.isAdmin ?? false });
  await recordAudit(actor, { action: "create", entityType: "user", entityId: user._id, summary: `Usuario creado: ${user.name} (${user.email})` });
  return json(await loadPublicUser(user._id), 201);
});
