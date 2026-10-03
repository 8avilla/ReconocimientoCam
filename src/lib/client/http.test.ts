import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCache } from "./fetchCache";
import { http } from "./http";

function answer(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

beforeEach(() => {
  fetchCache.clear();
  vi.stubGlobal("window", { localStorage: { getItem: () => null } });
});
afterEach(() => vi.unstubAllGlobals());

describe("http and the screens' memory", () => {
  it("a saved change empties what screens remembered, so the next visit asks again", async () => {
    fetchCache.put("/phases/p1/standings", { stale: true });
    vi.stubGlobal("fetch", vi.fn(() => answer({ ok: true })));
    await http("/matches/m1/transition", { json: { action: "finish" } });
    expect(fetchCache.peek("/phases/p1/standings")).toBeNull();
  });

  it("any non-GET counts (PATCH, DELETE), reading does not", async () => {
    vi.stubGlobal("fetch", vi.fn(() => answer({ ok: true })));
    fetchCache.put("/a", 1);
    await http("/matches/m1");
    expect(fetchCache.peek("/a")).not.toBeNull();
    await http("/matches/m1", { method: "PATCH", json: { status: "finished" } });
    expect(fetchCache.peek("/a")).toBeNull();
    fetchCache.put("/a", 1);
    await http("/matches/m1", { method: "DELETE" });
    expect(fetchCache.peek("/a")).toBeNull();
  });

  it("a change that failed changed nothing: the memory is kept", async () => {
    fetchCache.put("/a", 1);
    vi.stubGlobal("fetch", vi.fn(() => answer({ error: "no", code: "x" }, 409)));
    await expect(http("/matches/m1/transition", { json: { action: "finish" } })).rejects.toThrow("no");
    expect(fetchCache.peek("/a")).not.toBeNull();
  });
});
