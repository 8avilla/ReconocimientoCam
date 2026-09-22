import { Schema, model, models, Model, Types } from "mongoose";

/** A referee of the championship; matches can be assigned one. */
export interface IReferee {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  fullName: string;
  phone?: string;
  documentId?: string;
  /** Inactive referees stay on the matches they already have but are not offered for new ones. */
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RefereeSchema = new Schema<IReferee>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    documentId: { type: String, trim: true, maxlength: 30 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
RefereeSchema.index({ championshipId: 1, fullName: 1 });

export const Referee: Model<IReferee> = (models.Referee as Model<IReferee>) || model<IReferee>("Referee", RefereeSchema);
