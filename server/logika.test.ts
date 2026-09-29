import { describe, it, expect } from "vitest";
import { perevirkaLimitu, pobuduvatyPrompt, poradaDlya, zrobPromo } from "./logika";
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

describe("perevirkaLimitu — ліміт запитів до ШІ (5 на хвилину)", () => {
  const MAKS = 5;
  const VIKNO = 60_000;

  it("перші 5 запитів — вільні", () => {
    const teper = 1_000_000;
    const istoriya = [teper - 1000, teper - 2000, teper - 3000, teper - 4000];
    const stan = perevirkaLimitu(istoriya, teper, MAKS, VIKNO);
    expect(stan.dozvoleno).toBe(true);
    expect(stan.zalyshok).toBe(0); // 4 вже використані, цей — 5-й
  });

  it("6-й запит за хвилину → відмова з часом очікування", () => {
    const teper = 1_000_000;
    const istoriya = [teper - 1000, teper - 2000, teper - 3000, teper - 4000, teper - 5000];
    const stan = perevirkaLimitu(istoriya, teper, MAKS, VIKNO);
    expect(stan.dozvoleno).toBe(false);
    expect(stan.chekatySec).toBeGreaterThan(0);
    expect(stan.chekatySec).toBeLessThanOrEqual(60);
  });

  it("старі запити (більше хвилини тому) не рахуються", () => {
    const teper = 1_000_000;
    const istoriya = [teper - 61_000, teper - 70_000, teper - 120_000];
    const stan = perevirkaLimitu(istoriya, teper, MAKS, VIKNO);
    expect(stan.dozvoleno).toBe(true);
    expect(stan.zalyshok).toBe(4);
  });

  it("порожня історія → вільно", () => {
    const stan = perevirkaLimitu([], 1_000_000, MAKS, VIKNO);
    expect(stan.dozvoleno).toBe(true);
    expect(stan.zalyshok).toBe(4);
  });
});

describe("pobuduvatyPrompt — промпт, який сервер збирає для моделі", () => {
  it("містить питання користувача", () => {
    expect(pobuduvatyPrompt("JP", "що взяти в листопаді?")).toContain(
      "що взяти в листопаді?"
    );
  });

  it("додає правила сервера для відомої країни (їх у браузера немає)", () => {
    const prompt = pobuduvatyPrompt("JP", "питання");
    expect(prompt).toContain("JP");
    expect(prompt).toContain("JR Pass"); // порада сервера з logika.ts
  });

  it("відповідає українською та обмежує довжину", () => {
    const prompt = pobuduvatyPrompt("FR", "питання");
    expect(prompt).toContain("українською");
    expect(prompt).toContain("120 слів");
  });

  it("невідома країна не ламає промпт", () => {
    const prompt = pobuduvatyPrompt("XX", "питання");
    expect(prompt).toContain("питання");
    expect(prompt).not.toContain("undefined");
  });

  it("порожній запит → теж валідний промпт (без помилок)", () => {
    const prompt = pobuduvatyPrompt("", " ");
    expect(prompt.length).toBeGreaterThan(0);
  });
});
