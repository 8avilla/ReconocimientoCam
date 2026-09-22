import type mongoose from "mongoose";
import { badRequest, json, notFound, parseBody, parseQuery, route, toObjectId, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { syncMatchCallUps } from "@/lib/services/callups";
import { assertMatchFitsPhase } from "@/lib/services/phases";
import { skipFor } from "@/lib/validation/common";
import { matchCreateSchema, matchListQuery } from "@/lib/validation/schemas";
import { Matchday } from "@/models/Matchday";
import { Phase } from "@/models/Phase";
import { IMatch, Match } from "@/models/Match";
import { Referee } from "@/models/Referee";
import { Team } from "@/models/Team";

export const GET = route(async (request) => {
  const query = parseQuery(request, matchListQuery);
  const conditions: Record<string, unknown>[] = [];
  if (query.championshipId) conditions.push({ championshipId: toObjectId(query.championshipId) });
  if (query.teamId) conditions.push({ $or: [{ homeTeamId: toObjectId(query.teamId) }, { awayTeamId: toObjectId(query.teamId) }] });
  if (query.phaseId) conditions.push({ phaseId: toObjectId(query.phaseId) });
  if (query.matchdayId) conditions.push({ matchdayId: toObjectId(query.matchdayId) });
  if (query.status) conditions.push({ status: query.status });
  if (query.from || query.to) {
    conditions.push({ scheduledAt: { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) } });
  }
  if (query.scheduled === "false") conditions.push({ $or: [{ scheduledAt: { $exists: false } }, { scheduledAt: null }] });
  if (query.scheduled === "true") conditions.push({ scheduledAt: { $exists: true, $ne: null } });
  const filter = conditions.length > 0 ? { $and: conditions } : {};

  // Default order follows the tournament (phase, fecha, then dated matches before undated ones);
  // "date" orders by the calendar, which is what "next match" needs.
  const pipeline: mongoose.PipelineStage[] =
    query.order === "date"
      ? [{ $match: filter }, { $sort: { scheduledAt: 1, _id: 1 } }]
      : [
          { $match: filter },
          { $lookup: { from: Phase.collection.name, localField: "phaseId", foreignField: "_id", as: "_phase" } },
          { $lookup: { from: Matchday.collection.name, localField: "matchdayId", foreignField: "_id", as: "_matchday" } },
          {
            $addFields: {
              _phaseOrder: { $ifNull: [{ $arrayElemAt: ["$_phase.order", 0] }, 0] },
              _matchdayNumber: { $ifNull: [{ $arrayElemAt: ["$_matchday.number", 0] }, 0] },
              _undated: { $cond: [{ $ifNull: ["$scheduledAt", false] }, 0, 1] },
            },
          },
          { $sort: { _phaseOrder: 1, _matchdayNumber: 1, _undated: 1, scheduledAt: 1, _id: 1 } },
        ];
  const [docs, total] = await Promise.all([
    Match.aggregate([...pipeline, { $skip: skipFor(query) }, { $limit: query.limit }, { $project: { _phase: 0, _matchday: 0, _phaseOrder: 0, _matchdayNumber: 0, _undated: 0 } }]),
    Match.countDocuments(filter),
  ]);
  const data = await Match.populate(docs, [
    { path: "phaseId", select: "name type" },
    { path: "matchdayId", select: "name number" },
    { path: "homeTeamId", select: "name shieldUrl" },
    { path: "awayTeamId", select: "name shieldUrl" },
    { path: "refereeId", select: "fullName" },
  ]);
  const body: Paginated<IMatch> = { data: data as unknown as IMatch[], meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});

export const POST = route(async (request) => {
  const input = await parseBody(request, matchCreateSchema);
  // The matchday determines the phase, and the phase the championship.
  const matchday = await Matchday.findById(input.matchdayId).select("phaseId championshipId").lean();
  if (!matchday) throw notFound("Fecha no encontrada");
  const championshipId = matchday.championshipId.toString();

  const teams = await Team.find({ _id: { $in: [input.homeTeamId, input.awayTeamId] } }).lean();
  if (teams.length !== 2) throw notFound("Alguno de los equipos no existe");
  if (teams.some((team) => team.championshipId.toString() !== championshipId)) {
    throw badRequest("Los equipos deben pertenecer al campeonato de la fecha");
  }
  if (input.refereeId && !(await Referee.exists({ _id: input.refereeId, championshipId }))) throw badRequest("El árbitro no pertenece a este campeonato");
  const fit = await assertMatchFitsPhase({ phaseId: matchday.phaseId.toString(), homeTeamId: input.homeTeamId, awayTeamId: input.awayTeamId, group: input.group });
  const match = await Match.create({ ...input, championshipId, phaseId: matchday.phaseId, group: fit.group });
  // The whole squad of both teams is called up automatically.
  await syncMatchCallUps(match._id.toString());
  const names = teams.map((team) => team.name).join(" vs ");
  await recordAudit(getActor(request), {
    action: "create",
    entityType: "match",
    entityId: match._id,
    championshipId: match.championshipId,
    summary: `Partido creado: ${names}`,
  });
  return json(match, 201);
});
