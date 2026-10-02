import { cached } from "@/lib/serverCache";
import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireAdmin, requireOrganizer } from "@/lib/permissions";
import { diffChanges, recordAudit } from "@/lib/audit";
import { ensureRegistrationFines, syncRegistrationFeeAmount } from "@/lib/services/fines";
import { findChampionshipByIdOrSlug } from "@/lib/services/championships";
import { championshipUpdateSchema } from "@/lib/validation/schemas";
import { Championship, IChampionship } from "@/models/Championship";
import { Match } from "@/models/Match";
import { Matchday } from "@/models/Matchday";
import { Phase } from "@/models/Phase";
import { Tie } from "@/models/Tie";
import { Team } from "@/models/Team";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) =>
  json(
    await cached(`championship:${id}`, 20_000, async () => {
      const championship = await findChampionshipByIdOrSlug(id).lean();
      if (!championship) throw notFound("Torneo no encontrado");
      const [teams, matches] = await Promise.all([
        Team.countDocuments({ championshipId: championship._id }),
        Match.countDocuments({ championshipId: championship._id }),
      ]);
      return { ...championship, counts: { teams, matches } };
    })
  )
);

export const PATCH = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const { rules, ...fields } = await parseBody(request, championshipUpdateSchema);
  const championship = await findChampionshipByIdOrSlug(id);
  if (!championship) throw notFound("Torneo no encontrado");
  requireOrganizer(actor, championship);

  if (fields.slug && (await Championship.exists({ slug: fields.slug, _id: { $ne: championship._id } }))) {
    throw conflict("Ese enlace ya lo usa otro torneo", "duplicate");
  }

  const before = championship.toObject() as IChampionship;
  const beforeRules = { ...before.rules };

  for (const [key, value] of Object.entries(fields)) {
    championship.set(key, value === null ? undefined : value);
  }
  if (rules) {
    for (const [key, value] of Object.entries(rules)) championship.set(`rules.${key}`, value);
  }
  await championship.save();

  if (rules?.registrationFeeAmount !== undefined && rules.registrationFeeAmount !== beforeRules.registrationFeeAmount) {
    await syncRegistrationFeeAmount(championship._id, rules.registrationFeeAmount);
    await ensureRegistrationFines(actor, championship._id, rules.registrationFeeAmount);
  }

  const changes = {
    ...diffChanges(before, fields as Partial<IChampionship>, ["name", "season", "status", "format", "startDate", "endDate", "slug", "visibility"]),
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
      summary: `Torneo actualizado: ${championship.name}`,
      changes,
    });
  }
  return json(championship);
});

export const DELETE = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const championship = await findChampionshipByIdOrSlug(id);
  if (!championship) throw notFound("Torneo no encontrado");
  // Deleting is destructive enough to reserve for admins, even though editing is open to any organizer.
  requireAdmin(actor);

  const [teams, matches] = await Promise.all([
    Team.exists({ championshipId: championship._id }),
    Match.exists({ championshipId: championship._id }),
  ]);
  if (teams || matches) {
    throw conflict("El torneo tiene equipos o partidos; no se puede eliminar", "championship_in_use");
  }
  // Phases cannot outlive their championship: remove them (they have no matches at this point).
  await Tie.deleteMany({ championshipId: championship._id });
  await Matchday.deleteMany({ championshipId: championship._id });
  await Phase.deleteMany({ championshipId: championship._id });
  await championship.deleteOne();
  await recordAudit(actor, {
    action: "delete",
    entityType: "championship",
    entityId: championship._id,
    championshipId: championship._id,
    summary: `Torneo eliminado: ${championship.name} ${championship.season}`,
  });
  return json({ ok: true });
});
