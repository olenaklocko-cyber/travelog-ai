import { describe, it, expect } from "vitest";
import { poradaDlya, zrobPromo } from "./logika";
import { krajiny } from "../src/data/krajiny";

describe("правила сервера = усі країни застосунку", () => {
  it("для КОЖНОЇ країни з тревелогу є порада на сервері", () => {
    for (const kod of Object.keys(krajiny)) {
      expect(
        poradaDlya(kod, "тест"),
        `немає поради для країни ${kod} — додай її в server/logika.ts`
      ).not.toBeNull();
    }
  });

  it("у застосунку рівно 15 країн", () => {
    expect(Object.keys(krajiny)).toHaveLength(15);
  });
});

describe("poradaDlya — серверна функція порад", () => {
  it("відома країна → повна порада з промокодом", () => {
    const porada = poradaDlya("IT", "секрет");
    expect(porada).not.toBeNull();
    expect(porada?.krajyna).toBe("IT");
    expect(porada?.sezon.length).toBeGreaterThan(0);
    expect(porada?.pakuvannya.length).toBeGreaterThan(0);
    expect(porada?.promo).toMatch(/^TUR-[0-9A-F]{8}$/);
  });

  it("маленькі літери та пробіли не заважають", () => {
    expect(poradaDlya("  fr ", "секрет")?.krajyna).toBe("FR");
  });

  it("невідома країна → сервер відмовляє (null), бо такі правила", () => {
    expect(poradaDlya("XX", "секрет")).toBeNull();
    expect(poradaDlya("", "секрет")).toBeNull();
  });
});

describe("zrobPromo — промокод із секретного ключа", () => {
  it("той самий секрет і країна → той самий код", () => {
    expect(zrobPromo("secret-1", "IT")).toBe(zrobPromo("secret-1", "IT"));
  });

  it("інший секрет → зовсім інший код", () => {
    expect(zrobPromo("secret-1", "IT")).not.toBe(zrobPromo("secret-2", "IT"));
  });

  it("різні країни → різні коди", () => {
    expect(zrobPromo("secret-1", "IT")).not.toBe(zrobPromo("secret-1", "FR"));
  });

  it("сам секрет ніколи не потрапляє у код", () => {
    expect(zrobPromo("мій-дуже-секретний-ключ", "IT")).not.toContain(
      "мій-дуже-секретний-ключ"
    );
  });
});
