import { useEffect, useRef, useState } from "react";
import { dodatyKrayinuMapy, krajiny } from "../data/krajiny";
import { populyarniDestynaciyi } from "../data/populyarniDestynaciyi";
import { normZapyt, praporZCode } from "./rakhunky";
import type { Podorozh } from "../types";

/** Країна, знайдена через API країн світу */
export interface KrayinaZAPI {
  code: string;
  name: string;
  nameUa: string;
  nameUaNorm: string;
  capital: string;
  kodyValut: string[];
}

/** Кешований каталог: валюти + список країн */
export interface KatalogKrayin {
  valuty: Record<string, { name: string }>;
  spysok: KrayinaZAPI[];
}

/** Країна після збагачення (прапор, валюта текстом) */
export interface ZnaydenaKrayyna extends KrayinaZAPI {
  cherezSlovnyk: boolean;
  dzoom: string;
  prapor: string;
  valutaText: string;
}

/** Стан попереднього перегляду країни у пошуку */
export type StanKrayyny = {
  zapit: string;
  stan: "shukayemo" | "nema" | "uzhe" | "znaydeno" | "pomylka";
  krayna?: ZnaydenaKrayyna;
};

export const versalizuvaty = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const timeoutDlyaFetch = () =>
  typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? AbortSignal.timeout(10000)
    : undefined;

/** Чи є вже щось схоже серед своїх подорожей — тоді API не чіпаємо. */
export function yZnaydenoVMisty(podorozhi: Podorozh[], zapit: string): boolean {
  const q = normZapyt(zapit);
  return podorozhi.some((p) => {
    const nazvaKrayiny = krajiny[p.country_code]?.nazva || p.country_code;
    return (
      normZapyt(p.title).includes(q) ||
      normZapyt(nazvaKrayiny).includes(q) ||
      p.country_code.toLowerCase() === q
    );
  });
}

/** Збираємо кешований каталог із трьох відкритих JSON-джерел. */
export function zbuduvatyKatalog(
  krajinyJson: Record<
    string,
    { name?: string; capital?: string; currency?: string[] }
  >,
  valutyJson: Record<string, { name: string }>,
  perelykUa: Record<string, string>
): KatalogKrayin {
  return {
    valuty: valutyJson,
    spysok: Object.entries(krajinyJson).map(([code, k]) => ({
      code,
      name: k.name || "",
      nameUa: perelykUa[code] || "",
      nameUaNorm: normZapyt(perelykUa[code] || ""),
      capital: k.capital || "",
      kodyValut: k.currency || [],
    })),
  };
}

/** Пошук у каталозі: спочатку словник популярних напрямків, потім усе підряд. */
export function poshukUKatalogu(
  katalog: KatalogKrayin,
  q: string
): { kodZSlovnyka?: string; znaydena?: KrayinaZAPI } {
  const kodZSlovnyka = populyarniDestynaciyi[q];
  let znaydena = kodZSlovnyka
    ? katalog.spysok.find((k) => k.code === kodZSlovnyka)
    : undefined;
  if (!znaydena) {
    znaydena = katalog.spysok.find(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.nameUaNorm.includes(q) ||
        k.code.toLowerCase() === q ||
        (k.capital && k.capital.toLowerCase().includes(q))
    );
  }
  return { kodZSlovnyka, znaydena };
}

/** Додаємо прапор і назву валюти текстом. */
export function zbagatytyZnaydenu(
  znaydena: KrayinaZAPI,
  zapit: string,
  kodZSlovnyka: string | undefined,
  valuty: KatalogKrayin["valuty"]
): ZnaydenaKrayyna {
  return {
    ...znaydena,
    cherezSlovnyk: Boolean(kodZSlovnyka),
    dzoom: zapit,
    prapor: `https://flagcdn.com/w320/${znaydena.code.toLowerCase()}.png`,
    valutaText:
      znaydena.kodyValut.length === 0
        ? "—"
        : znaydena.kodyValut
            .map((c) => (valuty[c] ? `${valuty[c].name} (${c})` : c))
            .join(", "),
  };
}

