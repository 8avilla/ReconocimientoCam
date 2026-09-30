/**
 * Marks a championship as the demo template that "Probar con una demo" clones for each user.
 * Usage: npm run demo:template -- "Liga Estrella"     (add --unset to remove the mark)
 */
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Championship } from "@/models/Championship";

async function main() {
  const [name, flag] = process.argv.slice(2);
  if (!name) throw new Error('Uso: npm run demo:template -- "Nombre del torneo" [--unset]');
  await connectToDatabase();
  const unset = flag === "--unset";
  if (!unset) await Championship.updateMany({ isDemoTemplate: true }, { $unset: { isDemoTemplate: 1 } });
  const result = await Championship.updateOne({ name }, unset ? { $unset: { isDemoTemplate: 1 } } : { $set: { isDemoTemplate: true } });
  if (result.matchedCount === 0) throw new Error(`No existe el torneo "${name}"`);
  console.log(unset ? `"${name}" ya no es plantilla de demo` : `"${name}" es ahora la plantilla de demo`);
  await mongoose.disconnect();
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
