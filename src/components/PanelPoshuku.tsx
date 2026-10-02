import { Button, Input, Spin } from "antd";
import { PlusOutlined, SendOutlined } from "@ant-design/icons";
import type { Podorozh } from "../types";
import { usePoshukKrayin, versalizuvaty } from "../lib/usePoshukKrayin";
import "./PanelPoshuku.css";

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
 * по всіх країнах світу (логіка — у хуку usePoshukKrayin).
 */
export default function PanelPoshuku({
  poshuk,
  setPoshuk,
  filtr,
  setFiltr,
  podorozhi,
  onDodano,
}: PanelPoshukuProps) {
  const { apiPrev, dobatyApiKrayinu } = usePoshukKrayin({
    poshuk,
    setPoshuk,
    podorozhi,
    onDodano,
  });

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
