import { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { AuditLog, AuditAction, AuditEntityType } from "@/models/AuditLog";

export interface AuditEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: Types.ObjectId | string;
  championshipId?: Types.ObjectId | string;
  summary: string;
  changes?: Record<string, unknown>;
}

/**
 * Appends an audit entry. A failure to audit is logged but never masks the outcome of the
 * operation that already succeeded.
 */
export async function recordAudit(actor: Actor, entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      championshipId: entry.championshipId,
      summary: entry.summary,
      changes: entry.changes,
      actorName: actor.name,
      actorUserId: actor.userId,
      actorRole: actor.role,
    });
  } catch (error) {
    console.error(`Failed to write audit log for ${entry.entityType} ${entry.action}:`, error);
  }
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return value.toString();
  return value;
}

/** Returns { field: { from, to } } for the keys whose values differ. */
export function diffChanges<T extends object>(
  before: T,
  after: Partial<T>,
  keys: readonly (keyof T & string)[]
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    if (!(key in after)) continue;
    const from = normalize(before[key]);
    const to = normalize(after[key]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}
