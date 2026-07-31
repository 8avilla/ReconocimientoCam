import mongoose, { Schema, models, model } from "mongoose";

const EmployeeSchema = new Schema(
  {
    name: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type EmployeeDoc = mongoose.InferSchemaType<typeof EmployeeSchema> & { _id: mongoose.Types.ObjectId };

export const Employee = models.Employee || model("Employee", EmployeeSchema);
