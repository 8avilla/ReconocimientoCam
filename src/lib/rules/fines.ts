import type { FineStatus } from "@/models/Fine";

/** Status of a fine from what has been paid; waived and cancelled fines keep their status. */
export function fineStatus(current: FineStatus, amount: number, paidAmount: number): FineStatus {
  if (current === "waived" || current === "cancelled") return current;
  if (paidAmount <= 0) return "pending";
  return paidAmount >= amount ? "paid" : "partial";
}

/** What is still owed on a fine (nothing when it was waived or cancelled). */
export function fineBalance(status: FineStatus, amount: number, paidAmount: number): number {
  return status === "waived" || status === "cancelled" ? 0 : Math.max(0, amount - paidAmount);
}
