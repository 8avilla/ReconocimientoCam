import { describe, expect, it } from "vitest";
import { screenBatchFor } from "./screenBatch";

describe("screenBatchFor", () => {
  it("each main screen of a championship asks for its own set, always starting from the address's championship", () => {
    const home = screenBatchFor("/c/ligaestrella");
    expect(home?.championship).toBe("ligaestrella");
    expect(home?.paths).toContain("/championships/:route");
    expect(home?.paths).toContain("/championships/:cid/stats");
    expect(screenBatchFor("/c/abc/partidos")?.paths).toEqual(expect.arrayContaining(["/championships/:cid/phases", "/teams?championshipId=:cid&limit=100", "/championships/:cid/matchdays"]));
    expect(screenBatchFor("/c/abc/clasificacion")?.paths).toContain("/championships/:cid/stats");
    expect(screenBatchFor("/c/abc/equipos")?.paths).toContain("/teams?championshipId=:cid&limit=100");
  });

  it("a match asks for its data by id, with no championship needed", () => {
    const id = "6abd0fc931eaaf62a34ffd8a";
    const batch = screenBatchFor(`/matches/${id}`);
    expect(batch?.championship).toBeUndefined();
    expect(batch?.paths).toEqual([`/matches/${id}`, `/matches/${id}/events`, `/matches/${id}/attendance`, `/suspensions?matchId=${id}&limit=50`]);
  });

  it("other addresses ask for nothing (one trip is not worth batching)", () => {
    for (const path of ["/", "/privacidad", "/perfil", "/c/abc/jugadores", "/c/abc/gestionar", "/matches/not-an-id", "/matches/6abd0fc931eaaf62a34ffd8a/planilla", "/teams/123"]) expect(screenBatchFor(path)).toBeNull();
  });

  it("the same address always gives the same paths, whatever the time (so the early request and the screen agree)", () => {
    expect(screenBatchFor("/c/abc")).toEqual(screenBatchFor("/c/abc"));
  });

  it("is self-contained: it still works when rebuilt from its own source text (as in the inline script)", () => {
    const rebuilt = new Function(`return (${screenBatchFor.toString()})`)() as typeof screenBatchFor;
    expect(rebuilt("/c/abc/equipos")).toEqual(screenBatchFor("/c/abc/equipos"));
    expect(rebuilt("/c/%C3%A1/partidos")?.championship).toBe("á");
  });
});
