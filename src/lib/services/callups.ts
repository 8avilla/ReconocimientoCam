import { MatchCallUp } from "@/models/MatchCallUp";
import { Match } from "@/models/Match";
import { PlayerCheckIn } from "@/models/PlayerCheckIn";
import { TeamRegistration } from "@/models/TeamRegistration";

const AUTOMATIC_CALLER = "Plantilla completa";

/** A concurrent sync may insert the same document first; the unique indexes make that harmless. */
async function insertIgnoringDuplicates<T>(insert: () => Promise<T>) {
  try {
    await insert();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("E11000")) throw error;
  }
}

/**
 * Every active player of both squads is called up for the match, with a pending check-in.
 * Idempotent: it adds players registered (or reactivated) after the match was created and, while the
 * match is still scheduled, drops players who are no longer active (e.g. suspended) and have no
 * attendance yet. Matches in play or finished keep their list.
 */
export async function syncMatchCallUps(matchId: string): Promise<void> {
  const match = await Match.findById(matchId).lean();
  if (!match || (match.status !== "scheduled" && match.status !== "live")) return;

  const [registrations, existing] = await Promise.all([
    TeamRegistration.find({ teamId: { $in: [match.homeTeamId, match.awayTeamId] }, status: "active" }).lean(),
    MatchCallUp.find({ matchId: match._id }).lean(),
  ]);

  const calledPlayers = new Set(existing.map((callUp) => callUp.playerId.toString()));
  const missing = registrations.filter((registration) => !calledPlayers.has(registration.playerId.toString()));
  if (missing.length > 0) {
    await insertIgnoringDuplicates(() =>
      MatchCallUp.insertMany(
        missing.map((registration) => ({
          matchId: match._id,
          teamId: registration.teamId,
          playerId: registration.playerId,
          registrationId: registration._id,
          calledUpBy: AUTOMATIC_CALLER,
        })),
        { ordered: false }
      )
    );
  }

  const callUps = missing.length > 0 ? await MatchCallUp.find({ matchId: match._id }).lean() : existing;
  const withCheckIn = new Set(
    (await PlayerCheckIn.find({ matchId: match._id }).select("callUpId").lean()).map((checkIn) => checkIn.callUpId.toString())
  );
  const withoutCheckIn = callUps.filter((callUp) => !withCheckIn.has(callUp._id.toString()));
  if (withoutCheckIn.length > 0) {
    await insertIgnoringDuplicates(() =>
      PlayerCheckIn.insertMany(
        withoutCheckIn.map((callUp) => ({
          matchId: match._id,
          teamId: callUp.teamId,
          playerId: callUp.playerId,
          callUpId: callUp._id,
          status: "pending",
        })),
        { ordered: false }
      )
    );
  }

  if (match.status === "scheduled") {
    const activeRegistrations = new Set(registrations.map((registration) => registration._id.toString()));
    const stale = callUps.filter((callUp) => !activeRegistrations.has(callUp.registrationId.toString()));
    if (stale.length > 0) {
      const staleIds = stale.map((callUp) => callUp._id);
      const pending = await PlayerCheckIn.find({ callUpId: { $in: staleIds }, status: "pending" }).select("callUpId").lean();
      const removable = pending.map((checkIn) => checkIn.callUpId);
      await PlayerCheckIn.deleteMany({ callUpId: { $in: removable }, status: "pending" });
      await MatchCallUp.deleteMany({ _id: { $in: removable } });
    }
  }
}
