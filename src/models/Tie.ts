import { Schema, model, models, Model, Types } from "mongoose";

/**
 * A matchup of a knockout round, decided over one or two matches. The organizer picks the teams and
 * marks which one advances: nothing is promoted automatically.
 */
export interface ITie {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  phaseId: Types.ObjectId;
  /** Id of the round inside Phase.rounds. */
  roundId: Types.ObjectId;
  /** Order of the tie inside its round. */
  position: number;
  homeTeamId: Types.ObjectId;
  /** Absent for a bye: the home team advances without playing. */
  awayTeamId?: Types.ObjectId;
  winnerTeamId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TieSchema = new Schema<ITie>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true },
    phaseId: { type: Schema.Types.ObjectId, ref: "Phase", required: true },
    roundId: { type: Schema.Types.ObjectId, required: true },
    position: { type: Number, required: true, min: 1 },
    homeTeamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    awayTeamId: { type: Schema.Types.ObjectId, ref: "Team" },
    winnerTeamId: { type: Schema.Types.ObjectId, ref: "Team" },
  },
  { timestamps: true }
);

TieSchema.index({ phaseId: 1, roundId: 1, position: 1 });

export const Tie: Model<ITie> = (models.Tie as Model<ITie>) || model<ITie>("Tie", TieSchema);
