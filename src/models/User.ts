import { Schema, model, models, Model, Types } from "mongoose";

/**
 * A signed-in person (Google account). Created the first time someone signs in; `isAdmin` comes from the
 * ADMIN_EMAILS environment variable at that moment (see `src/auth.ts`) and can be changed by hand later.
 * Everyone else uses the app as a visitor, without ever needing an account.
 */
export interface IUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  image?: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    name: { type: String, required: true, trim: true },
    image: { type: String },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
