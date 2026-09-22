import { Schema, model, models, Model, Types } from "mongoose";

import { MATCH_PERIODS, MATCH_STATUSES, type MatchPeriod, type MatchStatus } from "@/lib/constants";

export { MATCH_PERIODS, MATCH_STATUSES };
export type { MatchPeriod, MatchStatus };

export interface IMatch {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  /** Every match belongs to a phase, and the phase to the championship: there are no loose matches. */
  phaseId: Types.ObjectId;
  /** The matchday (fecha) of the phase this match is played on. */
  matchdayId: Types.ObjectId;
  /** Group inside a group phase. */
  group?: string;
  /** Knockout tie this match belongs to, and which leg of it (1 or 2). */
  tieId?: Types.ObjectId;
  leg?: 1 | 2;
  homeTeamId: Types.ObjectId;
  awayTeamId: Types.ObjectId;
  /** Day and time; absent until the organizer sets them (they change often). */
  scheduledAt?: Date;
  venue: string;
  /** Referee assigned to the match (optional). */
  refereeId?: Types.ObjectId;
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
    phaseId: { type: Schema.Types.ObjectId, ref: "Phase", required: true },
    matchdayId: { type: Schema.Types.ObjectId, ref: "Matchday", required: true },
    group: { type: String, trim: true },
    tieId: { type: Schema.Types.ObjectId, ref: "Tie" },
    leg: { type: Number, enum: [1, 2] },
    refereeId: { type: Schema.Types.ObjectId, ref: "Referee" },
    homeTeamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    awayTeamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    scheduledAt: { type: Date },
    venue: { type: String, default: "", trim: true },
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
MatchSchema.index({ phaseId: 1 });
MatchSchema.index({ matchdayId: 1 });
MatchSchema.index({ tieId: 1 });
MatchSchema.index({ homeTeamId: 1 });
MatchSchema.index({ awayTeamId: 1 });

export const Match: Model<IMatch> = (models.Match as Model<IMatch>) || model<IMatch>("Match", MatchSchema);
