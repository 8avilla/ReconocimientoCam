import { json, notFound, route } from "@/lib/api";
import { getAttendance } from "@/lib/services/checkins";
import { Match } from "@/models/Match";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => {
  const match = await Match.exists({ _id: id });
  if (!match) throw notFound("Partido no encontrado");
  return json(await getAttendance(id));
});
