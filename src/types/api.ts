import type {
  ChampionshipFormat,
  MatchEventType,
  MatchPeriod,
  PhaseType,
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
  yellowCardFine?: number;
  redCardFine?: number;
  verifyThreshold: number;
  reviewThreshold: number;
  allowManualReview: boolean;
  walkoverGoals?: number;
  periodsCount?: number;
  periodLabels?: string[];
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
  ownerUserId?: string;
  organizerUserIds: string[];
  /** Invited by email, not signed in yet (organizer/admin only; empty for anyone else). */
  organizerInviteEmails?: string[];
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
  shirtNumber?: number;
  position?: Position;
  status: RegistrationStatus;
}

export interface PlayerDTO {
  _id: string;
  publicId: string;
  fullName: string;
  documentId?: string;
  birthDate?: string;
  photoUrl: string;
  /** Tight reference crop for manual review; empty for players enrolled before it existed (falls back to photoUrl). */
  facePhotoUrl?: string;
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
  refereeId?: { _id: string; fullName: string } | null;
  /** Populated in list and detail responses: every match is played on a matchday (fecha). */
  matchdayId: { _id: string; number: number; name: string };
  status: MatchStatus;
  /** Populated in list and detail responses: every match belongs to a phase. */
  phaseId: { _id: string; name: string; type: PhaseType };
  group?: string;
  period: MatchPeriod;
  startedAt?: string;
  periodStartedAt?: string;
  finishedAt?: string;
  homeScore?: number;
  awayScore?: number;
  /** Set when status is "walkover": which team was awarded the win. */
  walkoverWinnerTeamId?: Pick<TeamDTO, "_id" | "name" | "shieldUrl"> | null;
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

export interface SuspendedPlayerDTO {
  _id: string;
  teamId: string;
  playerId: Pick<PlayerDTO, "_id" | "publicId" | "fullName" | "photoUrl">;
  registrationId?: { shirtNumber: number } | null;
  reason: SuspensionReason;
  matchesToServe: number;
  matchesServed: number;
}

export interface AttendanceDTO {
  checkIns: AttendanceRowDTO[];
  summary: { called: number; present: number; absent: number; pending: number; verified: number };
  /** Players with an active suspension in either team: they cannot play this match. */
  suspended: SuspendedPlayerDTO[];
}

/** What needs the organizer's attention in a championship, and how far its setup is. */
export interface OverviewDTO {
  setup: {
    phases: number;
    /** League and group phases with at least 2 teams / with matches. */
    tablePhases: number;
    phasesWithTeams: number;
    phasesWithCalendar: number;
    matches: number;
    scheduledMatches: number;
  };
  unscheduledMatches: number;
  teamsWithoutPhase: { _id: string; name: string }[];
  playersWithoutFace: number;
}

export interface SearchDTO {
  teams: Pick<TeamDTO, "_id" | "name" | "shieldUrl">[];
  players: { _id: string; fullName: string; photoUrl: string; teamName: string | null; shirtNumber: number | null }[];
  matches: { _id: string; label: string; phase: string; status: string }[];
}

export interface LookupDTO {
  player: Pick<PlayerDTO, "_id" | "publicId" | "fullName" | "photoUrl" | "facePhotoUrl" | "hasFace">;
  team: Pick<TeamDTO, "_id" | "name" | "shieldUrl">;
  shirtNumber?: number;
  position?: Position;
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

export interface FixturePreviewDTO {
  matches: {
    round: number;
    group?: string;
    homeTeam: { _id: string; name: string };
    awayTeam: { _id: string; name: string };
  }[];
  byes: { round: number; teams: string[] }[];
  rounds: number;
  /** Names of the matchdays when they are not "Fecha n" (e.g. Ida / Vuelta in a knockout round). */
  roundLabels?: Record<string, string>;
  /** Scheduled matches without attendance that already exist and would be replaced. */
  replaceable: number;
  kept: number;
  created: number;
}

export interface PhaseDTO {
  _id: string;
  championshipId: string;
  name: string;
  order: number;
  type: PhaseType;
  legs: 1 | 2;
  groupCount?: number;
  teamIds: string[];
  groups: { name: string; teamIds: string[] }[];
  rounds: { _id: string; name: string; order: number; legs: 1 | 2 }[];
  ties?: { total: number; decided: number };
  matchdayCount: number;
  teamCount: number;
  matches: { total: number; finished: number };
}

export interface MatchdayDTO {
  _id: string;
  phaseId: string;
  number: number;
  name: string;
  matches: { total: number; finished: number };
  from: string | null;
  to: string | null;
}

interface BracketTeam {
  _id: string;
  name: string;
  shieldUrl: string;
}

export interface BracketTieDTO {
  _id: string;
  position: number;
  homeTeam: BracketTeam | null;
  awayTeam: BracketTeam | null;
  /** The home team advances without playing. */
  bye: boolean;
  winnerTeamId: string | null;
  aggregate: { home: number; away: number; played: number } | null;
  /** Only a hint: the organizer always confirms who advances. */
  suggestedWinnerTeamId: string | null;
  matches: {
    _id: string;
    leg: 1 | 2;
    status: string;
    scheduledAt: string;
    venue: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null;
    awayScore: number | null;
  }[];
}

export interface BracketRoundDTO {
  _id: string;
  name: string;
  order: number;
  legs: 1 | 2;
  ties: BracketTieDTO[];
}

export interface BracketDTO {
  phase: { _id: string; name: string; championshipId: string; teamIds: string[] };
  rounds: BracketRoundDTO[];
}

export interface PhaseStandingsDTO {
  phase: { _id: string; name: string; type: PhaseType };
  tables: { group: string | null; rows: StandingsRowDTO[] }[];
}

export interface AuditLogDTO {
  _id: string;
  action: string;
  entityType: string;
  actorName: string;
  actorRole: string;
  summary: string;
  createdAt: string;
}

export type FineStatusDTO = "pending" | "partial" | "paid" | "waived" | "cancelled";

export interface FineDTO {
  _id: string;
  teamId: Pick<TeamDTO, "_id" | "name" | "shieldUrl">;
  playerId?: Pick<PlayerDTO, "_id" | "fullName" | "photoUrl"> | null;
  matchId?: { _id: string; homeTeamId: { name: string }; awayTeamId: { name: string } } | null;
  type: "yellow_card" | "red_card" | "manual";
  concept: string;
  amount: number;
  payments: { _id: string; amount: number; method: "cash" | "transfer" | "nequi" | "daviplata" | "other"; note?: string; receiptUrl?: string; paidAt: string; receivedBy: string }[];
  paidAmount: number;
  status: FineStatusDTO;
  eventVoided: boolean;
  note?: string;
  createdAt: string;
}

export interface FinesDTO extends Paginated<FineDTO> {
  summary: { owed: number; collected: number; byTeam: { teamId: string; name: string; shieldUrl: string; owed: number }[] };
}

export interface IdentifiedPlayerDTO {
  playerId: string;
  fullName: string;
  photoUrl: string;
  teamName: string;
  shirtNumber: number | null;
  confidence: number;
}

/** Outcome of one frame in attendance by camera. */
export interface IdentifyDTO {
  status: "no_face" | "identified" | "already_present" | "suspended" | "uncertain" | "unknown";
  player?: IdentifiedPlayerDTO;
  candidates?: IdentifiedPlayerDTO[];
  /** Players still pending that have no usable registered face (they need Verificar or Manual). */
  pendingWithoutFace: number;
  message?: string;
  /** Milliseconds spent by the server in each stage of this frame (for measuring on real devices). */
  timings?: { galleryMs: number; embedMs?: number; registerMs?: number; totalMs: number; galleryCached: boolean };
}

export interface RefereeDTO {
  _id: string;
  championshipId: string;
  fullName: string;
  phone?: string;
  documentId?: string;
  active: boolean;
  matchCount: number;
}

export interface VenueDTO {
  _id: string;
  championshipId: string;
  name: string;
  address?: string;
  notes?: string;
  active: boolean;
  matchCount: number;
}

export interface OrganizerPersonDTO {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export interface ChampionshipOrganizersDTO {
  owner: OrganizerPersonDTO | null;
  organizers: OrganizerPersonDTO[];
  invited: string[];
}
