import mongoose from "mongoose";
import { Championship } from "@/models/Championship";

/** The address segment (`/c/<x>`) is either the real id or a custom slug — resolves whichever matches. */
export function findChampionshipByIdOrSlug(idOrSlug: string) {
  return Championship.findOne(mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug });
}
