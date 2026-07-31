import mongoose, { Schema, models, model } from "mongoose";

const FaceEmbeddingSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    vector: { type: [Number], required: true },
  },
  { timestamps: true }
);

export type FaceEmbeddingDoc = mongoose.InferSchemaType<typeof FaceEmbeddingSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const FaceEmbedding = models.FaceEmbedding || model("FaceEmbedding", FaceEmbeddingSchema);
