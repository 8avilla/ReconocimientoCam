import { conflict, json, parseBody, parseQuery, route, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/permissions";
import { skipFor } from "@/lib/validation/common";
import { roleCreateSchema, roleListQuery } from "@/lib/validation/schemas";
import { Role } from "@/models/Role";

export const GET = route(async (request) => {
  requireAdmin(getActor(request));
  const query = parseQuery(request, roleListQuery);
  const [roles, total] = await Promise.all([
    Role.find().sort({ name: 1 }).skip(skipFor(query)).limit(query.limit).lean(),
    Role.countDocuments(),
  ]);
  const body: Paginated<(typeof roles)[number]> = { data: roles, meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});

export const POST = route(async (request) => {
  const actor = getActor(request);
  requireAdmin(actor);
  const input = await parseBody(request, roleCreateSchema);

  if (await Role.exists({ name: input.name })) throw conflict("Ya existe un rol con ese nombre", "duplicate");

  const role = await Role.create(input);
  await recordAudit(actor, { action: "create", entityType: "role", entityId: role._id, summary: `Rol creado: ${role.name}` });
  return json(role, 201);
});
