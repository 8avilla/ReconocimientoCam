import { Schema, model, models, Model, Types } from "mongoose";
import { invalidateOnWrite } from "@/lib/serverCache";
import { TEAM_STAFF_ROLES, type TeamStaffRole } from "@/lib/constants";

export interface ITeamStaffMember {
  _id: Types.ObjectId;
  name: string;
  role: TeamStaffRole;
}

export interface ITeam {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  name: string;
  shieldUrl: string;
  shieldBlobName: string;
  primaryColor: string;
  secondaryColor: string;
  delegateName: string;
  /** Coaching staff: head coach, assistants, physical trainer, etc. — separate from the single `delegateName` field. */
  staff: ITeamStaffMember[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeamStaffSchema = new Schema<ITeamStaffMember>(
  { name: { type: String, required: true, trim: true }, role: { type: String, enum: TEAM_STAFF_ROLES, required: true } },
  { _id: true }
);

const TeamSchema = new Schema<ITeam>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true, index: true },
    name: { type: String, required: true, trim: true },
    shieldUrl: { type: String, default: "" },
    shieldBlobName: { type: String, default: "" },
    primaryColor: { type: String, default: "#16A34A" },
    secondaryColor: { type: String, default: "#0F172A" },
    delegateName: { type: String, default: "", trim: true },
    staff: { type: [TeamStaffSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamSchema.index({ championshipId: 1, name: 1 }, { unique: true });

invalidateOnWrite(TeamSchema, "Team");

export const Team: Model<ITeam> = (models.Team as Model<ITeam>) || model<ITeam>("Team", TeamSchema);
