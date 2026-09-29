import type { Korystuvach } from "../types";

const idVlasnyka = (import.meta.env.VITE_VLASYNYK_ID || "").trim().toLowerCase();
const emailVlasnyka = (import.meta.env.VITE_VLASYNYK_EMAIL || "")
  .trim()
  .toLowerCase();

export const uidKorystuvacha = (
  korystuvach: Korystuvach | null | undefined
): string => String(korystuvach?.id || "anonim");

/**
 * Чи це власник застосунку (я)?
 * Порівнюємо id, якщо заданий VITE_VLASYNYK_ID, інакше — email.
 * Якщо нічого не налаштовано — всі рівні (захист вимкнено, поведінка як раніше).
 */
export const ciToVlasnyk = (
  korystuvach: Korystuvach | null | undefined
): boolean => {
  if (idVlasnyka) {
    return String(korystuvach?.id || "").toLowerCase() === idVlasnyka;
  }
  if (emailVlasnyka) {
    return String(korystuvach?.email || "").toLowerCase() === emailVlasnyka;
  }
  return true;
};

/** Читає JSON із localStorage. Повертає `unknown`, бо звідти може прийти що завгодно. */
const chytaty = (klyuch: string): unknown => {
  try {
    const ryadok = localStorage.getItem(klyuch);
    return ryadok === null ? undefined : JSON.parse(ryadok);
  } catch {
    return undefined;
  }
};

export const zberyhytyLokalne = (klyuch: string, znachennya: unknown): void => {
  try {
    localStorage.setItem(klyuch, JSON.stringify(znachennya));
  } catch {
    /* сховище недоступне — дані лишаться лише в цій сесії */
  }
};

/**
 * Читає персональні дані користувача.
 * Старі спільні ключі (без id користувача) читаємо ЛИШЕ якщо це власник —
 * чужі акаунти ніколи не побачать мої збережені галочки/витрати.
 * <T> — «дженерик»: функція повертає саме той тип, який їй дали за замовчуванням.
 */
export const otrymatyLokalne = <T>(
  klyuch: string,
  zamovchennya: T,
  korystuvach: Korystuvach | null,
  staryyKlyuch?: string
): T => {
  const seychas = chytaty(klyuch);
  if (seychas !== undefined) return seychas as T;
  if (
    staryyKlyuch &&
    staryyKlyuch !== klyuch &&
    ciToVlasnyk(korystuvach)
  ) {
    const stare = chytaty(staryyKlyuch);
    if (stare !== undefined) return stare as T;
  }
  return zamovchennya;
};
