import { Schema, model, models, Model, Types } from "mongoose";

/**
 * A signed-in person: with Google (created the first time someone signs in; `isAdmin` comes from the
 * ADMIN_EMAILS environment variable at that moment, see `src/auth.ts`, and can be changed by hand later)
 * or with a password (self-registered, or created by an admin who then sends a "set your password" link
 * reusing the same reset-password flow). Both methods share the same account when the email matches.
 * Everyone else uses the app as a visitor, without ever needing an account.
 */
export interface IUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  image?: string;
  isAdmin: boolean;
  /** Absent for accounts that only ever signed in with Google. */
  passwordHash?: string;
  /** The permission set this user has, beyond plain visitor (see `src/models/Role.ts`). */
  roleId?: Types.ObjectId;
  /** Set while a password reset/setup link is outstanding; only its hash is ever stored. */
  resetPasswordTokenHash?: string;
  resetPasswordExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    name: { type: String, required: true, trim: true },
    image: { type: String },
    isAdmin: { type: Boolean, default: false },
    passwordHash: { type: String },
    roleId: { type: Schema.Types.ObjectId, ref: "Role" },
    resetPasswordTokenHash: { type: String },
    resetPasswordExpiresAt: { type: Date },
  },
  { timestamps: true }
);

export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
