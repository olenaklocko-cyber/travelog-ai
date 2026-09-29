import type { Korystuvach, Podorozh } from "../types";
import { uidKorystuvacha, otrymatyLokalne, zberyhytyLokalne } from "./dostup";

const klyuchApi = "travelog-api-trips";
const klyuchApiDlya = (korystuvach: Korystuvach | null): string =>
  `${klyuchApi}-${uidKorystuvacha(korystuvach)}`;

export const zavantazhPodorozhiAPI = (
  korystuvach: Korystuvach | null
): Podorozh[] => {
  const spysok = otrymatyLokalne<Podorozh[]>(
    klyuchApiDlya(korystuvach),
    [],
    korystuvach,
    klyuchApi
  );
  return Array.isArray(spysok) ? spysok : [];
};

export const zberezhytyPodorozhAPI = (
  korystuvach: Korystuvach | null,
  podorozh: Podorozh
): Podorozh[] => {
  const spysok = [podorozh, ...zavantazhPodorozhiAPI(korystuvach)];
  zberyhytyLokalne(klyuchApiDlya(korystuvach), spysok);
  return spysok;
};

export const vydalytyPodorozhAPI = (
  korystuvach: Korystuvach | null,
  id: string | number
): Podorozh[] => {
  const spysok = zavantazhPodorozhiAPI(korystuvach).filter(
    (p) => String(p.id) !== String(id)
  );
  zberyhytyLokalne(klyuchApiDlya(korystuvach), spysok);
  return spysok;
};

const klyuchPryhovan = "travelog-pryhovani-mock";

const klyuchPryhovanDlya = (korystuvach: Korystuvach | null): string =>
  `travelog-pryhovani-${uidKorystuvacha(korystuvach)}`;

export const prykhovaniMock = (korystuvach: Korystuvach | null): string[] => {
  const spysok = otrymatyLokalne<string[]>(
    klyuchPryhovanDlya(korystuvach),
    [],
    korystuvach,
    klyuchPryhovan
  );
  return Array.isArray(spysok) ? spysok : [];
};

export const prykhovatyMock = (
  korystuvach: Korystuvach | null,
  id: string | number
): string[] => {
  const spysok = [
    ...new Set([...prykhovaniMock(korystuvach), String(id)]),
  ];
  zberyhytyLokalne(klyuchPryhovanDlya(korystuvach), spysok);
  return spysok;
};
