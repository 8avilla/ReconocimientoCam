/**
 * Runs once when the server starts: opens the database connection (and compiles the models) and loads the read handlers
 * before the first person arrives, so that visit does not also pay for them.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase().catch((error) => console.error("Could not warm the database connection:", error.message));
  // Also load the handlers a combined request uses: the first one after a start would otherwise spend a second loading them.
  const { BATCHABLE } = await import("@/lib/batch");
  await Promise.all(BATCHABLE.map((entry) => entry.load())).catch(() => undefined);
}
