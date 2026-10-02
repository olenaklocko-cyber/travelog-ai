import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button, InputNumber, Select } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatHryven, zalyshZibrano } from "../lib/rakhunky";
import type { BudzetApi, Vytrata } from "../types";

const kategoriVytrat = ["Транспорт", "Житло", "Розваги", "Їжа"];

const kolirKategoriy: Record<string, string> = {
  Транспорт: "#0d9488",
  Житло: "#f59e0b",
  Розваги: "#8b5cf6",
  Їжа: "#ef4444",
};

const prohorynka = "— грн";

interface FinansyPanelProps {
  /** Власник бачить повні суми й кільце бюджету; гість — свої витрати. */
  vlasnyk: boolean;
  vytraty: Vytrata[];
  zminytyVytraty: Dispatch<SetStateAction<Vytrata[]>>;
  budzetApi: BudzetApi;
}

/**
 * Вкладка «💰 Фінанси»: картки сум, форма витрат, діаграма, бюджети.
 * Уся фінансова арифметика живе тут, у сторінці її більше немає.
 */
export default function FinansyPanel({
  vlasnyk,
  vytraty,
  zminytyVytraty,
  budzetApi,
}: FinansyPanelProps) {
  const { budzet, zibranoBase, zibranoNad, zminytyBudzet, zminytyZibrano } =
    budzetApi;

  const [sumaVytraty, setSumaVytraty] = useState<number | null>(null);
  const [kategoriya, setKategoriya] = useState(kategoriVytrat[0]);

  const zibrano = vlasnyk ? zibranoNad ?? zibranoBase : zibranoNad ?? 0;
  const vytracheno = vytraty.reduce((s, v) => s + Number(v.suma), 0);
  const zalyshylos = zalyshZibrano(budzet, zibrano);

  const vytratyYe = vytraty.length > 0;
  const pokazZibrano = vlasnyk
    ? `${formatHryven(zibrano)} грн`
    : zibranoNad !== undefined
      ? `${formatHryven(zibranoNad)} грн`
      : prohorynka;
  const pokazVytracheno =
    vlasnyk || vytratyYe ? `${formatHryven(vytracheno)} грн` : prohorynka;
  const zalyshDoPokazu = vlasnyk
    ? zalyshylos
    : zibranoNad !== undefined
      ? zalyshZibrano(budzet, zibranoNad)
      : zalyshZibrano(budzet, vytracheno);
  const pokazZalysh =
    vlasnyk || zibranoNad !== undefined || vytratyYe
      ? `${formatHryven(zalyshDoPokazu)} грн`
      : prohorynka;
  const clCysla = (znachennya: string): string =>
    znachennya === prohorynka ? "znachennya prycher" : "znachennya";

  const finHrafik = useMemo(
    () => [
      { name: "Вже зібрано", value: Math.max(0, zibrano), kolir: "#16a34a" },
      { name: "Залишилося зібрати", value: zalyshylos, kolir: "#f59e0b" },
      { name: "Вже витрачено", value: vytracheno, kolir: "#ef4444" },
    ],
    [zibrano, zalyshylos, vytracheno]
  );

  const kiltseGosta = useMemo(() => {
    const hrupa: Record<string, number> = {};
    vytraty.forEach((v) => {
      hrupa[v.kategoriya] = (hrupa[v.kategoriya] || 0) + Number(v.suma);
    });
    const segmenty = Object.entries(hrupa).map(([name, value]) => ({
      name,
      value,
      kolir: kolirKategoriy[name] || "#0d9488",
    }));
    const razom = segmenty.reduce((s, d) => s + d.value, 0);
    const zalyshok = Math.max(0, budzet - razom);
    if (zalyshok > 0) {
      segmenty.push({
        name: "Не заповнено",
        value: zalyshok,
        kolir: "#e2e8f0",
      });
    }
    if (segmenty.length === 0) {
      segmenty.push({
        name: "Очікує на заповнення",
        value: 1,
        kolir: "#e2e8f0",
      });
    }
    return segmenty;
  }, [vytraty, budzet]);

  const kiltseData = vlasnyk ? finHrafik : kiltseGosta;

  const dodatyVytratu = () => {
    if (!Number(sumaVytraty) || Number(sumaVytraty) <= 0) return;
    zminytyVytraty((star) => [
      ...star,
      { id: Date.now(), suma: Number(sumaVytraty), kategoriya },
    ]);
    setSumaVytraty(null);
  };

  return (
    <>
      <div className="stat-kartky">
        <div className="stat-karta stat-budzet">
          <span>💳 Загальний бюджет</span>
          <b>{formatHryven(budzet)} грн</b>
        </div>
        <div className="stat-karta stat-zibrano">
          <span>💰 Зібрано</span>
          <b className={clCysla(pokazZibrano)}>{pokazZibrano}</b>
        </div>
        <div className="stat-karta stat-vytracheno">
          <span>🛒 Витрачено</span>
          <b className={clCysla(pokazVytracheno)}>{pokazVytracheno}</b>
        </div>
        <div className="stat-karta stat-zalysh">
          <span>🎯 Залишилось зібрати</span>
          <b className={clCysla(pokazZalysh)}>{pokazZalysh}</b>
        </div>
      </div>

      <div className="forma-vytrat">
        <h3>Додати витрату</h3>
        <div className="forma-vytrat-ryadok">
          <InputNumber
            min={1}
            placeholder="Сума"
            addonBefore="грн"
            value={sumaVytraty}
            onChange={setSumaVytraty}
            style={{ width: 180 }}
          />
          <Select
            value={kategoriya}
            onChange={setKategoriya}
            style={{ width: 180 }}
            options={kategoriVytrat.map((k) => ({ value: k, label: k }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={dodatyVytratu}
          >
            Додати витрату
          </Button>
        </div>
      </div>

      <div className="diagrama-blok">
        <h3>
          {vlasnyk
            ? "📊 Кільце бюджету: ціль подорожі"
            : "📊 Розподіл витрат по категоріях"}
        </h3>
        <div className="kiltse-blok">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={kiltseData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="42%"
                outerRadius="68%"
                paddingAngle={3}
                stroke="none"
              >
                {kiltseData.map((d) => (
                  <Cell key={d.name} fill={d.kolir} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) =>
                  `${formatHryven(Array.isArray(v) ? v[0] : v)} грн`
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="kiltse-tsentr">
            <span className="kiltse-tsilk">Ціль</span>
            <b className="kiltse-budzet">{formatHryven(budzet)} грн</b>
          </div>
        </div>
        <div className="budzet-ryadok">
          <span className="budzet-pidkazka">
            🎯 Змінити бюджет (ціль подорожі):
          </span>
          <InputNumber
            min={0}
            max={100000000}
            value={budzet}
            onChange={zminytyBudzet}
            addonAfter="грн"
            style={{ width: 210 }}
          />
        </div>
        <div className="budzet-ryadok">
          <span className="budzet-pidkazka">
            💰 Вже зібрано (ваша особиста сума):
          </span>
          <InputNumber
            min={0}
            max={100000000}
            value={zibranoNad ?? (vlasnyk ? zibranoBase : null)}
            onChange={zminytyZibrano}
            addonAfter="грн"
            style={{ width: 210 }}
            placeholder="не вказано"
          />
        </div>
      </div>
    </>
  );
}
