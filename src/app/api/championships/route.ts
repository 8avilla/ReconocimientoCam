import { ApiError, conflict, escapeRegex, json, parseBody, parseQuery, route, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { championshipCreateSchema, championshipListQuery } from "@/lib/validation/schemas";
import { skipFor } from "@/lib/validation/common";
import { assertThresholdOrder } from "@/lib/rules/championship";
import { Championship, DEFAULT_RULES, IChampionship } from "@/models/Championship";

export const GET = route(async (request) => {
  const query = parseQuery(request, championshipListQuery);
  const filter = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { name: { $regex: escapeRegex(query.q), $options: "i" } } : {}),
  };
  const [data, total] = await Promise.all([
    Championship.find(filter).sort({ createdAt: -1 }).skip(skipFor(query)).limit(query.limit).lean(),
    Championship.countDocuments(filter),
  ]);
  const body: Paginated<IChampionship> = { data, meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});

export const POST = route(async (request) => {
  const actor = getActor(request);
  // Anyone signed in can start a championship; they become its owner (an admin can too, without owning it).
  if (!actor.userId) throw new ApiError(401, "Inicia sesión con Google para crear un campeonato", "unauthenticated");
  const input = await parseBody(request, championshipCreateSchema);
  const rules = { ...DEFAULT_RULES, ...input.rules };
  assertThresholdOrder(rules);

  const duplicate = await Championship.exists({ name: input.name, season: input.season });
  if (duplicate) throw conflict("Ya existe un campeonato con ese nombre y temporada", "duplicate");

  const championship = await Championship.create({ ...input, rules, ownerUserId: actor.userId });
  await recordAudit(actor, {
    action: "create",
    entityType: "championship",
    entityId: championship._id,
    championshipId: championship._id,
    summary: `Campeonato creado: ${championship.name} ${championship.season}`,
  });
  return json(championship, 201);
});
