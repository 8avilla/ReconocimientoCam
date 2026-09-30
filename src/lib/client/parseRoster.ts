import { POSITIONS, type Position } from "@/lib/constants";

export interface RosterLine {
  fullName: string;
  shirtNumber?: number;
  position?: Position;
}

const positionOf = (token: string): Position | undefined => {
  const normalized = token.trim().toLowerCase();
  return POSITIONS.find((position) => position.toLowerCase() === normalized || `${position.toLowerCase()}s` === normalized);
};

/**
 * Turns pasted text (one player per line, as typed or copied from WhatsApp/Excel) into players. Each line may carry
 * a shirt number at the start or the end and a position, separated by commas, semicolons, tabs or spaces:
 * "10 Juan Pérez", "Juan Pérez, 10, Delantero", "Juan Pérez 10". Bullets and numbering ("1.", "-", "•") are ignored.
 */
export function parseRoster(text: string): RosterLine[] {
  const lines: RosterLine[] = [];
  for (const raw of withoutHeader(text)) {
    let line = raw.replace(/^[\s•\-*·]+/, "").trim();
    if (!line) continue;

    const parts = line.split(/[,;\t]/).map((part) => part.trim()).filter(Boolean);
    let shirtNumber: number | undefined;
    let position: Position | undefined;
    const rest: string[] = [];
    for (const part of parts) {
      const asPosition = positionOf(part);
      if (asPosition && !position) position = asPosition;
      else if (/^#?\d{1,3}$/.test(part) && shirtNumber === undefined) shirtNumber = Number(part.replace("#", ""));
      else rest.push(part);
    }
    line = rest.join(" ");

    if (shirtNumber === undefined) {
      const leading = /^#?(\d{1,3})[\s.)\-:]+(.+)$/.exec(line);
      const trailing = /^(.+?)[\s]+#?(\d{1,3})$/.exec(line);
      if (leading) {
        shirtNumber = Number(leading[1]);
        line = leading[2];
      } else if (trailing) {
        shirtNumber = Number(trailing[2]);
        line = trailing[1];
      }
    }

    const fullName = line.replace(/\s+/g, " ").trim();
    if (fullName) lines.push({ fullName, ...(shirtNumber !== undefined ? { shirtNumber } : {}), ...(position ? { position } : {}) });
  }
  return lines;
}

/** The lines of a pasted list or imported file: quotes from CSV exports are dropped and so is a header row ("Nombre, Número…"). */
function withoutHeader(text: string): string[] {
  const all = text.replace(/"/g, "").split(/\r?\n/);
  const first = all.findIndex((line) => line.trim() !== "");
  if (first >= 0 && /^(nombres?|jugadores?|equipos?|name|player|team)\b/i.test(all[first].trim()) && !/\d/.test(all[first])) all.splice(first, 1);
  return all;
}

/** One team name per line; bullets and numbering are ignored and repeated names are dropped. */
export function parseNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of withoutHeader(text)) {
    const name = raw.replace(/^[\s•\-*·]+/, "").replace(/^\d{1,3}[.)]\s+/, "").replace(/\s+/g, " ").trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      names.push(name);
    }
  }
  return names;
}
