import { json, route } from "@/lib/api";
import { getPhaseStandings } from "@/lib/services/phases";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => json(await getPhaseStandings(id)));
