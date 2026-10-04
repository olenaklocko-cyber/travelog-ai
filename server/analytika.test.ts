import { describe, it, expect } from "vitest";
import {
  agreguvatyZaDnyamy,
  chystyyVidhuk,
  pidsumky,
  validuvatyShlyah,
  validuvatySesiya,
} from "./analytika";

describe("validuvatySesiya — анонімна сесія браузера", () => {
  it("приймає crypto.randomUUID", () => {
    expect(validuvatySesiya(crypto.randomUUID())).toBe(true);
  });

  it("відкидає короткі, довгі та зі сміттям", () => {
    expect(validuvatySesiya("abc")).toBe(false); // замало
    expect(validuvatySesiya("a".repeat(65))).toBe(false); // забагато
    expect(validuvatySesiya("локація 123")).toBe(false); // пробіл і кирилиця
    expect(validuvatySesiya("id; DROP TABLE vizyty")).toBe(false);
    expect(validuvatySesiya(null)).toBe(false);
    expect(validuvatySesiya(12345678)).toBe(false);
  });
});

describe("validuvatyShlyah — звідки прийшов відвідувач", () => {
  it("приймає локальні шляхи", () => {
    expect(validuvatyShlyah("/")).toBe(true);
    expect(validuvatyShlyah("/trip/12")).toBe(true);
  });

  it("відкидає сторонні адреси та параметри", () => {
    expect(validuvatyShlyah("https://evil.example")).toBe(false);
    expect(validuvatyShlyah("//evil.example")).toBe(false); // протокол-відносний
    expect(validuvatyShlyah("/x?utm=1")).toBe(false);
    expect(validuvatyShlyah("/x#y")).toBe(false);
    expect(validuvatyShlyah("")).toBe(false);
    expect(validuvatyShlyah(42)).toBe(false);
  });
});

describe("chystyyVidhuk — анонімний відгук", () => {
  it("обрізає пробіли по краях", () => {
    expect(chystyyVidhuk("  дуже гарний застосунок  ")).toBe(
      "дуже гарний застосунок"
    );
  });

  it("відкидає порожнє, закоротке і задовге", () => {
    expect(chystyyVidhuk("  ")).toBeNull();
    expect(chystyyVidhuk("аб")).toBeNull(); // 2 символи
    expect(chystyyVidhuk("а".repeat(1001))).toBeNull();
    expect(chystyyVidhuk(null)).toBeNull();
    expect(chystyyVidhuk(7)).toBeNull();
  });

  it("відкидає керівні символи (бекофіс, перенос рядка)", () => {
    const bekofis = "привіт" + String.fromCharCode(7) + "світе";
    expect(chystyyVidhuk(bekofis)).toBeNull();
    expect(chystyyVidhuk("рядок" + String.fromCharCode(10) + "новий")).toBeNull();
  });

  it("звичайні символи, емодзі — проходять", () => {
    expect(chystyyVidhuk("Клас! Дякую :)")).toBe("Клас! Дякую :)");
    expect(chystyyVidhuk("Добре світло")).toBe("Добре світло");
  });
});

describe("agreguvatyZaDnyamy — добові стовпчики для графіка", () => {
  it("групує за днями, рахує унікальні сесії окремо від заходів", () => {
    const dni = agreguvatyZaDnyamy([
      { den: "2026-10-04", sesiya: "ses-aaaa-1", shlyah: "/" },
      { den: "2026-10-04", sesiya: "ses-bbbb-2", shlyah: "/trip/1" },
      { den: "2026-10-04", sesiya: "ses-aaaa-1", shlyah: "/" }, // той самий
      { den: "2026-10-05", sesiya: "ses-cccc-3", shlyah: "/" },
    ]);

    expect(dni).toEqual([
      { den: "2026-10-04", unikalni: 2, zapysiv: 3 },
      { den: "2026-10-05", unikalni: 1, zapysiv: 1 },
    ]);
  });

  it("дні йдуть від старих до нових навіть якщо порядок збитий", () => {
    const dni = agreguvatyZaDnyamy([
      { den: "2026-10-07", sesiya: "ses-aaaa-1", shlyah: "/" },
      { den: "2026-10-01", sesiya: "ses-bbbb-2", shlyah: "/" },
      { den: "2026-10-04", sesiya: "ses-cccc-3", shlyah: "/" },
    ]);

    expect(dni.map((d) => d.den)).toEqual([
      "2026-10-01",
      "2026-10-04",
      "2026-10-07",
    ]);
  });

  it("одна сесія в різні дні рахується в кожному дні", () => {
    const dni = agreguvatyZaDnyamy([
      { den: "2026-10-04", sesiya: "ses-aaaa-1", shlyah: "/" },
      { den: "2026-10-05", sesiya: "ses-aaaa-1", shlyah: "/" },
    ]);

    expect(dni.map((d) => d.unikalni)).toEqual([1, 1]);
  });

  it("порожній список → порожній графік", () => {
    expect(agreguvatyZaDnyamy([])).toEqual([]);
  });
});

describe("pidsumky — цифри для шапки статистики", () => {
  it("підраховує всіх людей і всі заходи", () => {
    const p = pidsumky([
      { den: "2026-10-04", sesiya: "ses-aaaa-1", shlyah: "/" },
      { den: "2026-10-04", sesiya: "ses-bbbb-2", shlyah: "/" },
      { den: "2026-10-05", sesiya: "ses-aaaa-1", shlyah: "/" },
    ]);

    expect(p.vsogoUnikalnyh).toBe(2); // дві різні сесії загалом
    expect(p.vsogoZapysiv).toBe(3);
    expect(p.denOstanniy).toBe("2026-10-05");
  });

  it("без даних — останнього дня нема", () => {
    expect(pidsumky([]).denOstanniy).toBeNull();
  });
});
