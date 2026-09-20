import { json, parseQuery, route } from "@/lib/api";
import { lookupPlayer } from "@/lib/services/verifications";
import { lookupQuery } from "@/lib/validation/schemas";

type Params = { id: string };

/** Identifies a called-up player from a scanned QR payload or a typed document number. */
export const GET = route<Params>(async (request, { id }) => {
  const { code } = parseQuery(request, lookupQuery);
  return json(await lookupPlayer(id, code));
});
