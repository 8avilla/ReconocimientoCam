import { Types } from "mongoose";
import sharp from "sharp";
import type { Actor } from "@/lib/actor";
import { badRequest, conflict, notFound } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { deleteImage, uploadImage } from "@/lib/azureBlob";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { fineBalance, fineStatus } from "@/lib/rules/fines";
import { Fine, type FineStatus, type FineType, type IFine, type PaymentMethod } from "@/models/Fine";
import { Team } from "@/models/Team";

interface CardFineInput {
  championshipId: Types.ObjectId;
  teamId: Types.ObjectId;
  playerId: Types.ObjectId;
  matchId: Types.ObjectId;
  eventId: Types.ObjectId;
  type: "yellow_card" | "red_card";
  amount: number;
  concept: string;
}

/** Charges the card fine set by the championship rules (nothing when the amount is 0). Idempotent per event. */
export async function createCardFine(actor: Actor, input: CardFineInput) {
  if (input.amount <= 0) return null;
  if (await Fine.exists({ eventId: input.eventId })) return null;
  const fine = await Fine.create({ ...input, createdBy: actor.name });
  await recordAudit(actor, {
    action: "create",
    entityType: "fine",
    entityId: fine._id,
    championshipId: input.championshipId,
    summary: `Multa por ${input.concept.toLowerCase()}: $${input.amount}`,
    changes: { teamId: input.teamId.toString(), playerId: input.playerId.toString(), eventId: input.eventId.toString() },
  });
  return fine;
}

interface RegistrationFineInput {
  championshipId: Types.ObjectId;
  teamId: Types.ObjectId;
  amount: number;
}

/**
 * Charges the team's registration fee set by the championship rules (nothing when the amount is 0 or the
 * team already has one). The existence check isn't atomic with the insert, so two near-simultaneous calls
 * (e.g. the fines list backfilling several teams at once) could both pass it — the schema's unique index
 * on (teamId, type: "registration") is the real guard; a duplicate-key error here just means the other
 * call won the race, which is fine.
 */
export async function createRegistrationFine(actor: Actor, input: RegistrationFineInput) {
  if (input.amount <= 0) return null;
  if (await Fine.exists({ teamId: input.teamId, type: "registration" })) return null;
  let fine;
  try {
    fine = await Fine.create({ ...input, type: "registration", concept: "Inscripción al campeonato", createdBy: actor.name });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) return null;
    throw error;
  }
  await recordAudit(actor, {
    action: "create",
    entityType: "fine",
    entityId: fine._id,
    championshipId: input.championshipId,
    summary: `Cuota de inscripción: $${input.amount}`,
    changes: { teamId: input.teamId.toString() },
  });
  return fine;
}

/**
 * Every team gets a registration fine once the fee is set — including teams that joined before the fee
 * existed, or before it was raised above 0. Missing ones are created here (idempotent, via
 * `createRegistrationFine`'s own check) so the "Cuotas de inscripción" list always covers every team,
 * whichever came first: the team or the fee.
 */
export async function ensureRegistrationFines(actor: Actor, championshipId: Types.ObjectId, amount: number) {
  if (amount <= 0) return;
  const teams = await Team.find({ championshipId }).select("_id").lean();
  await Promise.all(teams.map((team) => createRegistrationFine(actor, { championshipId, teamId: team._id, amount })));
}

/**
 * Keeps every registration fine in step with the championship's current fee, so a team's balance always
 * reflects the current rule instead of a frozen snapshot from when it registered. Waived fines are left
 * alone — those were settled explicitly, another way. Turning the fee off (0) only cancels fines with
 * nothing collected yet (pending); a partial or full payment is real money received, so it must stay
 * visible in the money summary rather than disappear because the fee later got disabled. Turning the fee
 * back on revives any fine this same function had cancelled (a team can't be stuck "cancelled" forever
 * just because the fee was off for a while).
 */
export async function syncRegistrationFeeAmount(championshipId: Types.ObjectId, amount: number) {
  const fines = await Fine.find({ championshipId, type: "registration", status: { $in: ["pending", "partial", "paid", "cancelled"] } });
  for (const fine of fines) {
    if (amount <= 0) {
      if (fine.status === "pending") fine.status = "cancelled";
    } else {
      fine.amount = amount;
      fine.status = fineStatus(fine.status === "cancelled" ? "pending" : fine.status, fine.amount, fine.paidAmount);
    }
    await fine.save();
  }
}

