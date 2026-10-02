import { describe, expect, it, vi } from "vitest";
import { createOutbox } from "./outbox";
import { applyPendingOps } from "./outboxApply";
import { HttpError } from "./http";
import type { AttendanceDTO, AttendanceRowDTO } from "@/types/api";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

function build(send: (path: string, payload: Record<string, unknown>) => Promise<unknown>, storage = memoryStorage()) {
  let n = 0;
  return { storage, outbox: createOutbox({ storage, send, now: () => new Date("2026-10-03T12:00:00Z"), newId: () => `op${++n}` }) };
}

const offlineError = () => new HttpError(0, "No hay conexión con el servidor", "network_error");

describe("outbox.submit", () => {
  it("sends right away when online and nothing is waiting, stamping when it happened", async () => {
    const send = vi.fn().mockResolvedValue({ updated: ["p1"] });
    const { outbox } = build(send);
    const result = await outbox.submit("m1", "/matches/m1/check-ins/bulk", { status: "present", playerIds: ["p1"] }, true);
    expect(result).toEqual({ queued: false, result: { updated: ["p1"] } });
    expect(send).toHaveBeenCalledWith("/matches/m1/check-ins/bulk", { status: "present", playerIds: ["p1"], occurredAt: "2026-10-03T12:00:00.000Z" });
    expect(outbox.getState().pending).toHaveLength(0);
  });

  it("queues when the device is offline, without calling the server", async () => {
    const send = vi.fn();
    const { outbox } = build(send);
    expect(await outbox.submit("m1", "/p", { status: "present" }, false)).toEqual({ queued: true });
    expect(send).not.toHaveBeenCalled();
    expect(outbox.getState().pending).toHaveLength(1);
  });

  it("queues when the request fails because of the connection", async () => {
    const { outbox } = build(vi.fn().mockRejectedValue(offlineError()));
    expect(await outbox.submit("m1", "/p", { status: "present" }, true)).toEqual({ queued: true });
  });

  it("does not hide a real refusal from the server", async () => {
    const { outbox } = build(vi.fn().mockRejectedValue(new HttpError(409, "El partido no admite registro", "match_not_open")));
    await expect(outbox.submit("m1", "/p", { status: "present" }, true)).rejects.toThrow("El partido no admite registro");
    expect(outbox.getState().pending).toHaveLength(0);
  });

  it("queues behind older changes so a player's changes keep their order", async () => {
    const send = vi.fn();
    const { outbox } = build(send);
    await outbox.submit("m1", "/p", { status: "present", playerIds: ["p1"] }, false);
    expect(await outbox.submit("m1", "/p", { status: "absent", playerIds: ["p1"] }, true)).toEqual({ queued: true });
    expect(send).not.toHaveBeenCalled();
    expect(outbox.getState().pending.map((op) => op.id)).toEqual(["op1", "op2"]);
  });

  it("survives a reload: the queue is read back from storage", async () => {
    const { outbox, storage } = build(vi.fn());
    await outbox.submit("m1", "/p", { status: "present" }, false);
    expect(build(vi.fn(), storage).outbox.getState().pending).toHaveLength(1);
  });
});

