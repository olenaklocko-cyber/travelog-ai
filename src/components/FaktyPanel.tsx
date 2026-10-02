import { useEffect, useState } from "react";
import { InputNumber, Spin } from "antd";
import AiPorada from "./AiPorada";
import { krajiny } from "../data/krajiny";
import { faktyKrayin } from "../data/faktyKrayin";
import { apiAdres } from "../lib/api";
import type { Podorozh, PoradaServera } from "../types";
import "./FaktyPanel.css";

const formatValuta = (chyslo: number | string | undefined): string =>
  new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: Number(chyslo) < 10 ? 4 : 2,
  }).format(Number(chyslo) || 0);

interface FaktyPanelProps {
  podorozh: Podorozh;
}

/**
 * Вкладка «🌍 Цікаві факти»: порада з НАШОГО сервера, картка країни,
 * ШІ-порада, конвертер валют і добірка фактів.
 * Сама дбає про запит до сервера — сторінці про це знати не треба.
 */
export default function FaktyPanel({ podorozh }: FaktyPanelProps) {
  const [stanServera, setStanServera] = useState<{
    kod: string;
    stan: "hocho" | "nema" | "pomylka";
    dany?: PoradaServera;
  } | null>(null);
  const [grn, setGrn] = useState(1000);

  useEffect(() => {
    const kod = podorozh.country_code;
    if (!kod) return undefined;
    let zhyy = true;
    (async () => {
      try {
        const vidpovid = await fetch(
          `${apiAdres("/api/porada")}?krajyna=${encodeURIComponent(kod)}`
        );
        if (vidpovid.status === 404) {
          if (zhyy) setStanServera({ kod, stan: "nema" });
          return;
        }
        if (!vidpovid.ok) throw new Error("server pomylyvsya");
        const dany = (await vidpovid.json()) as PoradaServera;
        if (zhyy) setStanServera({ kod, stan: "hocho", dany });
      } catch {
        if (zhyy) setStanServera({ kod, stan: "pomylka" });
      }
    })();
    return () => {
      zhyy = false;
    };
  }, [podorozh.country_code]);

  const krajyna = krajiny[podorozh.country_code] || {
    prapor: "🌍",
    nazva: podorozh.country_code,
    valiuta: "",
  };
  const fakty = faktyKrayin[podorozh.country_code] || null;
  const kurs = fakty?.kurs || 1;

  // Стан сервера «зараз»: якщо країна вже змінилася, а відповідь ще летить —
  // показуємо завантаження (не старі дані)
  const stanServeraZaраз =
    stanServera?.kod === podorozh.country_code ? stanServera.stan : "shukayemo";
  const poradaServera =
    stanServeraZaраз === "hocho" ? stanServera?.dany : undefined;

  return (
    <>
      <div className="server-kartka">
        <h3>🖥 Порада з нашого сервера</h3>
        {stanServeraZaраз === "shukayemo" && (
          <div className="server-stan">
            <Spin size="small" /> Запит до нашого сервера...
          </div>
        )}
        {stanServeraZaраз === "pomylka" && (
          <p className="server-stan server-pomylka">
            ⚠️ Сервер не відповідає — запусти його в окремому терміналі:
            <code> npm run server</code>
          </p>
        )}
        {stanServeraZaраз === "nema" && (
          <p className="server-stan server-pomylka">
            🚫 Сервер відмовив: він не знає країну «{krajyna.nazva}» — такі
            правила сервера (лише 15 країн)
          </p>
        )}
        {stanServeraZaраз === "hocho" && poradaServera && (
          <div className="server-dani">
            <p>
              <b>📅 Найкращий сезон:</b> {poradaServera.sezon}
            </p>
            <p>
              <b>💡 Порада:</b> {poradaServera.porada}
            </p>
            <ul>
              {poradaServera.pakuvannya.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="server-promo">
              🎟 Ваш промокод: <b>{poradaServera.promo}</b>{" "}
              <span className="server-pidkazka">
                (обчислено на сервері з секретного ключа — сам ключ у браузер не
                потрапив)
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="fakty-info">
        <div className="fakty-prapor">{krajyna.prapor}</div>
        <div className="fakty-dani">
          <div className="fakty-ryadok">
            <span>🗣 Офіційна мова</span>
            <b>{fakty?.mova || "Дані уточнюються"}</b>
          </div>
          <div className="fakty-ryadok">
            <span>💵 Валюта</span>
            <b>{fakty?.valiutaPovna || krajyna.valiuta}</b>
          </div>
          <div className="fakty-ryadok">
            <span>📈 Курс до гривні</span>
            <b>
              1 {krajyna.valiuta} ≈ {formatValuta(kurs)} грн
            </b>
          </div>
        </div>
      </div>

      <AiPorada podorozh={podorozh} />

      <div className="koverter">
        <h3>🔁 Конвертер валют: гривні → валюта подорожі</h3>
        <div className="koverter-ryadok">
          <div className="koverter-pole">
            <span>Сума у гривнях</span>
            <InputNumber
              min={0}
              value={grn}
              onChange={(v) => setGrn(v ?? 0)}
              addonBefore="₴"
              style={{ width: "100%" }}
            />
          </div>
          <span className="koverter-strelka">→</span>
          <div className="koverter-pole">
            <span>
              {krajyna.nazva} ({krajyna.valiuta})
            </span>
            <div className="koverter-vidpovid">
              ≈ {formatValuta(grn / kurs)} {krajyna.valiuta}
            </div>
          </div>
        </div>
        <p className="koverter-prymitka">
          Тестовий фіксований курс: 1 {krajyna.valiuta} ≈ {formatValuta(kurs)}{" "}
          грн
        </p>
      </div>

      <div className="fakty-spysok">
        <h3>💡 Чи знаєте ви, що...</h3>
        {(fakty?.fakty || [
          "Ця країна ще чекає на свою добірку цікавих фактів — додамо найближчим часом!",
        ]).map((tekst) => (
          <div className="fakty-kartka" key={tekst}>
            <span className="fakty-ikonka">🤯</span>
            <p>{tekst}</p>
          </div>
        ))}
      </div>
    </>
  );
}
