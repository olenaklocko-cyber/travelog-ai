import { useEffect, useRef, useState } from "react";
import { Button, Input, Spin } from "antd";
import { PlusOutlined, SendOutlined } from "@ant-design/icons";
import { dodatyKrayinuMapy, krajiny } from "../data/krajiny";
import { populyarniDestynaciyi } from "../data/populyarniDestynaciyi";
import { normZapyt, praporZCode } from "../lib/rakhunky";
import type { Podorozh } from "../types";

const versalizuvaty = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const timeoutDlyaFetch = () =>
  typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? AbortSignal.timeout(10000)
    : undefined;

const vkladkyFiltra = [
  {
    znachennya: "Усі",
    nadpis: "Усі подорожі",
    ikona: "🌍",
    kolir: "linear-gradient(135deg, #0f766e, #14b8a6)",
    smuga: "0 8px 20px rgba(15, 118, 110, 0.4)",
  },
  {
    znachennya: "Активні збори",
    nadpis: "Активні збори",
    ikona: "💰",
    kolir: "linear-gradient(135deg, #f59e0b, #fbbf24)",
    smuga: "0 8px 20px rgba(245, 158, 11, 0.4)",
  },
  {
    znachennya: "Плануються",
    nadpis: "Плануються",
    ikona: "📅",
    kolir: "linear-gradient(135deg, #8b5cf6, #a78bfa)",
    smuga: "0 8px 20px rgba(139, 92, 246, 0.4)",
  },
  {
    znachennya: "Вже відвідані",
    nadpis: "Вже відвідані",
    ikona: "✅",
    kolir: "linear-gradient(135deg, #16a34a, #4ade80)",
    smuga: "0 8px 20px rgba(22, 163, 74, 0.4)",
  },
];

/** Країна, знайдена через API країн світу */
interface KrayinaZAPI {
  code: string;
  name: string;
  nameUa: string;
  nameUaNorm: string;
  capital: string;
  kodyValut: string[];
}

/** Кешований каталог: валюти + список країн */
interface KatalogKrayin {
  valuty: Record<string, { name: string }>;
  spysok: KrayinaZAPI[];
}

/** Країна після збагачення (прапор, валюта текстом) */
interface ZnaydenaKrayyna extends KrayinaZAPI {
  cherezSlovnyk: boolean;
  dzoom: string;
  prapor: string;
  valutaText: string;
}

/** Стан попереднього перегляду країни у пошуку */
type StanKrayyny = {
  zapit: string;
  stan: "shukayemo" | "nema" | "uzhe" | "znaydeno" | "pomylka";
  krayna?: ZnaydenaKrayyna;
};

interface PanelPoshukuProps {
  poshuk: string;
  setPoshuk: (v: string) => void;
  filtr: string;
  setFiltr: (v: string) => void;
  /** Список подорожей — щоб не шукати в інтернеті те, що вже є. */
  podorozhi: Podorozh[];
  /** Знайдену країну додано: сторінка зберігає й додає подорож у список. */
  onDodano: (p: Podorozh, nazvaKrayiny: string) => void;
}

/**
 * 🔎 Пошук: спочатку по своїх подорожах, а якщо немає —
 * по всіх країнах світу через відкриті API (з кешем і затримкою 600 мс).
 */
