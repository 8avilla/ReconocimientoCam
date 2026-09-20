/**
 * Registers every Mongoose model. `populate()` resolves models by name at runtime, so a route that
 * populates a model it never imported would fail with MissingSchemaError depending on which routes
 * happened to be loaded first. Importing this module (done by connectToDatabase) removes that hazard.
 */
export { AuditLog } from "./AuditLog";
export { Championship } from "./Championship";
export { IdentityVerification } from "./IdentityVerification";
export { Match } from "./Match";
export { MatchCallUp } from "./MatchCallUp";
export { MatchEvent } from "./MatchEvent";
export { Player } from "./Player";
export { PlayerCheckIn } from "./PlayerCheckIn";
export { Suspension } from "./Suspension";
export { Team } from "./Team";
export { TeamRegistration } from "./TeamRegistration";
