import type {
  ChampionshipFormat,
  MatchEventType,
  MatchPeriod,
  SuspensionReason,
  SuspensionStatus,
  MatchStatus,
  ChampionshipStatus,
  Position,
  RegistrationStatus,
} from "@/lib/constants";

/** Client-side shapes of the JSON returned by the REST API (ids and dates are strings). */

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export interface ChampionshipRulesDTO {
  pointsPerWin: number;
  pointsPerDraw: number;
  pointsPerLoss: number;
  maxRosterSize: number;
  minPlayersToStart: number;
  yellowCardsForSuspension?: number;
  yellowSuspensionMatches?: number;
  redCardSuspensionMatches?: number;
  verifyThreshold: number;
  reviewThreshold: number;
  allowManualReview: boolean;
}

export interface ChampionshipDTO {
  _id: string;
  name: string;
  season: string;
  status: ChampionshipStatus;
  format: ChampionshipFormat;
  startDate?: string;
  endDate?: string;
  rules: ChampionshipRulesDTO;
  counts?: { teams: number; matches: number };
}

export interface TeamDTO {
  _id: string;
  championshipId: string;
  name: string;
  shieldUrl: string;
  primaryColor: string;
  secondaryColor: string;
  delegateName: string;
  active: boolean;
  playerCount?: number;
}

export interface RegistrationDTO {
  _id: string;
  championshipId: string;
  teamId: string;
  playerId: string;
  shirtNumber: number;
  position: Position;
  status: RegistrationStatus;
}

export interface PlayerDTO {
  _id: string;
  publicId: string;
  fullName: string;
  documentId: string;
  birthDate: string;
  photoUrl: string;
  biometricConsentAt?: string;
  hasFace: boolean;
  registration?: (RegistrationDTO & { team: Pick<TeamDTO, "_id" | "name" | "shieldUrl"> | null }) | null;
}

export interface PlayerDetailDTO extends Omit<PlayerDTO, "registration"> {
  registrations: Array<
    Omit<RegistrationDTO, "teamId" | "championshipId"> & {
      teamId: Pick<TeamDTO, "_id" | "name" | "shieldUrl"> | null;
      championshipId: Pick<ChampionshipDTO, "_id" | "name" | "season"> | null;
    }
  >;
}

export interface RosterEntryDTO extends Omit<RegistrationDTO, "playerId"> {
  playerId: Pick<PlayerDTO, "_id" | "publicId" | "fullName" | "documentId" | "photoUrl" | "birthDate">;
}

export interface PlayerCardDTO {
  publicId: string;
  fullName: string;
  photoUrl: string;
  team: Pick<TeamDTO, "_id" | "name" | "shieldUrl" | "primaryColor" | "secondaryColor"> | null;
  championship: Pick<ChampionshipDTO, "_id" | "name" | "season"> | null;
  shirtNumber: number | null;
  position: Position | null;
  status: RegistrationStatus;
  qrPayload: string;
}

export interface MatchDTO {
  _id: string;
  championshipId: string;
  homeTeamId: Pick<TeamDTO, "_id" | "name" | "shieldUrl">;
  awayTeamId: Pick<TeamDTO, "_id" | "name" | "shieldUrl">;
  scheduledAt: string;
  venue: string;
  round: string;
  status: MatchStatus;
  period: MatchPeriod;
  startedAt?: string;
  periodStartedAt?: string;
  finishedAt?: string;
  homeScore?: number;
  awayScore?: number;
  counts?: { calledUp: number; present: number };
}

type PlayerRef = Pick<PlayerDTO, "_id" | "fullName" | "photoUrl">;

export interface MatchEventDTO {
  _id: string;
  matchId: string;
  teamId: string;
  playerId?: PlayerRef | null;
  relatedPlayerId?: PlayerRef | null;
  type: MatchEventType;
  minute: number;
  note?: string;
  auto: boolean;
  voided: boolean;
  voidReason?: string;
  recordedBy: string;
}

export interface EventCreateResultDTO {
  event: MatchEventDTO;
  autoEvents: MatchEventDTO[];
  suspensions: { reason: SuspensionReason }[];
  score: { home: number; away: number };
}

export interface SuspensionDTO {
  _id: string;
  championshipId: string;
  teamId: Pick<TeamDTO, "_id" | "name" | "shieldUrl">;
  playerId: PlayerRef;
  reason: SuspensionReason;
  matchesToServe: number;
  matchesServed: number;
  status: SuspensionStatus;
  note?: string;
  createdAt: string;
}

export type CheckInStatusDTO = "pending" | "present" | "absent";
export type VerificationResultDTO = "verified" | "review" | "mismatch";

export interface AttendanceRowDTO {
  _id: string;
  teamId: string;
  status: CheckInStatusDTO;
  method?: "qr" | "face" | "manual";
  checkedInAt?: string;
  operatorName?: string;
  manualReason?: string;
  playerId: Pick<PlayerDTO, "_id" | "publicId" | "fullName" | "photoUrl">;
  shirtNumber: number | null;
  position: Position | null;
  registrationStatus: RegistrationStatus | null;
  verificationId?: { result: VerificationResultDTO; confidence?: number; method: "face" | "manual_review"; performedAt: string } | null;
}

export interface AttendanceDTO {
  checkIns: AttendanceRowDTO[];
  summary: { called: number; present: number; absent: number; pending: number; verified: number };
}

export interface LookupDTO {
  player: Pick<PlayerDTO, "_id" | "publicId" | "fullName" | "photoUrl" | "hasFace">;
  team: Pick<TeamDTO, "_id" | "name" | "shieldUrl">;
  shirtNumber: number;
  position: Position;
  registrationStatus: RegistrationStatus;
  checkInStatus: CheckInStatusDTO;
  allowManualReview: boolean;
}

export interface VerificationOutcomeDTO {
  verificationId: string;
  result: VerificationResultDTO;
  confidence?: number;
  allowManualReview?: boolean;
}

export interface StandingsRowDTO {
  position: number;
  teamId: string;
  name: string;
  shieldUrl: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ("W" | "D" | "L")[];
}

export interface PlayerStatDTO {
  playerId: string;
  fullName: string;
  photoUrl: string;
  teamId: string;
  teamName: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
}

export interface PlayerStatsDTO {
  matchesPlayed: number;
  scorers: PlayerStatDTO[];
  assisters: PlayerStatDTO[];
  cards: PlayerStatDTO[];
}
