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
  LT: {
    sezon: "травень–вересень",
    porada: "Стара Вільнюс — пішки за день; Куршська коса — автобусом з Вільнюса.",
    pakuvannya: ["Зручне взуття для прогулянок", "Дощовик"],
  },
  IL: {
    sezon: "жовтень–квітень (влітку — спека)",
    porada: "У п'ятницю ввечері магазини зачиняються на Шабат — закупіться заздалегідь.",
    pakuvannya: [
      "Легкий одяг і головний убір",
      "Купальник (Мертве море)",
      "Сонцезахисний крем",
    ],
  },
  BG: {
    sezon: "червень–вересень (гори — липень–серпень)",
    porada: "Рильський монастир ідеально поєднується з днем у горах — маршрут один.",
    pakuvannya: ["Купальник", "Зручне взуття для стежок", "Легка куртка"],
  },
  MD: {
    sezon: "травень–вересень",
    porada: "Дегустація у криївках Крикова — бронюйте заздалегідь, екскурсії по 2 год.",
    pakuvannya: ["Легка куртка на вечір", "Зручне взуття"],
  },
  DO: {
    sezon: "грудень–квітень (сезон ураганів — червень–листопад)",
    porada: "Острів Саона з Пунта-Кани — найкраща одноденна поїздка, мілка вода.",
    pakuvannya: [
      "Сонцезахисний крем",
      "Купальник / плавки",
      "Панамка та окуляри",
    ],
  },
  ID: {
    sezon: "квітень–жовтень (сухий сезон)",
    porada: "До храмів на Балі — обов'язкова саронг; скутер орендуйте з правами.",
    pakuvannya: [
      "Саронг для храмів",
      "Репелент від комах",
      "Сонцезахисний крем",
    ],
  },
  TZ: {
    sezon: "червень–жовтень, грудень–лютий",
    porada: "Занзібар: Стоун-Таун + екскурсія спеціями; на сафарі — бронюйте 2 дні.",
    pakuvannya: [
      "Репелент від комах",
      "Купальник / плавки",
      "Легкий одяг",
      "Сонцезахисний крем",
    ],
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

/**
 * 🤖 Промпт для ШІ: сервер ДОДАЄ до запиту свій контекст (правила країни),
 * яких у браузера немає. Браузер надсилає лише текст запиту.
 */
export const pobuduvatyPrompt = (
  krajynaKod: string,
  zapyt: string
): string => {
  const kod = krajynaKod.trim().toUpperCase();
  const pravylaKrayiny = pravyla[kod];
  const kontekst = pravylaKrayiny
    ? `Країна: ${kod}. Наші правила сервера — найкращий сезон: ${pravylaKrayiny.sezon}; порада: ${pravylaKrayiny.porada}; радимо взяти: ${pravylaKrayiny.pakuvannya.join(", ")}.`
    : kod
      ? `Країна: ${kod}.`
      : "";
  return [
    "Ти — дружній помічник мандрівника у застосунку «Мій розумний тревелог».",
    "Відповідай українською, стисло (до 120 слів), практично, з емодзі, без зайвих заголовків.",
    kontekst,
    `Питання користувача: ${zapyt}`,
  ]
    .filter(Boolean)
    .join("\n");
};

/**
 * 🛡 Ліміт запитів: пропускаємо не більше `maks` за `viknoMs`.
 * Чиста функція (без стану) — тому її легко тестувати.
 */
export interface StanLimitu {
  dozvoleno: boolean;
  zalyshok: number; // скільки запитів ще можна
  chekatySec: number; // через скільки секунд знову можна
}

export const perevirkaLimitu = (
  istoriya: number[],
  teper: number,
  maks: number,
  viknoMs: number
): StanLimitu => {
  const sviji = istoriya.filter((t) => teper - t < viknoMs);
  if (sviji.length < maks) {
    return {
      dozvoleno: true,
      zalyshok: maks - sviji.length - 1,
      chekatySec: 0,
    };
  }
  const naystarishyy = Math.min(...sviji);
  return {
    dozvoleno: false,
    zalyshok: 0,
    chekatySec: Math.max(1, Math.ceil((naystarishyy + viknoMs - teper) / 1000)),
  };
};
