import { Schema, model, models, Model, Types } from "mongoose";

import {
  CHAMPIONSHIP_FORMATS,
  CHAMPIONSHIP_STATUSES,
  type ChampionshipFormat,
  type ChampionshipStatus,
} from "@/lib/constants";

export { CHAMPIONSHIP_FORMATS, CHAMPIONSHIP_STATUSES };
export type { ChampionshipFormat, ChampionshipStatus };

export interface ChampionshipRules {
  pointsPerWin: number;
  pointsPerDraw: number;
  pointsPerLoss: number;
  /** Maximum players a team can register in its roster. */
  maxRosterSize: number;
  /** Minimum checked-in players required to start a match. */
  minPlayersToStart: number;
  /** Cosine similarity at or above which a face is verified. */
  verifyThreshold: number;
  /** Cosine similarity at or above which a face goes to manual review (below verifyThreshold). */
  reviewThreshold: number;
  /** Non-voided yellow cards that trigger an automatic suspension. */
  yellowCardsForSuspension: number;
  /** Matches a player sits out after accumulating the yellow cards above. */
  yellowSuspensionMatches: number;
  /** Matches a player sits out after a red card. */
  redCardSuspensionMatches: number;
  /** Fine (COP) charged for each yellow card; 0 = no fine. */
  yellowCardFine: number;
  /** Fine (COP) charged for each red card; 0 = no fine. */
  redCardFine: number;
  /** Whether referees may resolve a failed verification manually. Fixed to true for now. */
  allowManualReview: boolean;
  /** Goals credited to the winner of a walkover (W.O.); the loser gets 0. 0 = no goals, only the win. */
  walkoverGoals: number;
  /** How many periods a match has (2 for football, 4 for basketball quarters, etc). Just for the on-screen clock. */
  periodsCount: number;
  /** Custom name per period, in order; a missing one falls back to "Tiempo N". */
  periodLabels: string[];
}

export interface IChampionship {
  _id: Types.ObjectId;
  name: string;
  season: string;
  status: ChampionshipStatus;
  format: ChampionshipFormat;
  startDate?: Date;
  endDate?: Date;
  rules: ChampionshipRules;
  /** Logo/badge shown on its cards and pages; empty until the organizer uploads one. */
  logoUrl: string;
  logoBlobName: string;
  /** Who created it (the first organizer); absent for championships that predate accounts. */
  ownerUserId?: Types.ObjectId;
  /** Co-organizers, in addition to the owner. */
  organizerUserIds: Types.ObjectId[];
  /** Emails invited as organizer that have not signed in yet; resolved into `organizerUserIds` on their first login. */
  organizerInviteEmails: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Face thresholds validated on LFW with the aligned pipeline (see docs/CALIBRACION_FACIAL.md);
// recalibrate with the league's own photos when available.
export const DEFAULT_RULES: ChampionshipRules = {
  pointsPerWin: 3,
  pointsPerDraw: 1,
  pointsPerLoss: 0,
  maxRosterSize: 25,
  minPlayersToStart: 7,
  verifyThreshold: 0.35,
  reviewThreshold: 0.25,
  yellowCardsForSuspension: 3,
  yellowSuspensionMatches: 1,
  redCardSuspensionMatches: 1,
  yellowCardFine: 0,
  redCardFine: 0,
  allowManualReview: true,
  walkoverGoals: 0,
  periodsCount: 2,
  periodLabels: ["1er Tiempo", "2do Tiempo"],
};

const RulesSchema = new Schema<ChampionshipRules>(
  {
    pointsPerWin: { type: Number, default: DEFAULT_RULES.pointsPerWin, min: 0 },
    pointsPerDraw: { type: Number, default: DEFAULT_RULES.pointsPerDraw, min: 0 },
    pointsPerLoss: { type: Number, default: DEFAULT_RULES.pointsPerLoss, min: 0 },
    maxRosterSize: { type: Number, default: DEFAULT_RULES.maxRosterSize, min: 1 },
    minPlayersToStart: { type: Number, default: DEFAULT_RULES.minPlayersToStart, min: 1 },
    verifyThreshold: { type: Number, default: DEFAULT_RULES.verifyThreshold, min: 0, max: 1 },
    reviewThreshold: { type: Number, default: DEFAULT_RULES.reviewThreshold, min: 0, max: 1 },
    yellowCardsForSuspension: { type: Number, default: DEFAULT_RULES.yellowCardsForSuspension, min: 1 },
    yellowSuspensionMatches: { type: Number, default: DEFAULT_RULES.yellowSuspensionMatches, min: 1 },
    redCardSuspensionMatches: { type: Number, default: DEFAULT_RULES.redCardSuspensionMatches, min: 1 },
    yellowCardFine: { type: Number, default: DEFAULT_RULES.yellowCardFine, min: 0 },
    redCardFine: { type: Number, default: DEFAULT_RULES.redCardFine, min: 0 },
    allowManualReview: { type: Boolean, default: DEFAULT_RULES.allowManualReview },
    walkoverGoals: { type: Number, default: DEFAULT_RULES.walkoverGoals, min: 0, max: 50 },
    periodsCount: { type: Number, default: DEFAULT_RULES.periodsCount, min: 1, max: 20 },
    periodLabels: { type: [String], default: DEFAULT_RULES.periodLabels },
  },
  { _id: false }
);

const ChampionshipSchema = new Schema<IChampionship>(
  {
    name: { type: String, required: true, trim: true },
    season: { type: String, required: true, trim: true },
    status: { type: String, enum: CHAMPIONSHIP_STATUSES, default: "draft" },
    format: { type: String, enum: CHAMPIONSHIP_FORMATS, default: "league" },
    startDate: { type: Date },
    endDate: { type: Date },
    rules: { type: RulesSchema, default: () => ({}) },
    logoUrl: { type: String, default: "" },
    logoBlobName: { type: String, default: "" },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    organizerUserIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    organizerInviteEmails: { type: [String], default: [] },
  },
  { timestamps: true }
);

ChampionshipSchema.index({ name: 1, season: 1 }, { unique: true });

export const Championship: Model<IChampionship> =
  (models.Championship as Model<IChampionship>) || model<IChampionship>("Championship", ChampionshipSchema);
