import { json, route } from "@/lib/api";
import { getBracket } from "@/lib/services/knockout";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => json(await getBracket(id)));
