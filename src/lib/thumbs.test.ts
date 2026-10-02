import { describe, expect, it } from "vitest";
import { thumbName } from "./thumbs";

describe("thumbName", () => {
  it("puts _s before the extension for images shown as avatars, in a URL or a blob name", () => {
    expect(thumbName("players/photos/2026-09-30/abc.jpg")).toBe("players/photos/2026-09-30/abc_s.jpg");
    expect(thumbName("https://acct.blob.core.windows.net/uploads/teams/shields/2026-09-30/x.png")).toBe("https://acct.blob.core.windows.net/uploads/teams/shields/2026-09-30/x_s.png");
    expect(thumbName("https://acct.blob.core.windows.net/uploads/players/faces/d/y.jpg?sv=1")).toBe("https://acct.blob.core.windows.net/uploads/players/faces/d/y_s.jpg");
  });

  it("has none for other folders (gallery, receipts, check-ins) or other files", () => {
    expect(thumbName("players/gallery/d/a.jpg")).toBeNull();
    expect(thumbName("fines/receipts/d/a.jpg")).toBeNull();
    expect(thumbName("players/photos/d/a.gif")).toBeNull();
    expect(thumbName("/icon-512.png")).toBeNull();
  });
});