describe("outbox.flush", () => {
  it("replays in order with the original time and empties the queue", async () => {
    const send = vi.fn().mockResolvedValue({});
    const { outbox } = build(send);
    await outbox.submit("m1", "/a", { n: 1 }, false);
    await outbox.submit("m1", "/b", { n: 2 }, false);
    await outbox.flush();
    expect(send.mock.calls.map((call) => call[0])).toEqual(["/a", "/b"]);
    expect(send.mock.calls[0][1]).toMatchObject({ occurredAt: "2026-10-03T12:00:00.000Z" });
    expect(outbox.getState().pending).toHaveLength(0);
    expect(outbox.getState().syncedCount).toBe(2);
  });

  it("stops at a connection failure and keeps the rest for later", async () => {
    const send = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(offlineError());
    const { outbox } = build(send);
    for (const path of ["/a", "/b", "/c"]) await outbox.submit("m1", path, {}, false);
    await outbox.flush();
    expect(outbox.getState().pending.map((op) => op.path)).toEqual(["/b", "/c"]);
    expect(outbox.getState().syncedCount).toBe(1);
  });

  it("moves a change the server refuses to the rejected list and goes on with the next", async () => {
    const send = vi.fn().mockRejectedValueOnce(new HttpError(409, "Ya hay un registro más reciente", "stale_offline")).mockResolvedValueOnce({});
    const { outbox } = build(send);
    await outbox.submit("m1", "/a", {}, false);
    await outbox.submit("m1", "/b", {}, false);
    await outbox.flush();
    expect(outbox.getState().pending).toHaveLength(0);
    expect(outbox.getState().rejected).toMatchObject([{ op: { path: "/a" }, message: "Ya hay un registro más reciente" }]);
    outbox.dismissRejected();
    expect(outbox.getState().rejected).toHaveLength(0);
  });

  it("keeps everything and asks to sign in again when the session expired", async () => {
    const { outbox } = build(vi.fn().mockRejectedValue(new HttpError(401, "Inicia sesión", "unauthenticated")));
    await outbox.submit("m1", "/a", {}, false);
    await outbox.flush();
    expect(outbox.getState().pending).toHaveLength(1);
    expect(outbox.getState().needsSignIn).toBe(true);
  });
});

describe("applyPendingOps", () => {
  const row = (id: string, teamId: string, status: AttendanceRowDTO["status"], registrationStatus: AttendanceRowDTO["registrationStatus"] = "active"): AttendanceRowDTO => ({
    _id: `c-${id}`, teamId, status, shirtNumber: 1, position: null, registrationStatus,
    playerId: { _id: id, publicId: `pub-${id}`, fullName: `Jugador ${id}`, photoUrl: "" },
  });
  const attendance: AttendanceDTO = {
    checkIns: [row("p1", "t1", "pending"), row("p2", "t1", "pending"), row("p3", "t1", "pending", "suspended"), row("p4", "t2", "pending")],
    summary: { called: 4, present: 0, absent: 0, pending: 4, verified: 0 },
    suspended: [],
  };
  const op = (payload: Record<string, unknown>, matchId = "m1") => ({ id: "x", matchId, path: "/p", payload, occurredAt: "2026-10-03T12:00:00.000Z" });

  it("marks the listed players and flags them as not synced", () => {
    const result = applyPendingOps(attendance, [op({ status: "present", playerIds: ["p1"] })], "m1");
    expect(result.checkIns[0]).toMatchObject({ status: "present", method: "manual", pendingSync: true });
    expect(result.checkIns[1].status).toBe("pending");
    expect(result.summary).toMatchObject({ present: 1, pending: 3 });
  });

  it("marking a whole team present skips players who cannot play", () => {
    const result = applyPendingOps(attendance, [op({ status: "present", teamId: "t1" })], "m1");
    expect(result.checkIns.map((r) => r.status)).toEqual(["present", "present", "pending", "pending"]);
  });

  it("applies changes in order: present, then undone", () => {
    const result = applyPendingOps(attendance, [op({ status: "present", playerIds: ["p1"] }), op({ status: "pending", playerIds: ["p1"] })], "m1");
    expect(result.checkIns[0]).toMatchObject({ status: "pending", checkedInAt: undefined });
  });

  it("a single manual check-in keeps its reason", () => {
    const result = applyPendingOps(attendance, [op({ playerId: "p4", status: "absent", method: "manual", reason: "Sin carnet" })], "m1");
    expect(result.checkIns[3]).toMatchObject({ status: "absent", manualReason: "Sin carnet" });
  });

  it("ignores changes of other matches and returns the same object when there is nothing to apply", () => {
    expect(applyPendingOps(attendance, [op({ status: "present", playerIds: ["p1"] }, "other")], "m1")).toBe(attendance);
  });
});
