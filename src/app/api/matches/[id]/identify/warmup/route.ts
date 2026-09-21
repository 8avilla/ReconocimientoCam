import { json, route } from "@/lib/api";
import { warmIdentification } from "@/lib/services/verifications";

type Params = { id: string };

/** Prepares attendance by camera (models and the match's faces) while the operator is still choosing to start it. */
export const POST = route<Params>(async (_request, { id }) => json(await warmIdentification(id)));
