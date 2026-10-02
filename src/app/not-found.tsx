import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState
      icon={<SearchX size={28} />}
      title="No encontramos esta página"
      description="El enlace puede estar mal escrito o la página ya no existe."
      action={<Link href="/" className="btn primary">Ir al inicio</Link>}
    />
  );
}
