import { beforeEach, describe, expect, it, vi } from "vitest";
import { FRESH_MS, STALE_MAX_MS, fetchCache } from "./fetchCache";

beforeEach(() => fetchCache.clear());

describe("fetchCache", () => {
  it("remembers an answer and calls it fresh only for a few seconds", () => {
    fetchCache.put("/a", { n: 1 }, 1000);
    expect(fetchCache.peek("/a", 1000 + FRESH_MS - 1)).toEqual({ data: { n: 1 }, fresh: true });
    expect(fetchCache.peek("/a", 1000 + FRESH_MS + 1)).toEqual({ data: { n: 1 }, fresh: false });
  });

  it("does not show very old answers", () => {
    fetchCache.put("/a", 1, 1000);
    expect(fetchCache.peek("/a", 1000 + STALE_MAX_MS + 1)).toBeNull();
    expect(fetchCache.peek("/never")).toBeNull();
  });

  it("sends one request for simultaneous callers and stores the answer", async () => {
    const load = vi.fn().mockResolvedValue({ ok: true });
    const [first, second] = await Promise.all([fetchCache.shared("/a", load), fetchCache.shared("/a", load)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(fetchCache.peek("/a")?.data).toEqual({ ok: true });
  });

  it("asks again once the first request is over", async () => {
    const load = vi.fn().mockResolvedValue(1);
    await fetchCache.shared("/a", load);
    await fetchCache.shared("/a", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not store a failure and lets the next caller retry", async () => {
    await expect(fetchCache.shared("/a", () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(fetchCache.peek("/a")).toBeNull();
    await expect(fetchCache.shared("/a", () => Promise.resolve(2))).resolves.toBe(2);
  });

  it("an answer that arrives after clear() is not put back (it may be from before the change)", async () => {
    let finish!: (value: string) => void;
    const slow = fetchCache.shared("/a", () => new Promise<string>((resolve) => (finish = resolve)));
    fetchCache.clear();
    finish("old");
    await slow;
    expect(fetchCache.peek("/a")).toBeNull();
  });

  it("waits for a combined request in flight and uses what it brought", async () => {
    let finish!: () => void;
    fetchCache.trackBatch(new Promise<void>((resolve) => (finish = () => { fetchCache.put("/a", "from batch"); resolve(); })));
    const load = vi.fn().mockResolvedValue("from network");
    const answer = fetchCache.shared("/a", load);
    finish();
    expect(await answer).toBe("from batch");
    expect(load).not.toHaveBeenCalled();
  });

  it("asks the network for what the combined request did not bring, or when it failed", async () => {
    fetchCache.trackBatch(Promise.resolve());
    expect(await fetchCache.shared("/b", () => Promise.resolve("network"))).toBe("network");
    fetchCache.trackBatch(Promise.reject(new Error("batch down")));
    expect(await fetchCache.shared("/c", () => Promise.resolve("network again"))).toBe("network again");
  });

  it("hands back a recent answer without asking, but only when told it may", async () => {
    fetchCache.put("/a", "recent");
    const load = vi.fn().mockResolvedValue("network");
    expect(await fetchCache.shared("/a", load, true)).toBe("recent");
    expect(load).not.toHaveBeenCalled();
    expect(await fetchCache.shared("/a", load)).toBe("network"); // a manual reload always asks
  });

  it("keeps at most a couple of hundred answers, dropping the oldest", () => {
    for (let i = 0; i < 205; i++) fetchCache.put(`/p${i}`, i, 1000);
    expect(fetchCache.peek("/p0", 1000)).toBeNull();
    expect(fetchCache.peek("/p204", 1000)?.data).toBe(204);
  });
});
