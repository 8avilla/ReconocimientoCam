import { json, parseQuery, route, toObjectId, Paginated } from "@/lib/api";
import { auditListQuery } from "@/lib/validation/schemas";
import { skipFor } from "@/lib/validation/common";
import { AuditLog, IAuditLog } from "@/models/AuditLog";

export const GET = route(async (request) => {
  const query = parseQuery(request, auditListQuery);
  const filter = {
    ...(query.championshipId ? { championshipId: toObjectId(query.championshipId) } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: toObjectId(query.entityId) } : {}),
    ...(query.action ? { action: query.action } : {}),
  };
  const [data, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skipFor(query)).limit(query.limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const body: Paginated<IAuditLog> = { data, meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});
