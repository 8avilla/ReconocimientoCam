import { describe, expect, it } from "vitest";
import { csvFileName, toCsv } from "./exportCsv";

describe("toCsv", () => {
  it("joins with ; and CRLF", () => {
    expect(toCsv(["A", "B"], [["x", 1], ["y", 2]])).toBe("A;B\r\nx;1\r\ny;2");
  });

  it("quotes cells with separators, quotes and line breaks", () => {
    expect(toCsv(["n"], [["a;b"], ['di "hola"'], ["l1\nl2"]])).toBe('n\r\n"a;b"\r\n"di ""hola"""\r\n"l1\nl2"');
  });

  it("neutralises formulas typed into a name (CSV injection)", () => {
    expect(toCsv(["n"], [["=HYPERLINK(\"http://x\")"], ["+1"], ["-2"], ["@SUM(A1)"]]).split("\r\n").slice(1)).toEqual([
      '"\'=HYPERLINK(""http://x"")"',
      "'+1",
      "'-2",
      "'@SUM(A1)",
    ]);
  });

  it("keeps real negative numbers and empty cells", () => {
    expect(toCsv(["dg", "x", "y"], [[-3, null, undefined]])).toBe("dg;x;y\r\n-3;;");
  });

  it("keeps accents untouched", () => {
    expect(toCsv(["Jugador"], [["Óscar Cifuentes"]])).toContain("Óscar Cifuentes");
  });
});

describe("csvFileName", () => {
  it("makes a safe file name", () => {
    expect(csvFileName("Liga de las Estrella", "Posiciones")).toBe("liga-de-las-estrella-posiciones.csv");
    expect(csvFileName("¡¿?!")).toBe("reporte.csv");
  });
});