/**
 * The card events were voided: unpaid fines are cancelled; when money was already received the fine stays
 * (marked) so the organizer can decide to return it by removing the payment.
 */
export async function voidFinesForEvents(actor: Actor, eventIds: Types.ObjectId[]) {
  const fines = await Fine.find({ eventId: { $in: eventIds }, status: { $ne: "cancelled" } });
  for (const fine of fines) {
    if (fine.paidAmount > 0) fine.eventVoided = true;
    else fine.status = "cancelled";
    await fine.save();
    await recordAudit(actor, {
      action: "void",
      entityType: "fine",
      entityId: fine._id,
      championshipId: fine.championshipId,
      summary: fine.paidAmount > 0 ? "Multa con pagos: la tarjeta fue anulada" : "Multa cancelada: la tarjeta fue anulada",
    });
  }
}

export interface FineListFilter {
  championshipId: string;
  teamId?: string;
  status?: "open" | "paid" | "waived" | "cancelled";
  /** Defaults to every type except "registration" — team registration fees have their own view (in Equipos), so they stay out of the general Multas list unless asked for explicitly. */
  type?: FineType;
  skip: number;
  limit: number;
}

export async function listFines(input: FineListFilter) {
  const championshipId = new Types.ObjectId(input.championshipId);
  const statusFilter: { status?: FineStatus | { $in: FineStatus[] } } = input.status === "open" ? { status: { $in: ["pending", "partial"] } } : input.status ? { status: input.status } : {};
  const typeFilter: { type: FineType | { $ne: FineType } } = input.type ? { type: input.type } : { type: { $ne: "registration" } };
  const filter = { championshipId, ...(input.teamId ? { teamId: new Types.ObjectId(input.teamId) } : {}), ...statusFilter, ...typeFilter };

  const [data, total, open] = await Promise.all([
    Fine.find(filter)
      .sort({ createdAt: -1 })
      .skip(input.skip)
      .limit(input.limit)
      .populate({ path: "playerId", select: "fullName photoUrl" })
      .populate({ path: "teamId", select: "name shieldUrl" })
      .populate({ path: "matchId", select: "homeTeamId awayTeamId", populate: [{ path: "homeTeamId", select: "name" }, { path: "awayTeamId", select: "name" }] })
      .lean(),
    Fine.countDocuments(filter),
    // Money picture of the whole championship (ignoring team/status filters, but keeping the type split).
    Fine.aggregate<{ _id: Types.ObjectId; owed: number; collected: number }>([
      { $match: { championshipId, status: { $ne: "cancelled" }, ...typeFilter } },
      {
        $group: {
          _id: "$teamId",
          owed: { $sum: { $cond: [{ $in: ["$status", ["pending", "partial"]] }, { $subtract: ["$amount", "$paidAmount"] }, 0] } },
          collected: { $sum: "$paidAmount" },
        },
      },
    ]),
  ]);

  const teams = await Team.find({ _id: { $in: open.map((row) => row._id) } }).select("name shieldUrl").lean();
  const teamById = new Map(teams.map((team) => [team._id.toString(), team]));
  const summary = {
    owed: open.reduce((sum, row) => sum + row.owed, 0),
    collected: open.reduce((sum, row) => sum + row.collected, 0),
    byTeam: open
      .filter((row) => row.owed > 0)
      .map((row) => ({ teamId: row._id.toString(), name: teamById.get(row._id.toString())?.name ?? "", shieldUrl: teamById.get(row._id.toString())?.shieldUrl ?? "", owed: row.owed }))
      .sort((a, b) => b.owed - a.owed),
  };
  return { data, total, summary };
}

/** Receipts are photos: scaled down and stored as JPEG to keep them light. */
async function normalizeReceipt(dataUrl: string): Promise<Buffer> {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return sharp(Buffer.from(base64, "base64")).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
}

async function loadFine(id: string) {
  const fine = await Fine.findById(id);
  if (!fine) throw notFound("Multa no encontrada");
  return fine;
}

function refresh(fine: InstanceType<typeof Fine>) {
  fine.paidAmount = fine.payments.reduce((sum, payment) => sum + payment.amount, 0);
  fine.status = fineStatus(fine.status, fine.amount, fine.paidAmount);
}

