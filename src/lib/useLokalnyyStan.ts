import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { otrymatyLokalne, zberyhytyLokalne } from "../data/dostup";
import type { Korystuvach } from "../types";

export interface ParsyLokalnogoStanu<T> {
  /** Під яким ключем дані лежать у localStorage. */
  klyuch: string;
  korystuvach: Korystuvach | null;
  /** Старий (спільний) ключ: читаємо його лише для власника. */
  staryyKlyuch?: string;
  /** Значення, якщо в сховищі нічого немає. */
  zamovchennya: T;
  /** false — не читати під час створення (дані ще не прийшли з сервера). */
  chytatyZrazu?: boolean;
  /** false — тимчасово не зберігати (поки триває завантаження). */
  zberihaty?: boolean;
  /** Приведення прочитаного значення до потрібного вигляду.
   *  Має бути стабільною функцією (об'явлена поза компонентом). */
  obrobyty?: (zsyre: unknown) => T;
}

export type LokalnyyStan<T> = [
  stan: T,
  zminyty: Dispatch<SetStateAction<T>>,
  perechytaty: (novyyeZamovchennya: T) => void,
];

/**
 * Стан, який автоматично зберігається в localStorage.
 * Замінює пару «useState + useEffect(зберегти)» та розрізні
 * виклики otrymatyLokalne/zberyhytyLokalne по всій сторінці.
 */
export function useLokalnyyStan<T>(
  parsy: ParsyLokalnogoStanu<T>
): LokalnyyStan<T> {
  const {
    klyuch,
    korystuvach,
    staryyKlyuch,
    zamovchennya,
    chytatyZrazu = true,
    zberihaty = true,
    obrobyty,
  } = parsy;

  const chytaty = useCallback(
    (zamovchennyaDlyaChytannya: T): T => {
      const syre = otrymatyLokalne<T>(
        klyuch,
        zamovchennyaDlyaChytannya,
        korystuvach,
        staryyKlyuch
      );
      return obrobyty ? obrobyty(syre) : syre;
    },
    [klyuch, korystuvach, staryyKlyuch, obrobyty]
  );

  const [stan, setStan] = useState<T>(() =>
    chytatyZrazu ? chytaty(zamovchennya) : zamovchennya
  );

  useEffect(() => {
    if (!zberihaty) return;
    zberyhytyLokalne(klyuch, stan);
  }, [stan, klyuch, zberihaty]);

  /** Прочитати ще раз — наприклад, коли з сервера прийшли нові дані.
   *  Аргумент — значення на випадок, якщо в сховищі поки порожньо. */
  const perechytaty = useCallback(
    (novyyeZamovchennya: T): void => {
      setStan(chytaty(novyyeZamovchennya));
    },
    [chytaty]
  );

  return [stan, setStan, perechytaty];
}
