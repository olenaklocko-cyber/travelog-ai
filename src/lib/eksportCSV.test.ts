import { describe, expect, it } from "vitest";
import { ZAGOLOVKY, nazvaCSV, podorozhiDoCSV } from "./eksportCSV";
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
    const csv = podorozhiDoCSV([podorozhi[1], { ...podorozhi[1], country_code: "XX" }], krajiny);
    expect(csv).toContain('"Карпати";"Україна"');
    expect(csv).toContain('"Карпати";"XX"');
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

  it("формує назву файлу з дати", () => {
    expect(nazvaCSV(new Date("2026-10-02T10:00:00Z"))).toBe(
      "podorozhi-2026-10-02.csv"
    );
  });
});
