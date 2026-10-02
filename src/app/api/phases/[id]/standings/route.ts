import { cached } from "@/lib/serverCache";

const CACHE_MS = 20_000;
import { json, route } from "@/lib/api";
import { getPhaseStandings } from "@/lib/services/phases";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => json(await cached(`standings:${id}`, CACHE_MS, () => getPhaseStandings(id))));
