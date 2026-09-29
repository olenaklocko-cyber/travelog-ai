import { describe, it, expect } from "vitest";
import {
  formatHryven,
  procentZibrano,
  zalyshZibrano,
  procentCheklista,
  praporZCode,
  normZapyt,
  statusDozvolenyy,
} from "./rakhunky";

describe("formatHryven — форматування грошей", () => {
  it("додає розділювач тисяч", () => {
    expect(formatHryven(40000).replace(/\D/g, "")).toBe("40000");
  });

  it("порожнє значення → 0", () => {
    expect(formatHryven(undefined)).toBe("0");
  });

  it("текст замість числа → 0 (не «NaN»)", () => {
    expect(formatHryven("абракадабра")).toBe("0");
  });
});

describe("procentZibrano — відсоток зібраного", () => {
  it("звичайний випадок: 35000 з 70000 = 50%", () => {
    expect(procentZibrano(35000, 70000)).toBe(50);
  });

  it("більше 100% не буває (стискаємо до 100)", () => {
    expect(procentZibrano(100000, 70000)).toBe(100);
  });

  it("бюджет 0 → 0% (не ділимо на нуль!)", () => {
    expect(procentZibrano(100, 0)).toBe(0);
  });

  it("зібрано не вказано → 0%", () => {
    expect(procentZibrano(undefined, 70000)).toBe(0);
  });
});

describe("zalyshZibrano — скільки лишилося зібрати", () => {
  it("70000 - 35000 = 35000", () => {
    expect(zalyshZibrano(70000, 35000)).toBe(35000);
  });

  it("зібрано більше за бюджет → 0 (не від'ємне)", () => {
    expect(zalyshZibrano(70000, 90000)).toBe(0);
  });

  it("зібрано рівно стільки → 0", () => {
    expect(zalyshZibrano(70000, 70000)).toBe(0);
  });
});

describe("procentCheklista — виконання чек-лісту", () => {
  it("3 з 6 = 50%", () => {
    expect(procentCheklista(3, 6)).toBe(50);
  });

  it("порожній список → 0% (не ділимо на нуль!)", () => {
    expect(procentCheklista(0, 0)).toBe(0);
  });

  it("усе виконано → 100%", () => {
    expect(procentCheklista(6, 6)).toBe(100);
  });

  it("округлюємо до цілого: 2 з 3 = 67%", () => {
    expect(procentCheklista(2, 3)).toBe(67);
  });
});

describe("praporZCode — прапорець-емодзі з коду країни", () => {
  it("IT → 🇮🇹", () => {
    expect(praporZCode("IT")).toBe("🇮🇹");
  });

  it("маленькі літери теж працюють: fr → 🇫🇷", () => {
    expect(praporZCode("fr")).toBe("🇫🇷");
  });

  it("порожній код → фолбек XX", () => {
    expect(praporZCode("")).toBe(praporZCode("XX"));
  });
});

describe("normZapyt — нормалізація пошукового запиту", () => {
  it("прибирає пробіли, зводить до маленьких", () => {
    expect(normZapyt("  ПАРИЖ  ")).toBe("париж");
  });

  it("замінює різні апострофи на звичайний '", () => {
    expect(normZapyt("Париж’")).toBe("париж'");
  });
});

describe("statusDozvolenyy — чи статус із дозволених трьох", () => {
  it("три правильні статуси проходять", () => {
    expect(statusDozvolenyy("Активні збори")).toBe(true);
    expect(statusDozvolenyy("Плануються")).toBe(true);
    expect(statusDozvolenyy("Вже відвідані")).toBe(true);
  });

  it("вигаданий статус відкидається (як наша помилка з тижня 1)", () => {
    expect(statusDozvolenyy("Збираєм гроші")).toBe(false);
  });
});
