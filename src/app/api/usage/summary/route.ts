import { json, parseQuery, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireAdmin } from "@/lib/permissions";
import { usageSummaryQuery } from "@/lib/validation/schemas";
import { AuditLog } from "@/models/AuditLog";
import { UsageEvent } from "@/models/UsageEvent";

/** What gets used: the most opened screens and the most frequent changes (from the activity log) in the last N days. */
export const GET = route(async (request) => {
  requireAdmin(getActor(request));
  const { days } = parseQuery(request, usageSummaryQuery);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [views, viewsByRole, actions] = await Promise.all([
    UsageEvent.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$route", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    UsageEvent.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    AuditLog.aggregate<{ _id: { entityType: string; action: string }; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { entityType: "$entityType", action: "$action" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
  ]);

  return json({
    days,
    views: views.map((row) => ({ route: row._id, count: row.count })),
    viewsByRole: Object.fromEntries(viewsByRole.map((row) => [row._id, row.count])),
    actions: actions.map((row) => ({ entityType: row._id.entityType, action: row._id.action, count: row.count })),
  });
});
