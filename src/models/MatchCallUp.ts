import { Schema, model, models, Model, Types } from "mongoose";

/** A player selected by a team for a specific match. */
export interface IMatchCallUp {
  _id: Types.ObjectId;
  matchId: Types.ObjectId;
  teamId: Types.ObjectId;
  playerId: Types.ObjectId;
  registrationId: Types.ObjectId;
  calledUpBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const MatchCallUpSchema = new Schema<IMatchCallUp>(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    registrationId: { type: Schema.Types.ObjectId, ref: "TeamRegistration", required: true },
    calledUpBy: { type: String, required: true },
  },
  { timestamps: true }
);

MatchCallUpSchema.index({ matchId: 1, playerId: 1 }, { unique: true });
MatchCallUpSchema.index({ matchId: 1, teamId: 1 });

export const MatchCallUp: Model<IMatchCallUp> =
  (models.MatchCallUp as Model<IMatchCallUp>) || model<IMatchCallUp>("MatchCallUp", MatchCallUpSchema);
