import { Schema, model, models, Model, Types } from "mongoose";

/**
 * A matchday ("Fecha 1", "Fecha 2"...) of a phase. Every match belongs to one, the matchday to its
 * phase and the phase to the championship, so there are no loose matches. The organizer can create,
 * rename and delete matchdays; the calendar generator only creates the ones it needs when asked to.
 */
export interface IMatchday {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  phaseId: Types.ObjectId;
  /** Order inside the phase, unique per phase. */
  number: number;
  name: string;
  /** Knockout only: the round and leg this matchday stands for (e.g. "Semifinal · Ida"). */
  roundId?: Types.ObjectId;
  leg?: 1 | 2;
  createdAt: Date;
  updatedAt: Date;
}

const MatchdaySchema = new Schema<IMatchday>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true },
    phaseId: { type: Schema.Types.ObjectId, ref: "Phase", required: true },
    number: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    roundId: { type: Schema.Types.ObjectId },
    leg: { type: Number, enum: [1, 2] },
  },
  { timestamps: true }
);

MatchdaySchema.index({ phaseId: 1, number: 1 }, { unique: true });
MatchdaySchema.index({ phaseId: 1, roundId: 1, leg: 1 });

export const Matchday: Model<IMatchday> = (models.Matchday as Model<IMatchday>) || model<IMatchday>("Matchday", MatchdaySchema);
