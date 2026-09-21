import { json, route } from "@/lib/api";
import { getOverview } from "@/lib/services/overview";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => json(await getOverview(id)));
