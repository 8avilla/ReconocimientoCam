/**
 * Spreadsheet export. The file is a CSV that Excel and Google Sheets open directly: UTF-8 with a BOM (accents),
 * `;` as separator (what Excel uses with Spanish regional settings) and CRLF line ends.
 */
const SEPARATOR = ";";

/** A cell starting with these is read as a formula by spreadsheets (CSV injection): a leading `'` keeps it as text. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Plain numbers keep their sign; only text that could be read as a formula is neutralised.
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return [headers, ...rows].map((row) => row.map(cell).join(SEPARATOR)).join("\r\n");
}

/** "Liga de las Estrella" + "posiciones" -> "liga-de-las-estrella-posiciones.csv" */
export function csvFileName(...parts: string[]): string {
  const slug = parts
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "reporte"}.csv`;
}

export function downloadCsv(fileName: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const blob = new Blob(["﻿", toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
