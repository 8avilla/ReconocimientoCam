import { ChampionshipsView } from "@/components/championship/ChampionshipsView";

/** Entry point: the championships to follow or organize. Everything else lives inside one of them (`/c/<id>/…`). */
export default function HomePage() {
  return <ChampionshipsView />;
}
