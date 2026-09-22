import { Schema, model, models, Model, Types } from "mongoose";

/** A place where matches are played (a field); offered when scheduling. Matches keep the name they were given. */
export interface IVenue {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  name: string;
  address?: string;
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VenueSchema = new Schema<IVenue>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    address: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 300 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
VenueSchema.index({ championshipId: 1, name: 1 }, { unique: true });

export const Venue: Model<IVenue> = (models.Venue as Model<IVenue>) || model<IVenue>("Venue", VenueSchema);