export async function addPayment(actor: Actor, id: string, input: { amount: number; method: PaymentMethod; note?: string; receipt?: string }) {
  const fine = await loadFine(id);
  await requireOrganizerOfChampionship(actor, fine.championshipId);
  if (fine.status === "cancelled" || fine.status === "waived") throw conflict("Esta multa ya no se cobra", "fine_closed");
  const balance = fineBalance(fine.status, fine.amount, fine.paidAmount);
  if (balance <= 0) throw conflict("La multa ya está pagada", "fine_paid");
  if (input.amount > balance) throw badRequest(`El pago supera lo que se debe ($${balance})`);
  const receipt = input.receipt ? await uploadImage(await normalizeReceipt(input.receipt), "fines/receipts", "image/jpeg") : undefined;
  fine.payments.push({
    amount: input.amount, method: input.method, note: input.note, paidAt: new Date(), receivedBy: actor.name,
    receiptUrl: receipt?.url, receiptBlobName: receipt?.blobName,
  } as IFine["payments"][number]);
  refresh(fine);
  await fine.save();
  await recordAudit(actor, {
    action: "pay",
    entityType: "fine",
    entityId: fine._id,
    championshipId: fine.championshipId,
    summary: `Pago de $${input.amount} (${fine.status === "paid" ? "multa pagada" : "pago parcial"})`,
    changes: { method: input.method, paidAmount: fine.paidAmount, receipt: Boolean(receipt) },
  });
  return fine;
}

/** Removes a registered payment (e.g. it was a mistake or the money was returned). */
export async function removePayment(actor: Actor, id: string, paymentId: string) {
  const fine = await loadFine(id);
  await requireOrganizerOfChampionship(actor, fine.championshipId);
  const payment = fine.payments.find((item) => item._id.toString() === paymentId);
  if (!payment) throw notFound("Pago no encontrado");
  const amount = payment.amount;
  if (payment.receiptBlobName) await deleteImage(payment.receiptBlobName).catch((error) => console.error("Failed to delete receipt:", error));
  fine.set("payments", fine.payments.filter((item) => item._id.toString() !== paymentId));
  refresh(fine);
  // A fine whose card was voided and that owes nothing any more is closed.
  if (fine.eventVoided && fine.paidAmount === 0) fine.status = "cancelled";
  await fine.save();
  await recordAudit(actor, { action: "update", entityType: "fine", entityId: fine._id, championshipId: fine.championshipId, summary: `Pago de $${amount} eliminado` });
  return fine;
}

export async function waiveFine(actor: Actor, id: string, note?: string) {
  const fine = await loadFine(id);
  await requireOrganizerOfChampionship(actor, fine.championshipId);
  if (fine.status === "paid" || fine.status === "cancelled") throw conflict("Esta multa no se puede perdonar", "fine_closed");
  fine.status = "waived";
  if (note) fine.note = note;
  await fine.save();
  await recordAudit(actor, { action: "update", entityType: "fine", entityId: fine._id, championshipId: fine.championshipId, summary: "Multa perdonada", changes: { note } });
  return fine;
}

export async function reopenFine(actor: Actor, id: string) {
  const fine = await loadFine(id);
  await requireOrganizerOfChampionship(actor, fine.championshipId);
  if (fine.status !== "waived") throw conflict("Solo se reabre una multa perdonada", "fine_not_waived");
  fine.status = "pending";
  refresh(fine);
  await fine.save();
  await recordAudit(actor, { action: "update", entityType: "fine", entityId: fine._id, championshipId: fine.championshipId, summary: "Multa reabierta" });
  return fine;
}

export async function createManualFine(actor: Actor, input: { championshipId: string; teamId: string; playerId?: string; amount: number; concept: string }) {
  await requireOrganizerOfChampionship(actor, input.championshipId);
  const team = await Team.findOne({ _id: input.teamId, championshipId: input.championshipId }).select("_id").lean();
  if (!team) throw notFound("El equipo no pertenece a este campeonato");
  const fine = await Fine.create({ ...input, type: "manual", createdBy: actor.name });
  await recordAudit(actor, {
    action: "create",
    entityType: "fine",
    entityId: fine._id,
    championshipId: fine.championshipId,
    summary: `Multa manual: ${input.concept} ($${input.amount})`,
  });
  return fine;
}
