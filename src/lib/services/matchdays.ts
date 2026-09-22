import type { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { badRequest, conflict, notFound } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { Match } from "@/models/Match";
import { Referee } from "@/models/Referee";
import { IMatchday, Matchday } from "@/models/Matchday";
import { Phase } from "@/models/Phase";
import { assertOrganizerOfPhase } from "@/lib/services/phases";

const isDuplicateKey = (error: unknown) => error instanceof Error && error.message.includes("E11000");

/** Matchdays of a phase with their match counts and the span of their dates. */
export async function listMatchdays(phaseId: string) {
  if (!(await Phase.exists({ _id: phaseId }))) throw notFound("Fase no encontrada");
  const matchdays = await Matchday.find({ phaseId }).sort({ number: 1 }).lean();
  const stats = await Match.aggregate<{ _id: Types.ObjectId; total: number; finished: number; from: Date; to: Date }>([
    { $match: { matchdayId: { $in: matchdays.map((matchday) => matchday._id) } } },
    { $group: { _id: "$matchdayId", total: { $sum: 1 }, finished: { $sum: { $cond: [{ $eq: ["$status", "finished"] }, 1, 0] } }, from: { $min: "$scheduledAt" }, to: { $max: "$scheduledAt" } } },
  ]);
  const byMatchday = new Map(stats.map((row) => [row._id.toString(), row]));
  return matchdays.map((matchday) => {
    const row = byMatchday.get(matchday._id.toString());
    return { ...matchday, matches: { total: row?.total ?? 0, finished: row?.finished ?? 0 }, from: row?.from ?? null, to: row?.to ?? null };
  });
}

export async function createMatchday(actor: Actor, phaseId: string, input: { name?: string; number?: number }) {
  const phase = await Phase.findById(phaseId).lean();
  if (!phase) throw notFound("Fase no encontrada");
  await assertOrganizerOfPhase(actor, phase);
  const last = await Matchday.findOne({ phaseId }).sort({ number: -1 }).select("number").lean();
  const number = input.number ?? (last?.number ?? 0) + 1;
  if (await Matchday.exists({ phaseId, number })) throw conflict(`Ya existe la fecha número ${number} en esta fase`, "duplicate");

  const matchday = await Matchday.create({ championshipId: phase.championshipId, phaseId, number, name: input.name?.trim() || `Fecha ${number}` });
  await recordAudit(actor, { action: "create", entityType: "matchday", entityId: matchday._id, championshipId: phase.championshipId, summary: `Fecha creada: ${matchday.name} (${phase.name})` });
  return matchday;
}

export async function updateMatchday(actor: Actor, id: string, input: { name?: string; number?: number }) {
  const matchday = await Matchday.findById(id);
  if (!matchday) throw notFound("Fecha no encontrada");
  await assertOrganizerOfPhase(actor, matchday);
  if (matchday.roundId && input.number !== undefined && input.number !== matchday.number) {
    throw badRequest("Las fechas de una eliminatoria siguen el orden de sus rondas");
  }
  if (input.number !== undefined && input.number !== matchday.number && (await Matchday.exists({ phaseId: matchday.phaseId, number: input.number }))) {
    throw conflict(`Ya existe la fecha número ${input.number} en esta fase`, "duplicate");
  }
  matchday.set({ ...(input.name ? { name: input.name.trim() } : {}), ...(input.number !== undefined ? { number: input.number } : {}) });
  await matchday.save();
  await recordAudit(actor, { action: "update", entityType: "matchday", entityId: matchday._id, championshipId: matchday.championshipId, summary: `Fecha actualizada: ${matchday.name}`, changes: { ...input } });
  return matchday;
}

export async function deleteMatchday(actor: Actor, id: string) {
  const matchday = await Matchday.findById(id);
  if (!matchday) throw notFound("Fecha no encontrada");
  await assertOrganizerOfPhase(actor, matchday);
  if (await Match.exists({ matchdayId: matchday._id })) throw conflict("La fecha tiene partidos; elimínalos o muévelos a otra fecha primero", "matchday_has_matches");
  await matchday.deleteOne();
  await recordAudit(actor, { action: "delete", entityType: "matchday", entityId: matchday._id, championshipId: matchday.championshipId, summary: `Fecha eliminada: ${matchday.name}` });
}

/** Returns the matchday with that number in the phase, creating it (as "Fecha N") when it does not exist yet. */
export async function ensureMatchday(phase: { _id: Types.ObjectId; championshipId: Types.ObjectId }, number: number): Promise<IMatchday> {
  const existing = await Matchday.findOne({ phaseId: phase._id, number }).lean();
  if (existing) return existing;
  try {
    return (await Matchday.create({ championshipId: phase.championshipId, phaseId: phase._id, number, name: `Fecha ${number}` })).toObject();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return (await Matchday.findOne({ phaseId: phase._id, number }).lean())!; // created concurrently
  }
}

/** Knockout: the matchday that stands for one leg of a round, created on first use. */
export async function ensureKnockoutMatchday(phase: { _id: Types.ObjectId; championshipId: Types.ObjectId }, roundId: Types.ObjectId, leg: 1 | 2, name: string): Promise<IMatchday> {
  const existing = await Matchday.findOne({ phaseId: phase._id, roundId, leg }).lean();
  if (existing) return existing;
  const last = await Matchday.findOne({ phaseId: phase._id }).sort({ number: -1 }).select("number").lean();
  return (await Matchday.create({ championshipId: phase.championshipId, phaseId: phase._id, number: (last?.number ?? 0) + 1, name, roundId, leg })).toObject();
}

/** Every matchday of a championship, in phase order, with the phase name (for filters). */
export async function listChampionshipMatchdays(championshipId: string) {
  const [phases, matchdays] = await Promise.all([
    Phase.find({ championshipId }).select("name order").lean(),
    Matchday.find({ championshipId }).lean(),
  ]);
  const phase = new Map(phases.map((entry) => [entry._id.toString(), entry]));
  return matchdays
    .filter((matchday) => phase.has(matchday.phaseId.toString()))
    .map((matchday) => ({ ...matchday, phaseName: phase.get(matchday.phaseId.toString())!.name, phaseOrder: phase.get(matchday.phaseId.toString())!.order }))
    .sort((a, b) => a.phaseOrder - b.phaseOrder || a.number - b.number);
}

export interface ScheduleEntry {
  matchId: string;
  /** null clears the day and time. */
  scheduledAt: Date | null;
  venue?: string;
  /** null removes the referee; absent leaves it. */
  refereeId?: string | null;
}

/**
 * Sets (or clears) the day, time and venue of several matches of one matchday at once. Dates change
 * often, so this is the quick way to reprogram a whole fecha. Live and finished matches are left alone.
 */
export async function scheduleMatchday(actor: Actor, matchdayId: string, entries: ScheduleEntry[]) {
  const matchday = await Matchday.findById(matchdayId).lean();
  if (!matchday) throw notFound("Fecha no encontrada");
  await assertOrganizerOfPhase(actor, matchday);

  const matches = await Match.find({ matchdayId, _id: { $in: entries.map((entry) => entry.matchId) } }).select("status").lean();
  if (matches.length !== new Set(entries.map((entry) => entry.matchId)).size) throw badRequest("Algún partido no pertenece a esta fecha");
  if (matches.some((match) => match.status === "live" || match.status === "finished")) {
    throw conflict("No se puede reprogramar un partido en juego o finalizado", "match_not_reschedulable");
  }

  const refereeIds = entries.flatMap((entry) => (entry.refereeId ? [entry.refereeId] : []));
  if (refereeIds.length > 0 && (await Referee.countDocuments({ _id: { $in: refereeIds }, championshipId: matchday.championshipId })) !== new Set(refereeIds).size) {
    throw badRequest("Algún árbitro no pertenece a este campeonato");
  }
  await Match.bulkWrite(
    entries.map((entry) => {
      const set: Record<string, unknown> = {};
      const unset: Record<string, ""> = {};
      if (entry.scheduledAt) set.scheduledAt = entry.scheduledAt;
      else unset.scheduledAt = "";
      if (entry.venue !== undefined) set.venue = entry.venue;
      if (entry.refereeId) set.refereeId = entry.refereeId;
      else if (entry.refereeId === null) unset.refereeId = "";
      return {
        updateOne: {
          filter: { _id: entry.matchId, matchdayId: matchday._id },
          update: { ...(Object.keys(set).length > 0 ? { $set: set } : {}), ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
        },
      };
    })
  );
  await recordAudit(actor, {
    action: "update",
    entityType: "matchday",
    entityId: matchday._id,
    championshipId: matchday.championshipId,
    summary: `Programación de ${matchday.name}: ${entries.length} partido(s)`,
    changes: { cleared: entries.filter((entry) => !entry.scheduledAt).length },
  });
  return listMatchdays(matchday.phaseId.toString()).then((all) => all.find((entry) => entry._id.equals(matchday._id)));
}
