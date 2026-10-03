/** A card event as stored: enough to weigh it. */
export interface CardEvent {
  _id: string;
  teamId: string;
  type: "yellow_card" | "red_card";
  /** For the automatic red of a double yellow: the second yellow that caused it. */
  linkedEventId?: string | null;
}

export interface FairPlayWeights {
  yellow: number;
  red: number;
}

/**
 * Fair play points per team: each yellow adds `yellow`, each red adds `red`. A double yellow is recorded as two yellows
 * plus an automatic red linked to the second one; that second yellow is not counted, so the player's sending-off weighs
 * one yellow plus one red (not two yellows and a red). Voided events must be left out by the caller.
 * Teams with no cards are simply absent (their points are 0).
 */
export function fairPlayPoints(events: readonly CardEvent[], weights: FairPlayWeights): Map<string, number> {
  const absorbed = new Set(events.filter((event) => event.type === "red_card" && event.linkedEventId).map((event) => String(event.linkedEventId)));
  const points = new Map<string, number>();
  for (const event of events) {
    if (event.type === "yellow_card" && absorbed.has(event._id)) continue;
    points.set(event.teamId, (points.get(event.teamId) ?? 0) + (event.type === "yellow_card" ? weights.yellow : weights.red));
  }
  return points;
}