/** Готуємо нову подорож і запис для карти країн. */
export function novaPodorozhZKrayiny(krayna: ZnaydenaKrayyna): {
  nova: Podorozh;
  nazvaKrayiny: string;
  mapa: { prapor: string; nazva: string; valiuta: string };
} {
  const nazvaKrayiny = krayna.nameUa || krayna.name;
  const nazva = krayna.cherezSlovnyk ? versalizuvaty(krayna.dzoom) : nazvaKrayiny;
  return {
    nazvaKrayiny,
    mapa: {
      prapor: praporZCode(krayna.code),
      nazva: nazvaKrayiny,
      valiuta: krayna.kodyValut[0] || "",
    },
    nova: {
      id: `api-${Date.now()}`,
      title: nazva,
      country_code: krayna.code,
      budget: 50000,
      status: "Плануються",
      zibrano: 0,
      vytrachenoSuma: 0,
    },
  };
}

async function zavantazhytyKatalog(): Promise<KatalogKrayin> {
  const [katalogKrayin, katalogValut, perelykUa] = await Promise.all([
    fetch(
      "https://raw.githubusercontent.com/annexare/Countries/master/dist/countries.min.json",
      { signal: timeoutDlyaFetch() }
    ).then((r) => {
      if (!r.ok) throw new Error("API недоступне");
      return r.json();
    }),
    fetch(
      "https://raw.githubusercontent.com/annexare/Countries/master/dist/currencies.min.json",
      { signal: timeoutDlyaFetch() }
    ).then((r) => r.json()),
    fetch(
      "https://raw.githubusercontent.com/umpirsky/country-list/master/data/uk/country.json",
      { signal: timeoutDlyaFetch() }
    ).then((r) => r.json()),
  ]);
  return zbuduvatyKatalog(katalogKrayin, katalogValut, perelykUa);
}

interface Args {
  /** Поточний текст пошуку з поля введення. */
  poshuk: string;
  setPoshuk: (v: string) => void;
  /** Список подорожей — щоб не шукати в інтернеті те, що вже є. */
  podorozhi: Podorozh[];
  /** Знайдену країну додано: сторінка зберігає й додає подорож у список. */
  onDodano: (p: Podorozh, nazvaKrayiny: string) => void;
}

/**
 * 🔎 Пошук країни у відкритих API: кешований каталог, затримка 600 мс,
 * стани «шукаємо / нема / вже є / знайдено / помилка».
 */
export function usePoshukKrayin({
  poshuk,
  setPoshuk,
  podorozhi,
  onDodano,
}: Args) {
  const [krayynaAPI, setKrayynaAPI] = useState<StanKrayyny | null>(null);
  const katalogUseRef = useRef<KatalogKrayin | null>(null);

  useEffect(() => {
    const zapit = poshuk.trim();
    if (zapit.length < 2) return undefined;
    if (yZnaydenoVMisty(podorozhi, zapit)) return undefined;

    const taymer = setTimeout(async () => {
      const q = normZapyt(zapit);
      setKrayynaAPI({ zapit, stan: "shukayemo" });
      try {
        if (!katalogUseRef.current) {
          katalogUseRef.current = await zavantazhytyKatalog();
        }
        const katalog = katalogUseRef.current;
        const { znaydena, kodZSlovnyka } = poshukUKatalogu(katalog, q);

        if (!znaydena) {
          setKrayynaAPI({ zapit, stan: "nema" });
          return;
        }

        const krayna = zbagatytyZnaydenu(
          znaydena,
          zapit,
          kodZSlovnyka,
          katalog.valuty
        );
        const uzhe = podorozhi.some((p) => p.country_code === krayna.code);
        setKrayynaAPI({ zapit, stan: uzhe ? "uzhe" : "znaydeno", krayna });
      } catch {
        setKrayynaAPI({ zapit, stan: "pomylka" });
      }
    }, 600);

    return () => clearTimeout(taymer);
  }, [poshuk, podorozhi]);

  const apiPrev =
    krayynaAPI && krayynaAPI.zapit === poshuk.trim() ? krayynaAPI : null;

  const dobatyApiKrayinu = () => {
    const krayna = apiPrev?.krayna;
    if (!krayna) return;

    const { nova, nazvaKrayiny, mapa } = novaPodorozhZKrayiny(krayna);
    dodatyKrayinuMapy(krayna.code, mapa);
    onDodano(nova, nazvaKrayiny);

    setPoshuk("");
    setKrayynaAPI(null);
  };

  return { apiPrev, dobatyApiKrayinu };
}
