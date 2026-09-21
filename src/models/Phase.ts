import { Schema, model, models, Model, Types } from "mongoose";
import { PHASE_TYPES, type PhaseType } from "@/lib/constants";

export { PHASE_TYPES };
export type { PhaseType };

export interface IPhaseGroup {
  name: string;
  teamIds: Types.ObjectId[];
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

const PhaseSchema = new Schema<IPhase>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true, min: 1 },
    type: { type: String, enum: PHASE_TYPES, required: true },
    legs: { type: Number, enum: [1, 2], default: 1 },
    groupCount: { type: Number, min: 2, max: 26 },
    teamIds: [{ type: Schema.Types.ObjectId, ref: "Team" }],
    groups: { type: [PhaseGroupSchema], default: [] },
    rounds: { type: [PhaseRoundSchema], default: [] },
  },
  { timestamps: true }
);

PhaseSchema.index({ championshipId: 1, order: 1 });
PhaseSchema.index({ championshipId: 1, name: 1 }, { unique: true });

export const Phase: Model<IPhase> = (models.Phase as Model<IPhase>) || model<IPhase>("Phase", PhaseSchema);
