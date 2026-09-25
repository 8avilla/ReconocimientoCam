import { Schema, model, models, Model, Types } from "mongoose";

export const FINE_STATUSES = ["pending", "partial", "paid", "waived", "cancelled"] as const;
export type FineStatus = (typeof FINE_STATUSES)[number];
export const FINE_TYPES = ["yellow_card", "red_card", "manual", "registration"] as const;
export type FineType = (typeof FINE_TYPES)[number];
export const PAYMENT_METHODS = ["cash", "transfer", "nequi", "daviplata", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface IFinePayment {
  _id: Types.ObjectId;
  amount: number;
  method: PaymentMethod;
  note?: string;
  /** Optional proof of payment (photo of the transfer or the receipt). */
  receiptUrl?: string;
  receiptBlobName?: string;
  paidAt: Date;
  receivedBy: string;
}

/**
 * A charge against a team: a player's card, a one-off manual charge, or the team's registration fee.
 * Card fines are created from the match events and registration fees from a team joining a championship,
 * both only when the championship sets an amount; the organizer registers the payments received (partial
 * ones allowed).
 */
export interface IFine {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  teamId: Types.ObjectId;
  playerId?: Types.ObjectId;
  matchId?: Types.ObjectId;
  /** Card event that caused it (unique); absent for manual fines. */
  eventId?: Types.ObjectId;
  type: FineType;
  concept: string;
  amount: number;
  payments: IFinePayment[];
  /** Sum of the payments. */
  paidAmount: number;
  status: FineStatus;
  /** The card event was voided after money had been received: the fine stays for the record. */
  eventVoided: boolean;
  note?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IFinePayment>(
  {
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    note: { type: String, trim: true, maxlength: 200 },
    receiptUrl: { type: String },
    receiptBlobName: { type: String },
    paidAt: { type: Date, default: () => new Date() },
    receivedBy: { type: String, required: true },
  },
  { _id: true }
);

const FineSchema = new Schema<IFine>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player" },
    matchId: { type: Schema.Types.ObjectId, ref: "Match" },
    eventId: { type: Schema.Types.ObjectId, ref: "MatchEvent" },
    type: { type: String, enum: FINE_TYPES, required: true },
    concept: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 1 },
    payments: { type: [PaymentSchema], default: [] },
    paidAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: FINE_STATUSES, default: "pending" },
    eventVoided: { type: Boolean, default: false },
    note: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

FineSchema.index({ championshipId: 1, status: 1, createdAt: -1 });
FineSchema.index({ teamId: 1, status: 1 });
FineSchema.index({ eventId: 1 }, { unique: true, partialFilterExpression: { eventId: { $exists: true } } });
// A team has at most one registration fee (unlike card fines, which are one per event) — enforced here
// so two near-simultaneous requests (e.g. the fines list backfilling missing ones) can't both create one.
FineSchema.index({ teamId: 1, type: 1 }, { unique: true, partialFilterExpression: { type: "registration" } });

export const Fine: Model<IFine> = (models.Fine as Model<IFine>) || model<IFine>("Fine", FineSchema);
