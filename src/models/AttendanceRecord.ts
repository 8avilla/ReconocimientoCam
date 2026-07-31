import mongoose, { Schema, models, model } from "mongoose";

const AttendanceRecordSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    type: { type: String, enum: ["checkin", "checkout"], default: null },
    confidence: { type: Number, required: true },
    photoUrl: { type: String, required: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    accuracy: { type: Number, default: null },
  },
  { timestamps: true }
);

export type AttendanceRecordDoc = mongoose.InferSchemaType<typeof AttendanceRecordSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AttendanceRecord = models.AttendanceRecord || model("AttendanceRecord", AttendanceRecordSchema);
