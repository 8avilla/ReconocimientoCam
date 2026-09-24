import { Schema, model, models, Model, Types } from "mongoose";
import type { Permission } from "@/lib/roles";

/** A named, admin-defined set of permissions, assignable to a `User` (see `User.roleId`). */
export interface IRole {
  _id: Types.ObjectId;
  name: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Role: Model<IRole> = (models.Role as Model<IRole>) || model<IRole>("Role", RoleSchema);
