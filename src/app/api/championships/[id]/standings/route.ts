import { json, route } from "@/lib/api";
import { getStandings } from "@/lib/services/stats";

type Params = { id: string };

/** League table computed from the finished matches. */
export const GET = route<Params>(async (_request, { id }) => json({ data: await getStandings(id) }));
