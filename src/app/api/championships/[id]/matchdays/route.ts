import { json, route } from "@/lib/api";
import { listChampionshipMatchdays } from "@/lib/services/matchdays";

type Params = { id: string };

/** All the matchdays (fechas) of the championship, grouped by phase order. */
export const GET = route<Params>(async (_request, { id }) => json({ data: await listChampionshipMatchdays(id) }));
