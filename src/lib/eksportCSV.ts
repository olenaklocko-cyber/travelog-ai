import type { Krayina, Podorozh } from "../types";

/** Крапка з комою: так розуміє українська локаль Excel. */
const ROZDILNYK = ";";
/** UTF-8 BOM — інакше Excel «зʼїдає» кирилицю. */
const BOM = "﻿";
/** Класичний роздільник рядка у CSV (Excel його очікує). */
const PERELYK = "\r\n";

const lapy = (znachennya: string): string =>
  `"${String(znachennya).replace(/"/g, '""')}"`;

export const ZAGOLOVKY = [
  "Назва",
  "Країна",
  "Статус",
  "Бюджет (грн)",
  "Зібрано (грн)",
  "Витрачено (грн)",
] as const;

/** Назва файлу: `podorozhi-2026-10-02.csv` */
export function nazvaCSV(shchasnyyDen = new Date()): string {
  const den = shchasnyyDen.toISOString().slice(0, 10);
  return `podorozhi-${den}.csv`;
}

/**
 * Готує вміст CSV із поточного (відфільтрованого) списку подорожей.
 * Чиста функція — нічого не завантажує й не мутує вхідні дані.
 */
export function podorozhiDoCSV(
  podorozhi: Podorozh[],
  krajiny: Record<string, Krayina>
): string {
  const ryadky = podorozhi.map((p) => [
    p.title,
    krajiny[p.country_code]?.nazva || p.country_code,
    p.status,
    String(Number(p.budget) || 0),
    String(Number(p.zibrano) || 0),
    String(Number(p.vytrachenoSuma) || 0),
  ]);

  return (
    [ZAGOLOVKY, ...ryadky]
      .map((ryadok) => ryadok.map(lapy).join(ROZDILNYK))
      .join(PERELYK) + PERELYK
  );
}

/** Завантажує готовий CSV у браузері. */
export function skachatyCSV(nazvaFaylu: string, vmist: string): void {
  const blob = new Blob([BOM + vmist], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const posylannya = document.createElement("a");
  posylannya.href = url;
  posylannya.download = nazvaFaylu;
  document.body.appendChild(posylannya);
  posylannya.click();
  document.body.removeChild(posylannya);
  URL.revokeObjectURL(url);
}
