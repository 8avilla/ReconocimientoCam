/**
 * Development seed. Usage: npm run seed -- --reset
 * --reset drops the collections owned by this app (including the legacy employee ones) first.
 */
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { generatePublicId } from "@/lib/services/players";
import { syncMatchCallUps } from "@/lib/services/callups";
import { AuditLog } from "@/models/AuditLog";
import { Championship } from "@/models/Championship";
import { IdentityVerification } from "@/models/IdentityVerification";
import { Match } from "@/models/Match";
import { Matchday } from "@/models/Matchday";
import { Phase } from "@/models/Phase";
import { MatchCallUp } from "@/models/MatchCallUp";
import { Player } from "@/models/Player";
import { PlayerCheckIn } from "@/models/PlayerCheckIn";
import { Team } from "@/models/Team";
import { POSITIONS, TeamRegistration } from "@/models/TeamRegistration";

const OWNED_COLLECTIONS = [
  "championships", "teams", "players", "teamregistrations", "matches", "matchcallups",
  "playercheckins", "identityverifications", "auditlogs", "matchevents", "suspensions", "phases", "ties", "matchdays",
  // Legacy collections from the previous employee attendance prototype.
  "employees", "attendancerecords", "faceembeddings", "matchattendances",
];

const TEAMS = [
  ["Atlas FC", "Carlos Ramírez"], ["Emperadores FC", "Alejandro Torres"], ["Brazuca FC", "Andrés Molina"],
  ["Legión Elite", "Daniel Ospina"], ["El Bonche", "Diego Pardo"], ["Real Urbana", "Sebastián López"],
  ["Los Amigos FC", "Mateo Ríos"], ["Deportivo Sur", "Felipe Gómez"],
] as const;

const FIRST_NAMES = ["Juan Sebastián", "Carlos", "Pedro", "Luis", "Andrés", "Miguel", "Diego", "Mateo", "Felipe", "Santiago", "Camilo", "Julián", "Nicolás", "Daniel"];
const LAST_NAMES = ["Pérez", "Díaz", "Gómez", "Martínez", "Rodríguez", "Torres", "Ramírez", "López", "Ríos", "Molina", "Ospina", "Pardo", "Herrera", "Castro"];
const PLAYERS_PER_TEAM = 14;

async function reset() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection is not ready");
  const existing = new Set((await db.listCollections().toArray()).map((collection) => collection.name));
  for (const name of OWNED_COLLECTIONS) {
    if (existing.has(name)) await db.dropCollection(name);
  }
  console.log("Dropped owned collections");
}

async function seed() {
  const championship = await Championship.create({
    name: "Liga Master",
    season: "2025",
    status: "in_progress",
    format: "league",
    startDate: new Date("2025-08-01"),
    endDate: new Date("2025-12-15"),
  });

  const teams = await Team.insertMany(
    TEAMS.map(([name, delegateName]) => ({ championshipId: championship._id, name, delegateName }))
  );

  const playerDocs = teams.flatMap((team, teamIndex) =>
    Array.from({ length: PLAYERS_PER_TEAM }, (_, index) => ({
      publicId: generatePublicId(),
      fullName: `${FIRST_NAMES[index]} ${LAST_NAMES[(index + teamIndex * 3) % LAST_NAMES.length]} ${LAST_NAMES[(index * 2 + teamIndex) % LAST_NAMES.length]}`,
      documentId: `10${String(teamIndex).padStart(2, "0")}${String(index).padStart(6, "0")}`,
      birthDate: new Date(Date.UTC(1990 + ((index + teamIndex) % 15), index % 12, 1 + index)),
      teamId: team._id,
      shirtNumber: index + 1,
      position: POSITIONS[index % POSITIONS.length],
    }))
  );

  const players = await Player.insertMany(
    playerDocs.map(({ publicId, fullName, documentId, birthDate }) => ({ publicId, fullName, documentId, birthDate }))
  );

  await TeamRegistration.insertMany(
    players.map((player, index) => ({
      championshipId: championship._id,
      teamId: playerDocs[index].teamId,
      playerId: player._id,
      shirtNumber: playerDocs[index].shirtNumber,
      position: playerDocs[index].position,
      // One suspended player per team (the last one) to exercise the call-up rule.
      status: playerDocs[index].shirtNumber === PLAYERS_PER_TEAM ? "suspended" : "active",
    }))
  );

  // Every match belongs to a phase; the seed uses a single league phase with all the teams.
  const phase = await Phase.create({
    championshipId: championship._id,
    name: "Fase regular",
    order: 1,
    type: "league",
    legs: 1,
    teamIds: teams.map((team) => team._id),
  });

  const matchday = await Matchday.create({ championshipId: championship._id, phaseId: phase._id, number: 1, name: "Fecha 1" });

  const nextSaturday = new Date();
  nextSaturday.setDate(nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7 || 7));
  nextSaturday.setHours(19, 0, 0, 0);

  const [atlas, , brazuca] = teams;
  await Match.create({
    championshipId: championship._id,
    phaseId: phase._id,
    matchdayId: matchday._id,
    homeTeamId: atlas._id,
    awayTeamId: brazuca._id,
    scheduledAt: nextSaturday,
    venue: "Cancha La 10",
  });
  await Match.create({
    championshipId: championship._id,
    phaseId: phase._id,
    matchdayId: matchday._id,
    homeTeamId: teams[1]._id,
    awayTeamId: teams[3]._id,
    scheduledAt: new Date(nextSaturday.getTime() + 2 * 60 * 60 * 1000),
    venue: "Cancha La 10",
  });

  // Every match calls up the whole active squad of both teams.
  for (const seededMatch of await Match.find().lean()) await syncMatchCallUps(seededMatch._id.toString());

  console.log(`Seeded: 1 championship, ${teams.length} teams, ${players.length} players, 2 matches`);
}

async function main() {
  await connectToDatabase();
  if (process.argv.includes("--reset")) await reset();
  else if ((await Championship.estimatedDocumentCount()) > 0) {
    throw new Error("Database is not empty; run with --reset to wipe and reseed");
  }
  // Ensure partial unique indexes exist before inserting.
  await Promise.all(
    [AuditLog, Championship, IdentityVerification, Match, Matchday, MatchCallUp, Phase, Player, PlayerCheckIn, Team, TeamRegistration].map(
      (model) => model.syncIndexes()
    )
  );
  await seed();
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
