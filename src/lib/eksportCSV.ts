import type { Krayina, Podorozh } from "../types";

/** Крапка з комою: так розуміє українська локаль Excel. */
const ROZDILNYK = ";";
/** UTF-8 BOM — інакше Excel «зʼїдає» кирилицю. */
const BOM = "﻿";
/** Класичний роздільник рядка у CSV (Excel його очікує). */
const PERELYK = "\r\n";

/** Службові символи, які Excel трактує як початок формули (CWE-1236). */
const POCHATAK_FORMULY = /^[=+\-@]/;

const lapy = (znachennya: string, zakhystVidFormul = false): string => {
  const tex = String(znachennya);
  const bezpechnyy =
    zakhystVidFormul && POCHATAK_FORMULY.test(tex) ? `'${tex}` : tex;
  return `"${bezpechnyy.replace(/"/g, '""')}"`;
};

/** Прибирає пробіли з числа: `120 000` → 120000, інакше мовчки вийде 0. */
const yakChyslo = (znachennya: unknown): number => {
  const n = Number(String(znachennya ?? "").replace(/[\s\u00a0]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const ZAGOLOVKY = [
  "Назва",
  "Країна",
  "Статус",
  "Бюджет (грн)",
  "Зібрано (грн)",
  "Витрачено (грн)",
] as const;

/** Назва файлу: `podorozhi-2026-10-02.csv` (локальна дата, не UTC). */
export function nazvaCSV(den = new Date()): string {
  const dv = (n: number) => String(n).padStart(2, "0");
  return `podorozhi-${den.getFullYear()}-${dv(den.getMonth() + 1)}-${dv(
    den.getDate()
  )}.csv`;
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
    lapy(p.title, true),
    lapy(krajiny[p.country_code]?.nazva || p.country_code, true),
    lapy(p.status, true),
    lapy(String(yakChyslo(p.budget))),
    lapy(String(yakChyslo(p.zibrano))),
    lapy(String(yakChyslo(p.vytrachenoSuma))),
  ]);

  return (
    [ZAGOLOVKY.map((z) => lapy(z)), ...ryadky].map((ryadok) => ryadok.join(ROZDILNYK)).join(PERELYK) +
    PERELYK
  );
}

/** Вміст файлу: UTF-8 BOM + таблиця — саме те, що піде у Blob. */
export function vmistCSV(
  podorozhi: Podorozh[],
  krajiny: Record<string, Krayina>
): string {
  return BOM + podorozhiDoCSV(podorozhi, krajiny);
}

/** Завантажує готовий CSV у браузері. */
export function skachatyCSV(nazvaFaylu: string, vmist: string): void {
  const blob = new Blob([vmist], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const posylannya = document.createElement("a");
  posylannya.href = url;
  posylannya.download = nazvaFaylu;
  document.body.appendChild(posylannya);
  posylannya.click();
  document.body.removeChild(posylannya);
  URL.revokeObjectURL(url);
}
