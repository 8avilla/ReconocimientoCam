import type { APIRequestContext } from "@playwright/test";
import { apiOf } from "./auth";

interface ChampionshipRow {
  _id: string;
  name: string;
  isDemoTemplate?: boolean;
}

/** The public demo championship (fake teams and players): safe to read and to screenshot. */
export async function demoTemplate(request: APIRequestContext): Promise<ChampionshipRow> {
  const { body } = await apiOf(request).get<{ data: ChampionshipRow[] }>("/championships?limit=100");
  const template = body.data.find((item) => item.isDemoTemplate);
  if (!template) throw new Error("No demo template: run `npm run demo:template -- \"<championship name>\"`");
  return template;
}

export interface DemoMatch {
  _id: string;
  homeTeamId: { _id: string; name: string };
  awayTeamId: { _id: string; name: string };
  status: string;
}

/** The first match of a championship that has not been played, with both team names. */
export async function firstScheduledMatch(request: APIRequestContext, championshipId: string): Promise<DemoMatch> {
  const { body } = await apiOf(request).get<{ data: DemoMatch[] }>(`/matches?championshipId=${championshipId}&limit=100`);
  const match = body.data.find((item) => item.status === "scheduled");
  if (!match) throw new Error("The demo has no scheduled match");
  return match;
}

export interface Row {
  _id: string;
  teamId: string;
  status: string;
  registrationStatus: string | null;
  checkedInAt?: string;
  playerId: { _id: string; fullName: string };
}

export async function attendanceOf(request: APIRequestContext, matchId: string) {
  const { body } = await apiOf(request).get<{ checkIns: Row[]; summary: { present: number; called: number } }>(`/matches/${matchId}/attendance`);
  return body;
}
