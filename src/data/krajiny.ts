import type { Krayina, StatusPodorozhi } from "../types";
import supabase from "../supabase";
import { keshKrayin } from "../lib/kesh";

/** Локальний словник — резерв, якщо база недоступна */
export const krajiny: Record<string, Krayina> = {
  IT: { prapor: "🇮🇹", nazva: "Італія", valiuta: "EUR" },
  FR: { prapor: "🇫🇷", nazva: "Франція", valiuta: "EUR" },
  UA: { prapor: "🇺🇦", nazva: "Україна", valiuta: "UAH" },
  JP: { prapor: "🇯🇵", nazva: "Японія", valiuta: "JPY" },
  EG: { prapor: "🇪🇬", nazva: "Єгипет", valiuta: "EGP" },
  LT: { prapor: "🇱🇹", nazva: "Литва", valiuta: "EUR" },
  IL: { prapor: "🇮🇱", nazva: "Ізраїль", valiuta: "ILS" },
  BG: { prapor: "🇧🇬", nazva: "Болгарія", valiuta: "EUR" },
  MD: { prapor: "🇲🇩", nazva: "Молдова", valiuta: "MDL" },
  DO: { prapor: "🇩🇴", nazva: "Домінікана", valiuta: "DOP" },
  ID: { prapor: "🇮🇩", nazva: "Індонезія", valiuta: "IDR" },
  HR: { prapor: "🇭🇷", nazva: "Хорватія", valiuta: "EUR" },
  AE: { prapor: "🇦🇪", nazva: "ОАЕ", valiuta: "AED" },
  TZ: { prapor: "🇹🇿", nazva: "Танзанія", valiuta: "TZS" },
  TH: { prapor: "🇹🇭", nazva: "Таїланд", valiuta: "THB" },
};

/**
 * Завантажує країни з таблиці krajiny (з кешем 24 год).
 * Якщо база недоступна — працюємо з локальним словником.
 */
export const zavantazhytyKrajinyZBazy = async (): Promise<void> => {
  try {
    const data = await keshKrayin.aboObchyslyty("krajiny", async () => {
      const { data: rows } = await supabase
        .from("krajiny")
        .select("code, nazva, emoji");
      return rows ?? [];
    });
    for (const k of data) {
      if (!krajiny[k.code]) {
        krajiny[k.code] = {
          prapor: k.emoji,
          nazva: k.nazva,
          valiuta: "",
        };
      }
    }
  } catch {
    // база недоступна — лишаємо локальний словник
  }
};

export const krajinyVyboru: string[] = ["IT", "FR"];

export const dodatyKrayinuMapy = (code: string, info: Krayina): void => {
  if (code && !krajiny[code]) {
    krajiny[code] = info;
  }
};

export const statusy: StatusPodorozhi[] = [
  "Активні збори",
  "Плануються",
  "Вже відвідані",
];
