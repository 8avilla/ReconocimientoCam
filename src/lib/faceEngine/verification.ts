import type { VerificationResult } from "@/models/IdentityVerification";

export interface VerificationThresholds {
  verifyThreshold: number;
  reviewThreshold: number;
}

/**
 * Maps a cosine similarity to a verification outcome:
 * >= verifyThreshold -> verified, >= reviewThreshold -> review, otherwise mismatch.
 */
export function classifySimilarity(score: number, thresholds: VerificationThresholds): VerificationResult {
  if (score >= thresholds.verifyThreshold) return "verified";
  if (score >= thresholds.reviewThreshold) return "review";
  return "mismatch";
}
