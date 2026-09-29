/**
 * 📖 ГОЛОВНИЙ СЛОВНИК ТИПІВ
 * Тут описано, з чого складаються наші дані.
 * Якщо десь помилитися (напр., у бюджет передати текст) —
 * TypeScript одразу підкреслить червоним ще до запуску.
 */

/** Статуси подорожі — дозволено рівно ці три значення */
export type StatusPodorozhi =
  | "Активні збори"
  | "Плануються"
  | "Вже відвідані";

/** Тип фінансової операції: гроші або надходять, або витрачаються */
export type TypOperaciyi = "Дохід" | "Витрата";

/** Подорож — головна сутність застосунку */
export interface Podorozh {
  id: string | number;
  title: string;
  country_code: string;
  budget: number;
  status: StatusPodorozhi;
  /** Скільки вже зібрано (грн) */
  zibrano?: number;
  /** Скільки вже витрачено (грн) */
  vytrachenoSuma?: number;
  /** Чи зібрано введено вручну цим користувачем */
  zibranoSvoe?: boolean;
}

/** Витрата на сторінці подорожі */
export interface Vytrata {
  id: number;
  suma: number;
  kategoriya: string;
}

/** Пункт чек-лісту */
export interface TochkaChek {
  id: number;
  tekst: string;
  zrobleno: boolean;
}

/** Країна у каталозі */
export interface Krayina {
  prapor: string;
  nazva: string;
  valiuta: string;
}

/** Цікаві факти про країну */
export interface FaktKrayiny {
  mova: string;
  valiutaPovna: string;
  kurs: number;
  fakty: string[];
}

/** Користувач (з Supabase) — достатньо id та email */
export interface Korystuvach {
  id: string;
  email?: string;
}

/** Операція з бази даних (таблиця expenses) */
export interface Operaciya {
  trip_id: string | number;
  amount: number;
  type: TypOperaciyi;
}

/**
 * Відповідь НАШОГО сервера (GET /api/porada).
 * Контракт між застосунком (браузер) і сервером.
 */
export interface PoradaServera {
  krajyna: string;
  sezon: string;
  porada: string;
  pakuvannya: string[];
  /** Промокод, обчислений із СЕКРЕТНОГО ключа — сам ключ у відповідь не потрапляє */
  promo: string;
}
