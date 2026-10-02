import { cached } from "@/lib/serverCache";

const CACHE_MS = 20_000;
import { json, route } from "@/lib/api";
import { getPlayerStats } from "@/lib/services/stats";

type Params = { id: string };

/** Top scorers, assists and cards from the non-voided events of finished matches. */
export const GET = route<Params>(async (_request, { id }) => json(await cached(`stats:${id}`, CACHE_MS, () => getPlayerStats(id))));
