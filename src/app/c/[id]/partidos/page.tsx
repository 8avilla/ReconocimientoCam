import { MatchesView } from "@/components/match/MatchesView";

/** Filters come in the address (`?vista=resultados&fase=…&programacion=sin`), so a filtered list can be shared. */
export default function MatchesPage() {
  return <MatchesView />;
}
