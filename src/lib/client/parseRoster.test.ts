import { describe, expect, it } from "vitest";
import { parseNames, parseRoster } from "./parseRoster";

describe("parseRoster", () => {
  it("reads a shirt number at the start or the end of the line", () => {
    expect(parseRoster("10 Juan Pérez\nLuis Gómez 7")).toEqual([
      { fullName: "Juan Pérez", shirtNumber: 10 },
      { fullName: "Luis Gómez", shirtNumber: 7 },
    ]);
  });

  it("reads comma separated columns with number and position in any order", () => {
    expect(parseRoster("Juan Pérez, 10, Delantero\nPortero, Ana Ruiz, 1")).toEqual([
      { fullName: "Juan Pérez", shirtNumber: 10, position: "Delantero" },
      { fullName: "Ana Ruiz", shirtNumber: 1, position: "Portero" },
    ]);
  });

  it("ignores bullets, blank lines and extra spaces", () => {
    expect(parseRoster("- 1. Carlos   Díaz\n\n• Pedro Soto")).toEqual([{ fullName: "Carlos Díaz", shirtNumber: 1 }, { fullName: "Pedro Soto" }]);
  });

  it("skips a header row and the quotes of a CSV export", () => {
    expect(parseRoster('Nombre,Número,Posición\n"Juan Pérez",10,Delantero')).toEqual([{ fullName: "Juan Pérez", shirtNumber: 10, position: "Delantero" }]);
  });

  it("keeps names with digits that are not a shirt number", () => {
    expect(parseRoster("Juan 2do Pérez")).toEqual([{ fullName: "Juan 2do Pérez" }]);
  });
});

describe("parseNames", () => {
  it("drops numbering and repeated names", () => {
    expect(parseNames("1. Tigres\n- Leones\ntigres\n\nÁguilas  FC")).toEqual(["Tigres", "Leones", "Águilas FC"]);
  });
});
