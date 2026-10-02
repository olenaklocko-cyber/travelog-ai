import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import supabase from "../supabase";
import { otrymatyBudzet, otrymatyZibrano, zminytyBudzet, zminytyZibrano } from "../data/budzety";
import { ciToVlasnyk, uidKorystuvacha } from "../data/dostup";
import { mockTrips } from "../data/mockTrips";
import { zavantazhPodorozhiAPI } from "../data/podorozhiAPI";
import { zamovchennyaCheklista } from "../data/chekListy";
import { useLokalnyyStan } from "./useLokalnyyStan";
import type {
  BudzetApi,
  Korystuvach,
  Podorozh,
  TochkaChek,
  Vytrata,
} from "../types";

/**
 * Приводимо збережений чек-ліст до правильного вигляду.
 * (У старих записах пункти могли лежати простим текстом.)
 */
const yakChek = (dany: unknown): TochkaChek[] => {
  if (!Array.isArray(dany)) return [];
  return dany
    .map((it, index): TochkaChek | null => {
      if (typeof it === "string") {
        return { id: index + 1, tekst: it, zrobleno: false };
      }
      if (it && typeof it === "object" && typeof it.tekst === "string") {
        return {
          id: Number(it.id) || index + 1,
          tekst: it.tekst,
          zrobleno: Boolean(it.zrobleno),
        };
      }
      return null;
    })
    .filter((it): it is TochkaChek => it !== null);
};

export interface DaniPodorozhi {
  podorozh: Podorozh | null;
  zavantazhennya: boolean;
  /** Чи це власник застосунку (для нього — повні суми й кільце бюджету). */
  vlasnyk: boolean;
  budzetApi: BudzetApi;
  vytraty: Vytrata[];
  zminytyVytraty: Dispatch<SetStateAction<Vytrata[]>>;
  chek: TochkaChek[] | null;
  zminytyChek: Dispatch<SetStateAction<TochkaChek[] | null>>;
}

/**
 * 📦 Усі дані сторінки подорожі в одному місці:
 * mock-подорож або запит у Supabase, витрати й чек-ліст у localStorage,
 * бюджет і сума зібраного. Сторінка отримує готове — і нічого не зберігає сама.
 */
export function usePodorozh(
  id: string,
  korystuvach: Korystuvach
): DaniPodorozhi {
  const vlasnyk = ciToVlasnyk(korystuvach);
  const uid = uidKorystuvacha(korystuvach);
  const mock =
    mockTrips.find((p) => String(p.id) === id) ||
    zavantazhPodorozhiAPI(korystuvach).find((p) => String(p.id) === id) ||
    null;
  const klyuchVytrat = `travelog-vytraty-${uid}-${id}`;
  const klyuchChek = `travelog-chek-v3-${uid}-${id}`;
  const staryyKlyuchVytrat = `travelog-vytraty-${id}`;
  const staryyKlyuchChek = `travelog-chek-v2-${id}`;

  const [podorozh, setPodorozh] = useState(mock);
  const [zavantazhennya, setZavantazhennya] = useState(!mock);
  const [budzetZminenyy, setBudzetZminenyy] = useState(() =>
    otrymatyBudzet(id, mock?.budget, korystuvach)
  );
  const [zibranoNad, setZibranoNad] = useState(() =>
    otrymatyZibrano(id, korystuvach)
  );

  // Поки триває завантаження, нічого не пишемо в сховище —
  // інакше «порожній» стер би збережені галочки/витрати користувача.
  const [vytraty, zminytyVytraty, perechytatyVytraty] = useLokalnyyStan<
    Vytrata[]
  >({
    klyuch: klyuchVytrat,
    korystuvach,
    staryyKlyuch: staryyKlyuchVytrat,
    zamovchennya: [],
    chytatyZrazu: Boolean(mock),
    zberihaty: !zavantazhennya,
  });
  const [chek, zminytyChek, perechytatyChek] = useLokalnyyStan<
    TochkaChek[] | null
  >({
    klyuch: klyuchChek,
    korystuvach,
    staryyKlyuch: staryyKlyuchChek,
    zamovchennya: mock ? zamovchennyaCheklista(mock) : null,
    chytatyZrazu: Boolean(mock),
    zberihaty: !zavantazhennya,
    obrobyty: yakChek,
  });

  // Подорож, якої немає в mock-даних, лежить у Supabase.
  useEffect(() => {
    if (mock) return undefined;
    let zhyy = true;
    supabase
      .from("trips")
      .select("*")
      .eq("id", id)
      .eq("user_id", korystuvach.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!zhyy) return;
        setPodorozh(data);
        setBudzetZminenyy(otrymatyBudzet(id, data?.budget, korystuvach));
        perechytatyVytraty([]);
        perechytatyChek(data ? zamovchennyaCheklista(data) : []);
        setZavantazhennya(false);
      });
    return () => {
      zhyy = false;
    };
  }, [
    id,
    mock,
    korystuvach,
    klyuchVytrat,
    klyuchChek,
    staryyKlyuchVytrat,
    staryyKlyuchChek,
    perechytatyVytraty,
    perechytatyChek,
  ]);

  const zminytyBudzetLokalno = (v: number | null) => {
    const znachennya = Number(v) || 0;
    setBudzetZminenyy(znachennya);
    zminytyBudzet(id, znachennya, korystuvach);
  };

  const zminytyZibranoLokalno = (v: number | null) => {
    if (v === null || v === undefined) {
      zminytyZibrano(id, null, korystuvach);
      setZibranoNad(undefined);
      return;
    }
    const znachennya = Number(v) || 0;
    zminytyZibrano(id, znachennya, korystuvach);
    setZibranoNad(znachennya);
  };

  return {
    podorozh,
    zavantazhennya,
    vlasnyk,
    budzetApi: {
      budzet: budzetZminenyy,
      zibranoBase: Number(podorozh?.zibrano) || 0,
      zibranoNad,
      zminytyBudzet: zminytyBudzetLokalno,
      zminytyZibrano: zminytyZibranoLokalno,
    },
    vytraty,
    zminytyVytraty,
    chek,
    zminytyChek,
  };
}
