import { Schema, model, models, Model, Types } from "mongoose";

import { MATCH_PERIODS, MATCH_STATUSES, type MatchPeriod, type MatchStatus } from "@/lib/constants";

export { MATCH_PERIODS, MATCH_STATUSES };
export type { MatchPeriod, MatchStatus };

export interface IMatch {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  homeTeamId: Types.ObjectId;
  awayTeamId: Types.ObjectId;
  scheduledAt: Date;
  venue: string;
  round: string;
  status: MatchStatus;
  /** Live-match clock: current period and when the match / the current period started. */
  period: MatchPeriod;
  startedAt?: Date;
  periodStartedAt?: Date;
  finishedAt?: Date;
  /** Derived from the non-voided match events; never edited by hand. */
  homeScore?: number;
  awayScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true },
    homeTeamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    awayTeamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    scheduledAt: { type: Date, required: true },
    venue: { type: String, default: "", trim: true },
    round: { type: String, default: "", trim: true },
    status: { type: String, enum: MATCH_STATUSES, default: "scheduled" },
    period: { type: String, enum: MATCH_PERIODS, default: "not_started" },
    startedAt: { type: Date },
    periodStartedAt: { type: Date },
    finishedAt: { type: Date },
    homeScore: { type: Number, min: 0 },
    awayScore: { type: Number, min: 0 },
  },
  { timestamps: true }
);

MatchSchema.index({ championshipId: 1, scheduledAt: 1 });
MatchSchema.index({ homeTeamId: 1 });
MatchSchema.index({ awayTeamId: 1 });

export const Match: Model<IMatch> = (models.Match as Model<IMatch>) || model<IMatch>("Match", MatchSchema);
