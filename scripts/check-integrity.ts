/**
 * Data integrity: every match belongs to a phase, every phase to a championship (no orphans).
 *
 *   npm run integrity            -> report only
 *   npm run integrity -- --fix   -> repair what can be repaired safely
 *
 * Repairs: matches without a matchday (fecha) get one built from their old free-text round or, failing that,
 * from the calendar day they are played on. Matches without a phase are attached to a new league phase ("Fase regular") of their
 * championship, with the teams that play those matches. Orphan phases (championship missing) are removed
 * when they have no matches; anything else is only reported.
 */
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Championship } from "@/models/Championship";
import { Match } from "@/models/Match";
import { Matchday } from "@/models/Matchday";
import { Phase } from "@/models/Phase";
import { Team } from "@/models/Team";
import { Tie } from "@/models/Tie";

const fix = process.argv.includes("--fix");

async function main() {
  await connectToDatabase();
  const championships = new Set((await Championship.distinct("_id")).map(String));
  let phases = await Phase.find().lean();
  let problems = 0;

  // 1. Phases whose championship does not exist.
  for (const phase of phases.filter((entry) => !championships.has(entry.championshipId.toString()))) {
    problems += 1;
    const matches = await Match.countDocuments({ phaseId: phase._id });
    console.log(`Orphan phase "${phase.name}" (${phase._id}): championship missing, ${matches} matches`);
    if (fix && matches === 0) {
      await Tie.deleteMany({ phaseId: phase._id });
      await Phase.deleteOne({ _id: phase._id });
      console.log("  -> removed");
    }
  }

  // 2. Matches without a phase (or pointing to a missing one) -> a default phase per championship.
  const loose = await Match.collection.find({ $or: [{ phaseId: { $exists: false } }, { phaseId: null }] }).toArray();
  const byChampionship = new Map<string, typeof loose>();
  for (const match of loose) byChampionship.set(String(match.championshipId), [...(byChampionship.get(String(match.championshipId)) ?? []), match]);
  for (const [championshipId, matches] of byChampionship) {
    problems += matches.length;
    console.log(`Championship ${championshipId}: ${matches.length} matches without a phase`);
    if (!fix) continue;
    if (!championships.has(championshipId)) {
      console.log("  -> championship missing, left untouched (needs manual review)");
      continue;
    }
    const teamIds = [...new Set(matches.flatMap((match) => [String(match.homeTeamId), String(match.awayTeamId)]))];
    const existingNames = new Set(phases.filter((phase) => phase.championshipId.toString() === championshipId).map((phase) => phase.name));
    let name = "Fase regular";
    for (let suffix = 2; existingNames.has(name); suffix++) name = `Fase regular ${suffix}`;
    const order = (await Phase.countDocuments({ championshipId })) + 1;
    const phase = await Phase.create({ championshipId, name, order, type: "league", legs: 1, teamIds });
    await Match.collection.updateMany({ _id: { $in: matches.map((match) => match._id) } }, { $set: { phaseId: phase._id } });
    console.log(`  -> created phase "${name}" with ${teamIds.length} teams and attached ${matches.length} matches`);
  }

  // 2b. Matches without a matchday: build "Fecha N" matchdays from the old round text (or the calendar day).
  const noMatchday = await Match.collection.find({ phaseId: { $exists: true, $ne: null }, $or: [{ matchdayId: { $exists: false } }, { matchdayId: null }] }).toArray();
  const byPhase = new Map<string, typeof noMatchday>();
  for (const match of noMatchday) byPhase.set(String(match.phaseId), [...(byPhase.get(String(match.phaseId)) ?? []), match]);
  for (const [phaseId, matches] of byPhase) {
    problems += matches.length;
    console.log(`Phase ${phaseId}: ${matches.length} matches without a matchday`);
    const phase = phases.find((entry) => entry._id.toString() === phaseId);
    if (!fix || !phase) continue;

    const existing = await Matchday.find({ phaseId: phase._id }).lean();
    const used = new Set(existing.map((entry) => entry.number));
    const keyOf = (match: (typeof matches)[number]) => String(match.round ?? "").trim() || (match.scheduledAt ? `día ${new Date(match.scheduledAt).toISOString().slice(0, 10)}` : "sin fecha");
    const groups = new Map<string, typeof matches>();
    for (const match of matches) groups.set(keyOf(match), [...(groups.get(keyOf(match)) ?? []), match]);
    // "Jornada N" keeps its number; everything else follows by earliest date.
    const numbered = (key: string) => /^Jornada (\d+)$/.exec(key)?.[1];
    const ordered = [...groups.entries()].sort(([keyA, a], [keyB, b]) => Number(numbered(keyA) ?? Infinity) - Number(numbered(keyB) ?? Infinity) || Math.min(...a.map((m) => +new Date(m.scheduledAt ?? 8.64e15))) - Math.min(...b.map((m) => +new Date(m.scheduledAt ?? 8.64e15))));
    let next = Math.max(0, ...used);
    for (const [key, group] of ordered) {
      const wanted = numbered(key) ? Number(numbered(key)) : undefined;
      const number = wanted && !used.has(wanted) ? wanted : ++next;
      used.add(number);
      const name = numbered(key) ? `Fecha ${numbered(key)}` : key.startsWith("día ") || key === "sin fecha" ? `Fecha ${number}` : key;
      const matchday = await Matchday.create({ championshipId: phase.championshipId, phaseId: phase._id, number, name });
      await Match.collection.updateMany({ _id: { $in: group.map((match) => match._id) } }, { $set: { matchdayId: matchday._id } });
      console.log(`  -> "${name}" (#${number}) with ${group.length} matches`);
    }
  }
  if (fix) await Match.collection.updateMany({ round: { $exists: true } }, { $unset: { round: "" } });

  // 2c. Matchdays whose phase or championship is inconsistent, and matches whose matchday is.
  const matchdays = await Matchday.find().lean();
  const phaseIds = new Map(phases.map((entry) => [entry._id.toString(), entry]));
  for (const matchday of matchdays) {
    const phase = phaseIds.get(matchday.phaseId.toString());
    if (!phase) {
      problems += 1;
      console.log(`Orphan matchday "${matchday.name}" (${matchday._id}): its phase does not exist`);
      if (fix && !(await Match.exists({ matchdayId: matchday._id }))) {
        await Matchday.deleteOne({ _id: matchday._id });
        console.log("  -> removed");
      }
    } else if (phase.championshipId.toString() !== matchday.championshipId.toString()) {
      problems += 1;
      console.log(`Matchday "${matchday.name}": championship differs from its phase's`);
    }
  }
  const matchdayById = new Map(matchdays.map((entry) => [entry._id.toString(), entry]));
  for (const match of await Match.find().select("matchdayId phaseId").lean()) {
    const matchday = match.matchdayId ? matchdayById.get(match.matchdayId.toString()) : undefined;
    if (match.matchdayId && (!matchday || matchday.phaseId.toString() !== match.phaseId.toString())) {
      problems += 1;
      console.log(`Match ${match._id}: its matchday is missing or belongs to another phase`);
    }
  }

  // 3. Matches whose phase does not exist, or belongs to another championship (phases reloaded after repairs).
  phases = await Phase.find().lean();
  const phaseById = new Map(phases.map((phase) => [phase._id.toString(), phase]));
  const stray = await Match.find({ phaseId: { $exists: true, $ne: null } }).select("phaseId championshipId").lean();
  for (const match of stray) {
    const phase = phaseById.get(match.phaseId.toString());
    if (!phase) {
      problems += 1;
      console.log(`Match ${match._id}: phase ${match.phaseId} does not exist`);
    } else if (phase.championshipId.toString() !== match.championshipId.toString()) {
      problems += 1;
      console.log(`Match ${match._id}: its phase belongs to another championship`);
    }
  }

  // 4. Phases referencing teams of another championship (dangling participants).
  for (const phase of phases) {
    const known = await Team.countDocuments({ _id: { $in: phase.teamIds }, championshipId: phase.championshipId });
    if (known !== phase.teamIds.length) {
      problems += 1;
      console.log(`Phase "${phase.name}": ${phase.teamIds.length - known} participant(s) do not exist in its championship`);
    }
  }

  console.log(problems === 0 ? "Integrity OK: no orphan phases or matches." : `${problems} problem(s) found${fix ? " (repairs applied where possible)" : "; run with --fix to repair"}.`);
}

main()
  .catch((error) => {
    console.error("Integrity check failed:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
