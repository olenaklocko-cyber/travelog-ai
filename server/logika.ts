import { createHash } from "node:crypto";
import type { PoradaServera } from "../src/types.ts";

interface PravylaKrayiny {
  sezon: string;
  porada: string;
  pakuvannya: string[];
}

/**
 * 🖥 Правила НАШОГО сервера.
 * Сервер знає лише ці країни — і відмовляє всім іншим (правила живуть тут,
 * у браузер їх не відправляємо).
 */
const pravyla: Record<string, PravylaKrayiny> = {
  IT: {
    sezon: "квітень–червень, вересень–жовтень",
    porada: "Бронюйте Ватикан заздалегідь: у понеділок музеї зачинені.",
    pakuvannya: [
      "Зручне взуття для бруківки",
      "Легкий одяг (у храмах — закриті плечі та коліна)",
    ],
  },
  FR: {
    sezon: "травень–червень, вересень",
    porada: "Лувр зачинений по вівторках. Квитки онлайн — черга в рази коротша.",
    pakuvannya: ["Легка куртка на вечір", "Зручне взуття для прогулянок"],
  },
  UA: {
    sezon: "грудень–лютий (лижі), липень–серпень (гори)",
    porada: "У Карпатах вихідні — найдорожчі: плануйте будні.",
    pakuvannya: ["Тепла куртка", "Термобілизна", "Шапка і рукавиці"],
  },
  JP: {
    sezon: "березень (сакура), листопад (джутсу)",
    porada: "JR Pass вигідний лише якщо їздите між містами ≥2 разів.",
    pakuvannya: ["Павербанк", "Маска для обличчя", "Зручне взуття"],
  },
  EG: {
    sezon: "жовтень–квітень",
    porada: "Піраміди відкриті до 17:00 — приходьте після обіду, менше людей.",
    pakuvannya: ["Сонцезахисний крем", "Окуляри від сонця", "Легкий одяг"],
  },
  AE: {
    sezon: "листопад–березень",
    porada: "У Дубаї п'ятниця — вихідний: більшість музеїв працює 6 днів.",
    pakuvannya: [
      "Сонцезахисний крем",
      "Легкий одяг, що закриває плечі",
      "Зволожувальний крем",
    ],
  },
  TH: {
    sezon: "листопад–лютий (сухий сезон)",
    porada: "Мусони липень–жовтень: плануйте північ країни замість пляжів.",
    pakuvannya: ["Репелент від комах", "Легка куртка від дощу", "Купальник"],
  },
  HR: {
    sezon: "травень–червень, вересень",
    porada: "Плітвіцькі озера закриті після 16:00 у низький сезон — приходьте зранку.",
    pakuvannya: ["Зручне взуття для стежок", "Дощовик"],
  },
};

/**
 * Промокод обчислюється з СЕКРЕТНОГО ключа (HMAC-подібно на sha256).
 * Браузер отримує лише готовий промокод — сам ключ він ніколи не бачить.
 */
export const zrobPromo = (sekretnyyKlyuch: string, krajyna: string): string =>
  `TUR-${createHash("sha256")
    .update(`${sekretnyyKlyuch}:${krajyna.toUpperCase()}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase()}`;

/** Серверна функція: приймає запит (код країни), повертає дані або відмову */
export const poradaDlya = (
  krajyna: string,
  sekretnyyKlyuch: string
): PoradaServera | null => {
  const kod = krajyna.trim().toUpperCase();
  const pravylaKrayiny = pravyla[kod];
  if (!pravylaKrayiny) return null;
  return {
    krajyna: kod,
    ...pravylaKrayiny,
    promo: zrobPromo(sekretnyyKlyuch, kod),
  };
};
