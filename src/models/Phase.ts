import { Schema, model, models, Model, Types } from "mongoose";
import { PHASE_TYPES, TIEBREAK_CRITERIA, type PhaseType, type TiebreakCriterion } from "@/lib/constants";

export { PHASE_TYPES, TIEBREAK_CRITERIA };
export type { PhaseType, TiebreakCriterion };

export interface IPhaseGroup {
  name: string;
  teamIds: Types.ObjectId[];
}

/** How many rows to accent from the top and from the bottom of the standings table, each with its own
 * color (blue/green from the top, orange/red from the bottom) — e.g. blue for direct qualifiers, green
 * for a playoff spot, red for relegation. A band is off while its count is unset or 0. */
export interface IPhaseHighlights {
  top1?: number;
  top2?: number;
  bottom1?: number;
  bottom2?: number;
}

/** A round of a knockout phase (e.g. "Semifinal"). Its ties are stored in the Tie collection. */
export interface IPhaseRound {
  _id: Types.ObjectId;
  name: string;
  order: number;
  /** 1 = single match, 2 = home and away. Each round is configured on its own. */
  legs: 1 | 2;
}

/**
 * A stage of a championship (e.g. "Fase de grupos" then "Liga final"). The organizer picks which
 * teams take part in each phase; nothing is promoted automatically.
 */
export interface IPhase {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  name: string;
  /** Position in the championship; phases are shown and played in this order. */
  order: number;
  type: PhaseType;
  /** 1 = single match, 2 = home and away (per pairing, in a league or inside each group). */
  legs: 1 | 2;
  /** Number of groups for a group phase. */
  groupCount?: number;
  /** Superseded by `highlights` (see below); kept only so phases set up before that existed keep
   * showing their accent until someone opens "Resaltar posiciones" and saves a fresh configuration. */
  qualifyCount?: number;
  /** Which standings rows to accent, and with which of the four colors. Replaces `qualifyCount`. */
  highlights?: IPhaseHighlights;
  /** Order to break ties after points, picked by the organizer; absent uses the historical default
   * (goal difference, then goals for — see `computeStandings`), so existing phases don't silently change. */
  tiebreakers?: TiebreakCriterion[];
  /** Participating teams. */
  teamIds: Types.ObjectId[];
  /** Team distribution for a group phase. */
  groups: IPhaseGroup[];
  /** Rounds of a knockout phase, in play order. */
  rounds: IPhaseRound[];
  createdAt: Date;
  updatedAt: Date;
}

const PhaseGroupSchema = new Schema<IPhaseGroup>(
  {
    name: { type: String, required: true, trim: true },
    teamIds: [{ type: Schema.Types.ObjectId, ref: "Team" }],
  },
  { _id: false }
);

const PhaseRoundSchema = new Schema<IPhaseRound>({
  name: { type: String, required: true, trim: true },
  order: { type: Number, required: true, min: 1 },
  legs: { type: Number, enum: [1, 2], default: 1 },
});

const PhaseHighlightsSchema = new Schema<IPhaseHighlights>(
  {
    top1: { type: Number, min: 0, max: 64 },
    top2: { type: Number, min: 0, max: 64 },
    bottom1: { type: Number, min: 0, max: 64 },
    bottom2: { type: Number, min: 0, max: 64 },
  },
  { _id: false }
);

const PhaseSchema = new Schema<IPhase>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true, min: 1 },
    type: { type: String, enum: PHASE_TYPES, required: true },
    legs: { type: Number, enum: [1, 2], default: 1 },
    groupCount: { type: Number, min: 2, max: 26 },
    qualifyCount: { type: Number, min: 1, max: 64 },
    highlights: { type: PhaseHighlightsSchema },
    tiebreakers: { type: [String], enum: TIEBREAK_CRITERIA },
    teamIds: [{ type: Schema.Types.ObjectId, ref: "Team" }],
    groups: { type: [PhaseGroupSchema], default: [] },
    rounds: { type: [PhaseRoundSchema], default: [] },
  },
  { timestamps: true }
);

PhaseSchema.index({ championshipId: 1, order: 1 });
PhaseSchema.index({ championshipId: 1, name: 1 }, { unique: true });

export const Phase: Model<IPhase> = (models.Phase as Model<IPhase>) || model<IPhase>("Phase", PhaseSchema);
