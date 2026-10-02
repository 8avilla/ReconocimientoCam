import { NextRequest } from "next/server";
import { MAX_TOTAL, type BatchResult, findBatchable, followUps, parseBatchPath } from "@/lib/batch";

type Handler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Runs one GET through the very handler a direct request would reach. */
async function runOne(full: string, origin: string, headers: Headers): Promise<BatchResult> {
  const parsed = parseBatchPath(full);
  const target = parsed && findBatchable(parsed.pathname);
  if (!parsed || !target) return { status: 404, body: { error: "Ese recurso no se puede pedir en lote", code: "not_batchable" } };
  const { GET } = (await target.entry.load()) as { GET: Handler };
  const response = await GET(new NextRequest(new URL(`/api${full}`, origin), { headers }), { params: Promise.resolve(target.params) });
  return { status: response.status, body: await response.json().catch(() => null) };
}

/**
 * Answers every path in parallel, then the ones those answers lead to (see `followUps`), up to two rounds.
 * Results are filed under the exact address, which is what the screen will later ask for.
 */
export async function runBatch(paths: string[], origin: string, headers: Headers): Promise<Record<string, BatchResult>> {
  const results: Record<string, BatchResult> = {};
  let queue = [...new Set(paths)];
  for (let round = 0; round < 3 && queue.length > 0; round++) {
    queue = queue.filter((path) => !(path in results)).slice(0, Math.max(0, MAX_TOTAL - Object.keys(results).length));
    const answers = await Promise.all(queue.map(async (path) => [path, await runOne(path, origin, headers).catch(() => ({ status: 500, body: null }))] as const));
    const next: string[] = [];
    for (const [path, result] of answers) {
      results[path] = result;
      if (result.status === 200) next.push(...followUps(path.split("?")[0], result.body));
    }
    queue = [...new Set(next)];
  }
  return results;
}
