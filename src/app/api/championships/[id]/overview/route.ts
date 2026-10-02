import { cached } from "@/lib/serverCache";

const CACHE_MS = 20_000;
import { json, route } from "@/lib/api";
import { getOverview } from "@/lib/services/overview";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => json(await cached(`overview:${id}`, CACHE_MS, () => getOverview(id))));
