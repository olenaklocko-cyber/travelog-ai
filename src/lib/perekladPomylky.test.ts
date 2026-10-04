import { describe, expect, it } from "vitest";
import { perekladPomylky } from "../lib/perekladPomylky";

/**
 * Користувач ніколи не має бачити англійської помилки від Supabase.
 * (Відгук: «спочатку не розумію куди нажати» — частина проблеми: мовою інтерфейсу.)
 */
describe("переклад помилок входу", () => {
  it("невірний пароль — українською", () => {
    expect(perekladPomylky("Invalid login credentials")).toBe(
      "Невірний email або пароль"
    );
  });

  it("порожня сесія — українською, не «Auth session or user missing»", () => {
    const текс = perekladPomylky("Auth session or user missing");
    expect(текс).not.toMatch(/[A-Za-z]{4,}/);
    expect(текс).toContain("Сесію не знайдено");
  });

  it("немає інтернету — українською", () => {
    expect(perekladPomylky("Failed to fetch")).toContain("інтернету");
  });

  it("невідома помилка не залишається голою англійською фразою без підказки", () => {
    // найчастіші випадки
    for (const m of [
      "Invalid login credentials",
      "Auth session or user missing",
      "Failed to fetch",
      "Signup requires a valid password",
      "Email not confirmed",
      "User already registered",
      "Password should be at least 6 characters",
      "Token has expired or is invalid",
    ]) {
      expect(perekladPomylky(m)).not.toBe(m);
    }
  });
});
