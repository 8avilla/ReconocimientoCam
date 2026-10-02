import { execFileSync } from "node:child_process";

/** Everything the tests create is owned by a user whose email starts with this. */
export const QA_PREFIX = "zz-qa-";
export const qaEmail = (name: string) => `${QA_PREFIX}${name}@example.com`;

/** The project's own code (models, services) runs through tsx, outside Playwright's module loader. */
function run(...args: string[]): Record<string, unknown> {
  const output = execFileSync("npx", ["tsx", "--env-file=.env.local", "scripts/e2e-db.ts", ...args], { encoding: "utf8" });
  return JSON.parse(output.trim().split("\n").pop() ?? "{}");
}

export const E2E_PASSWORD = "E2e-Password-1";

/** A verified email/password account (the real sign-in, which also works against a production build). */
export async function createUser(email: string, name: string): Promise<void> {
  run("create-user", email, name);
}

/** A private copy of the demo championship owned by `email` (who must have signed in once). */
export async function createDemo(email: string): Promise<{ championshipId: string }> {
  return run("create-demo", email) as { championshipId: string };
}

/** Removes the demos and the test users (with their follows, notifications and devices). */
export async function cleanupQa(): Promise<void> {
  run("cleanup");
}

export async function closeDb(): Promise<void> {
  // Nothing to close: every call is its own process.
}
