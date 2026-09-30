"use client";

import { FileUp } from "lucide-react";
import { useToast } from "./Toast";

/** "Importar archivo": reads a CSV/TSV/TXT list on the device and hands its text over (Excel: copy and paste, or save as CSV). */
export function TextFileButton({ onText, label = "Importar archivo" }: { onText: (text: string) => void; label?: string }) {
  const toast = useToast();
  return (
    <label className="btn secondary small" style={{ cursor: "pointer" }}>
      <FileUp size={16} aria-hidden /> {label}
      <input
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
        style={{ display: "none" }}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 1_000_000) {
            toast.error("El archivo es demasiado grande");
            return;
          }
          onText(await file.text());
        }}
      />
    </label>
  );
}
