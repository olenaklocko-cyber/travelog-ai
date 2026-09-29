import type { StatusPodorozhi } from "../types";

/**
 * 🧮 Чисті розрахунки тревелогу.
 * Тут НЕМАЄ ні React, ні сховища, ні мережі — лише математика,
 * тому їх легко перевіряти тестами (і це безпечно).
 */

/** Форматує число як гривні: 40000 → «40 000» (текстом, не «NaN») */
export const formatHryven = (chyslo: number | string | undefined): string =>
  new Intl.NumberFormat("uk-UA").format(Math.round(Number(chyslo) || 0));

/** Відсоток зібраного: завжди 0–100, без ділення на нуль */
export const procentZibrano = (
  zibrano: number | undefined,
  budzet: number
): number => {
  if (budzet <= 0) return 0;
  return Math.min(100, Math.round(((zibrano ?? 0) / budzet) * 100));
};

/** Скільки лишилося зібрати: ніколи не від'ємне число */
export const zalyshZibrano = (budzet: number, zibrano: number): number =>
  Math.max(0, budzet - zibrano);

/** Відсоток виконаних пунктів чек-лісту: 0%, якщо список порожній */
export const procentCheklista = (zrobleno: number, vsiogo: number): number =>
  vsiogo > 0 ? Math.round((zrobleno / vsiogo) * 100) : 0;

/** Прапорець-емодзі з коду країни: «IT» → 🇮🇹 (порожній код → 🇽🇽) */
export const praporZCode = (code: string): string =>
  String.fromCodePoint(
    ...(code || "XX")
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );

/** Нормалізація пошукового запиту: прибрати пробіли, до маленьких, апострофи → ' */
export const normZapyt = (s: string): string =>
  s.toLowerCase().replace(/[’ʼ`´′]/g, "'").trim();

/** Перевірка статусу «на бігу»: дані з бази/сховища можуть бути будь-якими */
export const statusDozvolenyy = (s: string): s is StatusPodorozhi =>
  s === "Активні збори" || s === "Плануються" || s === "Вже відвідані";
