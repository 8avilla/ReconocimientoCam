import { describe, expect, it } from "vitest";
import { fineBalance, fineStatus } from "./fines";

describe("fines", () => {
  it("derives the status from the payments", () => {
    expect(fineStatus("pending", 20000, 0)).toBe("pending");
    expect(fineStatus("pending", 20000, 5000)).toBe("partial");
    expect(fineStatus("partial", 20000, 20000)).toBe("paid");
    expect(fineStatus("paid", 20000, 10000)).toBe("partial");
    expect(fineStatus("paid", 20000, 0)).toBe("pending");
  });
  it("keeps waived and cancelled fines as they are", () => {
    expect(fineStatus("waived", 20000, 0)).toBe("waived");
    expect(fineStatus("cancelled", 20000, 20000)).toBe("cancelled");
  });
  it("computes the balance", () => {
    expect(fineBalance("partial", 20000, 5000)).toBe(15000);
    expect(fineBalance("paid", 20000, 20000)).toBe(0);
    expect(fineBalance("waived", 20000, 0)).toBe(0);
    expect(fineBalance("cancelled", 20000, 0)).toBe(0);
  });
});
