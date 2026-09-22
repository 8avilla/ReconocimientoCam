import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireAdmin, requireOrganizer } from "@/lib/permissions";
import { diffChanges, recordAudit } from "@/lib/audit";
import { championshipUpdateSchema } from "@/lib/validation/schemas";
import { assertThresholdOrder } from "@/lib/rules/championship";
import { Championship, IChampionship } from "@/models/Championship";
import { Match } from "@/models/Match";
import { Matchday } from "@/models/Matchday";
import { Phase } from "@/models/Phase";
import { Tie } from "@/models/Tie";
import { Team } from "@/models/Team";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => {
  const championship = await Championship.findById(id).lean();
  if (!championship) throw notFound("Campeonato no encontrado");
  const [teams, matches] = await Promise.all([
    Team.countDocuments({ championshipId: id }),
    Match.countDocuments({ championshipId: id }),
  ]);
  return json({ ...championship, counts: { teams, matches } });
});

export const PATCH = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const { rules, ...fields } = await parseBody(request, championshipUpdateSchema);
  const championship = await Championship.findById(id);
  if (!championship) throw notFound("Campeonato no encontrado");
  requireOrganizer(actor, championship);

  const before = championship.toObject() as IChampionship;
  const beforeRules = { ...before.rules };

  for (const [key, value] of Object.entries(fields)) {
    championship.set(key, value === null ? undefined : value);
  }
  if (rules) {
    for (const [key, value] of Object.entries(rules)) championship.set(`rules.${key}`, value);
  }
  assertThresholdOrder(championship.rules);
  await championship.save();

  const changes = {
    ...diffChanges(before, fields as Partial<IChampionship>, ["name", "season", "status", "format", "startDate", "endDate"]),
    ...Object.fromEntries(
      Object.entries(diffChanges(beforeRules, rules ?? {}, Object.keys(rules ?? {}) as (keyof typeof beforeRules & string)[])).map(
        ([key, value]) => [`rules.${key}`, value]
      )
    ),
  };
  if (Object.keys(changes).length > 0) {
    await recordAudit(getActor(request), {
      action: "update",
      entityType: "championship",
      entityId: championship._id,
      championshipId: championship._id,
      summary: `Campeonato actualizado: ${championship.name}`,
      changes,
    });
  }
  return json(championship);
});

export const DELETE = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const championship = await Championship.findById(id);
  if (!championship) throw notFound("Campeonato no encontrado");
  // Deleting is destructive enough to reserve for admins, even though editing is open to any organizer.
  requireAdmin(actor);

  const [teams, matches] = await Promise.all([
    Team.exists({ championshipId: id }),
    Match.exists({ championshipId: id }),
  ]);
  if (teams || matches) {
    throw conflict("El campeonato tiene equipos o partidos; no se puede eliminar", "championship_in_use");
  }
  // Phases cannot outlive their championship: remove them (they have no matches at this point).
  await Tie.deleteMany({ championshipId: id });
  await Matchday.deleteMany({ championshipId: id });
  await Phase.deleteMany({ championshipId: id });
  await championship.deleteOne();
  await recordAudit(actor, {
    action: "delete",
    entityType: "championship",
    entityId: championship._id,
    championshipId: championship._id,
    summary: `Campeonato eliminado: ${championship.name} ${championship.season}`,
  });
  return json({ ok: true });
});
