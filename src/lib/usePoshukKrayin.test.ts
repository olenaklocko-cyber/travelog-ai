import { describe, expect, it } from "vitest";
import {
  novaPodorozhZKrayiny,
  poshukUKatalogu,
  yZnaydenoVMisty,
  zbagatytyZnaydenu,
  zbuduvatyKatalog,
} from "./usePoshukKrayin";
import type { Podorozh } from "../types";

const katalog = zbuduvatyKatalog(
  {
    JP: { name: "Japan", capital: "Tokyo", currency: ["JPY"] },
    TR: { name: "Turkey", capital: "Ankara", currency: ["TRY"] },
    FR: { name: "France", capital: "Paris", currency: ["EUR"] },
  },
  { JPY: { name: "Japanese yen" }, TRY: { name: "Turkish lira" } },
  { JP: "Японія", TR: "Туреччина", FR: "Франція" }
);

const podorozh: Podorozh = {
  id: "mock-1",
  title: "Японія восени",
  country_code: "JP",
  budget: 12000,
  status: "Плануються",
  zibrano: 0,
  vytrachenoSuma: 0,
};

describe("usePoshukKrayin: чиста логіка", () => {
  it("не йде в API, якщо є схожа подорож", () => {
    expect(yZnaydenoVMisty([podorozh], "Японі")).toBe(true);
    expect(yZnaydenoVMisty([podorozh], "jp")).toBe(true);
    expect(yZnaydenoVMisty([podorozh], "Туреччина")).toBe(false);
    expect(yZnaydenoVMisty([], "Японі")).toBe(false);
  });

  it("збирає каталог з нормалізованою українською назвою", () => {
    expect(katalog.spysok).toHaveLength(3);
    expect(katalog.spysok[0]).toMatchObject({
      code: "JP",
      name: "Japan",
      nameUa: "Японія",
      capital: "Tokyo",
      kodyValut: ["JPY"],
    });
    expect(katalog.spysok[0].nameUaNorm).toBe("японія");
    expect(katalog.valuty.JPY.name).toBe("Japanese yen");
  });

  it("знаходить країну за столицею, кодом і українською назвою", () => {
    expect(poshukUKatalogu(katalog, "tokyo").znaydena?.code).toBe("JP");
    expect(poshukUKatalogu(katalog, "fr").znaydena?.code).toBe("FR");
    expect(poshukUKatalogu(katalog, "туречч").znaydena?.code).toBe("TR");
  });

  it("спочатку дивиться словник популярних напрямків", () => {
    const { kodZSlovnyka, znaydena } = poshukUKatalogu(katalog, "стамбул");
    expect(kodZSlovnyka).toBe("TR");
    expect(znaydena?.code).toBe("TR");
  });

  it("повертає порожнє, коли нічого немає", () => {
    const { kodZSlovnyka, znaydena } = poshukUKatalogu(
      katalog,
      "абракадабра"
    );
    expect(znaydena).toBeUndefined();
    expect(kodZSlovnyka).toBeUndefined();
  });

  it("дозбагачує країну прапором і валютою текстом", () => {
    const japan = poshukUKatalogu(katalog, "tokyo").znaydena!;
    const z = zbagatytyZnaydenu(japan, "Токіо", undefined, katalog.valuty);
    expect(z.prapor).toBe("https://flagcdn.com/w320/jp.png");
    expect(z.valutaText).toBe("Japanese yen (JPY)");
    expect(z.cherezSlovnyk).toBe(false);

    const bezValyuty = zbagatytyZnaydenu(
      { ...japan, kodyValut: [] },
      "Токіо",
      undefined,
      katalog.valuty
    );
    expect(bezValyuty.valutaText).toBe("—");
  });

  it("готує подорож із статусом «Плануються» та бюджетом 50 000", () => {
    const japan = poshukUKatalogu(katalog, "tokyo").znaydena!;
    const krayna = zbagatytyZnaydenu(japan, "Японія", undefined, katalog.valuty);
    const { nova, nazvaKrayiny, mapa } = novaPodorozhZKrayiny(krayna);
    expect(nova).toMatchObject({
      title: "Японія",
      country_code: "JP",
      budget: 50000,
      status: "Плануються",
    });
    expect(nazvaKrayiny).toBe("Японія");
    expect(mapa).toEqual({ prapor: "🇯🇵", nazva: "Японія", valiuta: "JPY" });

    const populyarna = zbagatytyZnaydenu(
      japan,
      "стамбул",
      "TR",
      katalog.valuty
    );
    expect(novaPodorozhZKrayiny(populyarna).nova.title).toBe("Стамбул");
  });
});
