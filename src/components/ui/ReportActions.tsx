"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "./Button";

interface Props {
  /** Downloads the spreadsheet (CSV that Excel opens). */
  onDownload?: () => void;
  /** Opens the browser's print dialog, where "Guardar como PDF" is an option. */
  onPrint?: () => void;
  /** What is being exported, for screen readers ("la tabla de posiciones"). */
  subject: string;
}

/** The "Excel" and "PDF" buttons next to a list; both act on what the screen is showing. */
export function ReportActions({ onDownload, onPrint, subject }: Props) {
  return (
    <div className="row no-print" style={{ gap: "var(--space-sm)", flexWrap: "wrap" }} role="group" aria-label={`Exportar ${subject}`}>
      {onDownload && (
        <Button variant="secondary" size="small" icon={<Download size={16} />} onClick={onDownload} aria-label={`Descargar ${subject} en Excel`}>
          Excel
        </Button>
      )}
      {onPrint && (
        <Button variant="secondary" size="small" icon={<Printer size={16} />} onClick={onPrint} aria-label={`Imprimir ${subject} o guardar como PDF`}>
          PDF
        </Button>
      )}
    </div>
  );
}
