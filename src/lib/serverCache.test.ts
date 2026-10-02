import { beforeEach, describe, expect, it, vi } from "vitest";
import { bumpDataVersion, cached, clearServerCache } from "./serverCache";

beforeEach(() => clearServerCache());

describe("cached", () => {
  it("computes once within the time and returns the same answer", async () => {
    const load = vi.fn().mockResolvedValue("A");
    expect(await cached("k", 1000, load, 0)).toBe("A");
    expect(await cached("k", 1000, load, 500)).toBe("A");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("computes again after the time is up", async () => {
    const load = vi.fn().mockResolvedValueOnce("A").mockResolvedValueOnce("B");
    await cached("k", 1000, load, 0);
    expect(await cached("k", 1000, load, 1001)).toBe("B");
  });

  it("any write invalidates every entry at once", async () => {
    const load = vi.fn().mockResolvedValueOnce("before").mockResolvedValueOnce("after");
    await cached("k", 60_000, load, 0);
    bumpDataVersion();
    expect(await cached("k", 60_000, load, 10)).toBe("after");
  });

  it("an answer that started before a write is not trusted afterwards", async () => {
    let finish!: (value: string) => void;
    const slow = cached("k", 60_000, () => new Promise<string>((resolve) => (finish = resolve)), 0);
    bumpDataVersion(); // a write while it was being computed
    finish("maybe old");
    await slow;
    const reload = vi.fn().mockResolvedValue("fresh");
    expect(await cached("k", 60_000, reload, 5)).toBe("fresh");
  });

  it("simultaneous callers share one run, and a failure is not remembered", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce("ok");
    const first = cached("k", 1000, load, 0);
    const second = cached("k", 1000, load, 0);
    expect(load).toHaveBeenCalledTimes(1);
    await expect(first).rejects.toThrow("db down");
    await expect(second).rejects.toThrow("db down");
    expect(await cached("k", 1000, load, 1)).toBe("ok");
  });
});
