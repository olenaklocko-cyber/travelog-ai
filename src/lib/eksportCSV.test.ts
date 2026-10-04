import { describe, expect, it } from "vitest";
import { ZAGOLOVKY, nazvaCSV, podorozhiDoCSV, vmistCSV } from "./eksportCSV";
import type { Krayina, Podorozh } from "../types";

const krajiny: Record<string, Krayina> = {
  JP: { prapor: "🇯🇵", nazva: "Японія", valiuta: "JPY" },
  UA: { prapor: "🇺🇦", nazva: "Україна", valiuta: "UAH" },
};

const podorozhi: Podorozh[] = [
  {
    id: 1,
    title: "Японія восени",
    country_code: "JP",
    budget: 120000,
    status: "Активні збори",
    zibrano: 45000,
    vytrachenoSuma: 3000,
  },
  {
    id: 2,
    title: "Карпати",
    country_code: "UA",
    budget: 12000,
    status: "Плануються",
  },
];

describe("eksportCSV", () => {
  it("починається із заголовків і розділяє поля крапкою з комою", () => {
    const csv = podorozhiDoCSV([podorozhi[0]], krajiny);
    const ryadky = csv.trimEnd().split("\r\n");
    expect(ryadky).toHaveLength(2);
    expect(ryadky[0]).toBe(ZAGOLOVKY.map((z) => `"${z}"`).join(";"));
    expect(ryadky[1]).toBe(
      '"Японія восени";"Японія";"Активні збори";"120000";"45000";"3000"'
    );
  });

  it("бере назву країни з довідника, а невідомий код лишає кодом", () => {
    const ryadky = podorozhiDoCSV(
      [podorozhi[1], { ...podorozhi[1], country_code: "XX" }],
      krajiny
    )
      .trimEnd()
      .split("\r\n");
    expect(ryadky[1]).toBe('"Карпати";"Україна";"Плануються";"12000";"0";"0"');
    expect(ryadky[2]).toBe('"Карпати";"XX";"Плануються";"12000";"0";"0"');
  });

  it("екранує подвійні лапки", () => {
    const csv = podorozhiDoCSV(
      [{ ...podorozhi[0], title: 'Сейшели "V"' }],
      krajiny
    );
    expect(csv).toContain('"Сейшели ""V"""');
  });

  it("тримає перенос рядка всередині лапок", () => {
    const csv = podorozhiDoCSV(
      [{ ...podorozhi[0], title: "Ліс\nГори" }],
      krajiny
    );
    expect(csv).toContain('"Ліс\nГори"');
  });

  it("відсутні суми пише нулями", () => {
    const csv = podorozhiDoCSV([podorozhi[1]], krajiny);
    expect(csv).toContain('"12000";"0";"0"');
  });

  it("порожній список → тільки заголовок", () => {
    expect(podorozhiDoCSV([], krajiny).trimEnd()).toBe(
      ZAGOLOVKY.map((z) => `"${z}"`).join(";")
    );
  });

  it("не змінює вхідний список", () => {
    const kopiyka = JSON.parse(JSON.stringify(podorozhi));
    podorozhiDoCSV(podorozhi, krajiny);
    expect(podorozhi).toEqual(kopiyka);
  });

  it("формує назву файлу з локальної дати, а не з UTC", () => {
    // 2 жовтня 2026, 00:30 за Києвом — у UTC це ще 1 жовтня
    const den = new Date(2026, 9, 2, 0, 30);
    expect(nazvaCSV(den)).toBe("podorozhi-2026-10-02.csv");
    expect(nazvaCSV(new Date("2026-10-02T10:00:00Z"))).toBe(
      "podorozhi-2026-10-02.csv"
    );
  });

  it("безпечний від формул: «=1+1» не виконається в Excel", () => {
    const csv = podorozhiDoCSV(
      [{ ...podorozhi[0], title: "=1+1" }, { ...podorozhi[0], title: "@SUM(A1)" }],
      krajiny
    );
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"\'@SUM(A1)"');
  });

  it("число з пробілом не стає нулем", () => {
    const csv = podorozhiDoCSV(
      [{ ...podorozhi[0], budget: "120 000" as unknown as number, zibrano: "45\u00a0000" as unknown as number }],
      krajiny
    );
    expect(csv).toContain(';"120000";"45000";');
  });

  it("вміст файлу починається з UTF-8 BOM", () => {
    expect(vmistCSV([], krajiny).startsWith("\uFEFF")).toBe(true);
    expect(vmistCSV([], krajiny).endsWith(ZAGOLOVKY.join("").slice(0, 1))).toBe(
      false
    );
  });
});