export default function PanelPoshuku({
  poshuk,
  setPoshuk,
  filtr,
  setFiltr,
  podorozhi,
  onDodano,
}: PanelPoshukuProps) {
  const [krayynaAPI, setKrayynaAPI] = useState<StanKrayyny | null>(null);
  const krayinyUseRef = useRef<KatalogKrayin | null>(null);

  useEffect(() => {
    const zapit = poshuk.trim();
    if (zapit.length < 2) return undefined;

    const taymer = setTimeout(async () => {
      const q = normZapyt(zapit);
      const yLocal = podorozhi.some((p) => {
        const nazvaKrayiny = krajiny[p.country_code]?.nazva || p.country_code;
        return (
          normZapyt(p.title).includes(q) ||
          normZapyt(nazvaKrayiny).includes(q) ||
          p.country_code.toLowerCase() === q
        );
      });
      if (yLocal) return;

      setKrayynaAPI({ zapit, stan: "shukayemo" });
      try {
        if (!krayinyUseRef.current) {
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

          krayinyUseRef.current = {
            valuty: katalogValut,
            spysok: Object.entries(
              katalogKrayin as Record<
                string,
                { name?: string; capital?: string; currency?: string[] }
              >
            ).map(([code, k]) => ({
              code,
              name: k.name || "",
              nameUa: perelykUa[code] || "",
              nameUaNorm: normZapyt(perelykUa[code] || ""),
              capital: k.capital || "",
              kodyValut: k.currency || [],
            })),
          };
        }

        const katalog: KatalogKrayin = krayinyUseRef.current;
        const { spysok, valuty } = katalog;
        const kodZSlovnyka = populyarniDestynaciyi[q];
        let znaydena = kodZSlovnyka
          ? spysok.find((k) => k.code === kodZSlovnyka)
          : undefined;
        if (!znaydena) {
          znaydena = spysok.find(
            (k) =>
              k.name.toLowerCase().includes(q) ||
              k.nameUaNorm.includes(q) ||
              k.code.toLowerCase() === q ||
              (k.capital && k.capital.toLowerCase().includes(q))
          );
        }

        if (!znaydena) {
          setKrayynaAPI({ zapit, stan: "nema" });
          return;
        }

        const krayna = {
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

    const nazvaKrayiny = krayna.nameUa || krayna.name;
    const nazva = krayna.cherezSlovnyk
      ? versalizuvaty(krayna.dzoom)
      : nazvaKrayiny;
    dodatyKrayinuMapy(krayna.code, {
      prapor: praporZCode(krayna.code),
      nazva: nazvaKrayiny,
      valiuta: krayna.kodyValut[0] || "",
    });

    onDodano(
      {
        id: `api-${Date.now()}`,
        title: nazva,
        country_code: krayna.code,
        budget: 50000,
        status: "Плануються",
        zibrano: 0,
        vytrachenoSuma: 0,
      },
      nazvaKrayiny
    );

    setPoshuk("");
    setKrayynaAPI(null);
  };

  return (
    <div className="panel">
      <Input
        allowClear
        size="large"
        prefix={<SendOutlined className="lupa" />}
        placeholder="Куди летимо цього разу? Введіть будь-яку країну світу..."
        value={poshuk}
        onChange={(e) => setPoshuk(e.target.value)}
        className="velykyy-poshuk"
      />
      <div className="vkladky">
        {vkladkyFiltra.map((v) => (
          <button
            key={v.znachennya}
            type="button"
            className={`vkladka ${filtr === v.znachennya ? "aktyvna" : ""}`}
            style={
              filtr === v.znachennya
                ? { background: v.kolir, boxShadow: v.smuga }
                : undefined
            }
            onClick={() => setFiltr(v.znachennya)}
          >
            <span className="vkladka-ikona">{v.ikona}</span>
            {v.nadpis}
          </button>
        ))}
      </div>

      {apiPrev && (
        <div className="api-prevyu">
          {apiPrev.stan === "shukayemo" && (
            <div className="api-stan">
              <Spin size="small" />
              Шукаємо «{apiPrev.zapit}» у базі країн світу...
            </div>
          )}

          {apiPrev.stan === "nema" && (
            <div className="api-stan api-pomylka">
              😕 Країну «{apiPrev.zapit}» не знайдено ні у ваших подорожах, ні в
              інтернеті
            </div>
          )}

          {apiPrev.stan === "uzhe" && apiPrev.krayna && (
            <div className="api-stan api-uspih">
              ✅ «{apiPrev.krayna.nameUa || apiPrev.krayna.name}» вже є у вашому
              списку подорожей!
            </div>
          )}

          {apiPrev.stan === "pomylka" && (
            <div className="api-stan api-pomylka">
              ⚠️ Не вдалося зв'язатися з API країн — перевірте інтернет і
              спробуйте ще раз
            </div>
          )}

          {apiPrev.stan === "znaydeno" && apiPrev.krayna && (
            <div className="api-kartka">
              <img
                className="api-prapor"
                src={apiPrev.krayna.prapor}
                alt={apiPrev.krayna.name}
              />
              <div className="api-dani">
                <h4>
                  {apiPrev.krayna.cherezSlovnyk
                    ? versalizuvaty(apiPrev.krayna.dzoom)
                    : apiPrev.krayna.nameUa || apiPrev.krayna.name}{" "}
                  <span className="api-name-en">{apiPrev.krayna.name}</span>
                </h4>
                {apiPrev.krayna.cherezSlovnyk && (
                  <p className="api-misto">
                    🏙 Це популярний напрямок країни{" "}
                    {apiPrev.krayna.nameUa || apiPrev.krayna.name}
                  </p>
                )}
                <p>
                  🏛 Столиця: <b>{apiPrev.krayna.capital || "—"}</b>
                </p>
                <p>
                  💵 Валюта: <b>{apiPrev.krayna.valutaText}</b>
                </p>
              </div>
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                className="api-knopka"
                onClick={dobatyApiKrayinu}
              >
                Запланувати подорож
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
