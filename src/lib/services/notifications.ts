import webpush from "web-push";
import type { Actor } from "@/lib/actor";
import { audienceTypes, messages, resolveAudience, type EventSubjects, type FollowRef, type Message } from "@/lib/rules/notifications";
import { Follow } from "@/models/Follow";
import { Match } from "@/models/Match";
import { Notification, type NotificationKind } from "@/models/Notification";
import { Player } from "@/models/Player";
import { PushSubscription } from "@/models/PushSubscription";
import type { IMatchEvent } from "@/models/MatchEvent";
import type { ISuspension } from "@/models/Suspension";

/** Web Push needs a VAPID key pair; without it the bell still works, only the phone's pop-up is missing. */
export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
function configureVapid() {
  if (vapidReady) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:soporte@supertorneos.com.co", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  vapidReady = true;
}

/** Sends a pop-up to every device of these people; devices that no longer exist are forgotten. */
async function pushTo(userIds: string[], payload: { title: string; body: string; url: string; tag: string }) {
  if (!pushConfigured() || userIds.length === 0) return;
  configureVapid();
  const subscriptions = await PushSubscription.find({ userId: { $in: userIds } }).lean();
  const body = JSON.stringify(payload);
  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, body, { TTL: 60 * 60 });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await PushSubscription.deleteOne({ _id: subscription._id });
        else console.error("Web push failed:", status ?? error);
      }
    })
  );
}

/** Notifies whoever follows something involved in the event: a bell entry for each, plus a pop-up on their devices. */
async function notify(kind: NotificationKind, subjects: EventSubjects, message: Message, url: string, actor: Actor | null, tag: string) {
  try {
    const types = audienceTypes(kind);
    const subjectIds = { championship: [subjects.championshipId], team: subjects.teamIds, player: subjects.playerIds };
    const follows = await Follow.find({ $or: types.map((targetType) => ({ targetType, targetId: { $in: subjectIds[targetType] } })) })
      .select("userId targetType targetId")
      .lean();
    const refs: FollowRef[] = follows.map((follow) => ({ userId: follow.userId.toString(), targetType: follow.targetType, targetId: follow.targetId.toString() }));
    const userIds = resolveAudience(kind, subjects, refs, actor?.userId);
    if (userIds.length === 0) return;
    await Notification.insertMany(userIds.map((userId) => ({ userId, kind, title: message.title, body: message.body, url })));
    await pushTo(userIds, { ...message, url, tag });
  } catch (error) {
    // Notifying is never allowed to break what caused it (a goal, a schedule...).
    console.error(`Failed to notify (${kind}):`, error);
  }
}

async function loadMatch(matchId: string | { toString(): string }) {
  const match = await Match.findById(matchId.toString())
    .populate<{ homeTeamId: { _id: unknown; name: string } }>({ path: "homeTeamId", select: "name" })
    .populate<{ awayTeamId: { _id: unknown; name: string } }>({ path: "awayTeamId", select: "name" })
    .lean();
  if (!match) return null;
  const summary = { homeName: match.homeTeamId.name, awayName: match.awayTeamId.name, homeScore: match.homeScore, awayScore: match.awayScore };
  const teamIds = [String(match.homeTeamId._id), String(match.awayTeamId._id)];
  return { match, summary, teamIds, url: `/matches/${match._id}` };
}

/** A match got a date or a new one. */
export async function notifyMatchScheduled(actor: Actor, matchId: string, previous: Date | null | undefined) {
  const loaded = await loadMatch(matchId);
  if (!loaded?.match.scheduledAt) return;
  const { match, summary, teamIds, url } = loaded;
  await notify(
    "match_scheduled",
    { championshipId: String(match.championshipId), teamIds, playerIds: [] },
    messages.scheduled(summary, match.scheduledAt!, Boolean(previous)),
    url,
    actor,
    `schedule-${match._id}`
  );
}

/** The match started or finished (the score is in the message). */
export async function notifyMatchState(actor: Actor, matchId: string, state: "started" | "finished") {
  const loaded = await loadMatch(matchId);
  if (!loaded) return;
  const { match, summary, teamIds, url } = loaded;
  await notify(
    state === "started" ? "match_started" : "match_finished",
    { championshipId: String(match.championshipId), teamIds, playerIds: [] },
    state === "started" ? messages.started(summary) : messages.finished(summary),
    url,
    actor,
    `${state}-${match._id}`
  );
}

/** A goal or a card was recorded. Both teams' followers hear about it, and the player's. */
export async function notifyMatchEvent(actor: Actor, event: Pick<IMatchEvent, "_id" | "matchId" | "type" | "playerId" | "minute">) {
  const kind: NotificationKind | null =
    event.type === "goal" || event.type === "penalty_goal" || event.type === "own_goal" ? "goal" : event.type === "yellow_card" ? "yellow_card" : event.type === "red_card" ? "red_card" : null;
  if (!kind || !event.playerId) return;
  const [loaded, player] = await Promise.all([loadMatch(event.matchId), Player.findById(event.playerId).select("fullName").lean()]);
  if (!loaded || !player) return;
  const { match, summary, teamIds, url } = loaded;
  const message =
    kind === "goal" ? messages.goal(summary, player.fullName, event.minute, event.type === "own_goal") : messages.card(summary, player.fullName, event.minute, kind === "red_card");
  await notify(kind, { championshipId: String(match.championshipId), teamIds, playerIds: [event.playerId.toString()] }, message, url, actor, `event-${event._id}`);
}

export async function notifySuspension(actor: Actor, suspension: Pick<ISuspension, "_id" | "championshipId" | "teamId" | "playerId" | "matchesToServe">) {
  const player = await Player.findById(suspension.playerId).select("fullName").lean();
  if (!player) return;
  await notify(
    "suspension",
    { championshipId: suspension.championshipId.toString(), teamIds: [suspension.teamId.toString()], playerIds: [suspension.playerId.toString()] },
    messages.suspension(player.fullName, suspension.matchesToServe),
    `/c/${suspension.championshipId}/sanciones`,
    actor,
    `suspension-${suspension._id}`
  );
}
