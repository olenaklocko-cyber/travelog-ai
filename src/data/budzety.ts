import type { Korystuvach, Podorozh } from "../types";
import { uidKorystuvacha, otrymatyLokalne, zberyhytyLokalne } from "./dostup";

/** Збережені бюджети виглядають як «словник: id → щось»; перевіряємо самі. */
type MapaZnachen = Record<string, unknown>;

const bazovyyKlyuch = "travelog-budzety";

const klyuchDlya = (korystuvach: Korystuvach | null): string =>
  `${bazovyyKlyuch}-${uidKorystuvacha(korystuvach)}`;

const zavantazhBudzety = (korystuvach: Korystuvach | null): MapaZnachen => {
  const map = otrymatyLokalne<MapaZnachen>(
    klyuchDlya(korystuvach),
    {},
    korystuvach,
    bazovyyKlyuch
  );
  return map && typeof map === "object" && !Array.isArray(map) ? map : {};
};

export const otrymatyBudzet = (
  id: string | number,
  baza: number | undefined,
  korystuvach: Korystuvach | null
): number => {
  const map = zavantazhBudzety(korystuvach);
  const znachennya = map[String(id)];
  if (znachennya !== undefined && Number.isFinite(Number(znachennya))) {
    return Number(znachennya);
  }
  return Number(baza) || 0;
};

export const zminytyBudzet = (
  id: string | number,
  znachennya: number,
  korystuvach: Korystuvach | null
): MapaZnachen => {
  const map = zavantazhBudzety(korystuvach);
  map[String(id)] = Number(znachennya) || 0;
  zberyhytyLokalne(klyuchDlya(korystuvach), map);
  return map;
};

export const zastosuvatyBudzety = (
  spysok: Podorozh[],
  korystuvach: Korystuvach | null
): Podorozh[] =>
  spysok.map((p) => ({
    ...p,
    budget: otrymatyBudzet(p.id, p.budget, korystuvach),
  }));

const bazovyyKlyuchZibrano = "travelog-zibrano";

const klyuchZibranoDlya = (korystuvach: Korystuvach | null): string =>
  `${bazovyyKlyuchZibrano}-${uidKorystuvacha(korystuvach)}`;

const zavantazhZibrany = (korystuvach: Korystuvach | null): MapaZnachen => {
  const map = otrymatyLokalne<MapaZnachen>(
    klyuchZibranoDlya(korystuvach),
    {},
    korystuvach
  );
  return map && typeof map === "object" && !Array.isArray(map) ? map : {};
};

export const otrymatyZibrano = (
  id: string | number,
  korystuvach: Korystuvach | null
): number | undefined => {
  const znachennya = zavantazhZibrany(korystuvach)[String(id)];
  if (znachennya !== undefined && Number.isFinite(Number(znachennya))) {
    return Number(znachennya);
  }
  return undefined;
};

export const zminytyZibrano = (
  id: string | number,
  znachennya: number | null | undefined,
  korystuvach: Korystuvach | null
): MapaZnachen => {
  const map = zavantazhZibrany(korystuvach);
  if (znachennya === null || znachennya === undefined) {
    delete map[String(id)];
  } else {
    map[String(id)] = Number(znachennya) || 0;
  }
  zberyhytyLokalne(klyuchZibranoDlya(korystuvach), map);
  return map;
};

export const zastosuvatyZibrano = (
  spysok: Podorozh[],
  korystuvach: Korystuvach | null
): Podorozh[] =>
  spysok.map((p) => {
    const nad = otrymatyZibrano(p.id, korystuvach);
    return nad === undefined
      ? p
      : { ...p, zibrano: nad, zibranoSvoe: true };
  });
