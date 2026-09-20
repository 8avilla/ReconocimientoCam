import { Schema, model, models, Model, Types } from "mongoose";

export interface ITeam {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  name: string;
  shieldUrl: string;
  shieldBlobName: string;
  primaryColor: string;
  secondaryColor: string;
  delegateName: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true, index: true },
    name: { type: String, required: true, trim: true },
    shieldUrl: { type: String, default: "" },
    shieldBlobName: { type: String, default: "" },
    primaryColor: { type: String, default: "#16A34A" },
    secondaryColor: { type: String, default: "#0F172A" },
    delegateName: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamSchema.index({ championshipId: 1, name: 1 }, { unique: true });

export const Team: Model<ITeam> = (models.Team as Model<ITeam>) || model<ITeam>("Team", TeamSchema);
