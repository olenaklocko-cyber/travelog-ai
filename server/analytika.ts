import type { DenStat, ZapysVizytu } from "../src/types.ts";

/**
 * 📊 Аналітика відвідувань і зворотний зв'язок — ЧИСТА логіка без мережі.
 * Тут усе, що можна перевірити звичайними тестами:
 *  - валідація даних, які приходять від сторонніх людей (анонімних);
 *  - агрегація «сирих» записів у добові підсумки для графіка.
 * Запити до Supabase — у server/server.ts, сюди вони не потрапляють.
 */

// ————— Валідація: приймаємо дані лише від «чистих» —————

export const SESIYA_MINTZ = 8;
export const SESIYA_MAX = 64;
export const VIDHUK_MINTZ = 3;
export const VIDHUK_MAX = 1000;

/**
 * Анонімна сесія браузера: вигаданий нами id (crypto.randomUUID),
 * а не щось від користувача. Валідуємо, щоб у таблицю не потрапив сміттєвий рядок.
 */
export const validuvatySesiya = (sesiya: unknown): sesiya is string =>
  typeof sesiya === "string" &&
  sesiya.length >= SESIYA_MINTZ &&
  sesiya.length <= SESIYA_MAX &&
  /^[A-Za-z0-9-]+$/.test(sesiya);

/**
 * Шлях сторінки (`/`, `/trip/3` ...). Ми не приймаємо протоколи і домени —
 * лише локальний шлях, щоб у таблицю не всунули стороннє посилання.
 */
export const validuvatyShlyah = (shlyah: unknown): shlyah is string => {
  if (typeof shlyah !== "string") return false;
  if (shlyah.length === 0 || shlyah.length > 200) return false;
  // `//host` — протокол-відносне посилання, браузер піде на ЗОВНІШНІЙ сайт
  if (!shlyah.startsWith("/") || shlyah.startsWith("//")) return false;
  return !/[?#]/.test(shlyah);
};

/**
 * Текст відгуку: trim, довжина, без керівних символів (бекофіси/таби/переноси).
 * Повертає очищений текст або `null`, якщо відгук не годиться.
 */
export const chystyyVidhuk = (teks: unknown): string | null => {
  if (typeof teks !== "string") return null;
  const chysto = teks.trim();
  if (chysto.length < VIDHUK_MINTZ || chysto.length > VIDHUK_MAX) return null;
  for (const symvol of chysto) {
    const kod = symvol.codePointAt(0) ?? 0;
    if (kod < 0x20 || kod === 0x7f) return null;
  }
  return chysto;
};

// ————— Агрегація: сирі рядки → добові стовпчики графіка —————

/**
 * Збирає добові підсумки відвідувань.
 *
 * `unikalni` — скільки РІЗНИХ сесіь того дня (людей),
 * `zapysiv`  — скільки разів усього відкрили застосунок.
 *
 * Дні йдуть від старих до нових — так зручно малювати стовпчики
 * зліва направо без додаткового сортування на клієнті.
 */
export const agreguvatyZaDnyamy = (
  zapysy: readonly ZapysVizytu[]
): DenStat[] => {
  const dni = new Map<string, { sesiyi: Set<string>; zapysiv: number }>();

  for (const z of zapysy) {
    const stan = dni.get(z.den) ?? { sesiyi: new Set<string>(), zapysiv: 0 };
    stan.sesiyi.add(z.sesiya);
    stan.zapysiv += 1;
    dni.set(z.den, stan);
  }

  return [...dni.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([den, stan]) => ({
      den,
      unikalni: stan.sesiyi.size,
      zapysiv: stan.zapysiv,
    }));
};

/** Підсумок для шапки сторінки статистики. */
export const pidsumky = (zapysy: readonly ZapysVizytu[]) => {
  const dni = agreguvatyZaDnyamy(zapysy);
  return {
    dni,
    vsogoUnikalnyh: new Set(zapysy.map((z) => z.sesiya)).size,
    vsogoZapysiv: zapysy.length,
    denOstanniy: dni.length > 0 ? dni[dni.length - 1].den : null,
  };
};
