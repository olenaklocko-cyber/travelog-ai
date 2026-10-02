import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Button,
  Checkbox,
  Empty,
  Input,
  InputNumber,
  Select,
  Spin,
  Tabs,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
  CloseOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import supabase from "../supabase";
import Shapka from "../components/Shapka";
import { krajiny } from "../data/krajiny";
import { obkladynkaPodorozhi } from "../data/obkladynky";
import { faktyKrayin } from "../data/faktyKrayin";
import { chekListy } from "../data/chekListy";
import { otrymatyBudzet, zminytyBudzet, otrymatyZibrano, zminytyZibrano } from "../data/budzety";
import {
  ciToVlasnyk,
  uidKorystuvacha,
} from "../data/dostup";
import { mockTrips } from "../data/mockTrips";
import { zavantazhPodorozhiAPI } from "../data/podorozhiAPI";
import { apiAdres } from "../lib/api";
import { useLokalnyyStan } from "../lib/useLokalnyyStan";
import type { Korystuvach, PoradaServera, TochkaChek, Vytrata } from "../types";
import {
  formatHryven,
  procentCheklista,
  zalyshZibrano,
} from "../lib/rakhunky";
import "./Podorozh.css";

const formatValuta = (chyslo: number | string | undefined): string =>
  new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: Number(chyslo) < 10 ? 4 : 2,
  }).format(Number(chyslo) || 0);

const kategoriVytrat = ["Транспорт", "Житло", "Розваги", "Їжа"];

const kolirStatusu = {
  "Активні збори": "processing",
  "Плануються": "warning",
  "Вже відвідані": "success",
};

const kolirKategoriy: Record<string, string> = {
  Транспорт: "#0d9488",
  Житло: "#f59e0b",
  Розваги: "#8b5cf6",
  Їжа: "#ef4444",
};

const prohorynka = "— грн";

const bazaCheklista = [
  "Паспорт (дійсний щонайменше 6 місяців)",
  "Квитки та бронювання житла",
  "Готівка та банківська карта",
  "Зарядка і powerbank",
  "Аптечка та особисті ліки",
  "Телефон, навушники, документи",
];

const dobirZaKrayinoyu: Record<string, string[]> = {
  AE: [
    "Сонцезахисний крем",
    "Легкий одяг, що закриває плечі",
    "Зволожувальний крем",
  ],
  TZ: ["Купальник / плавки", "Сонцезахисний крем", "Панамка та окуляри"],
  TH: ["Купальник / плавки", "Репелент від комах", "Легка куртка від дощу"],
  DO: ["Купальник / плавки", "Сонцезахисний крем", "Панамка та окуляри"],
  ID: ["Купальник / плавки", "Репелент від комах", "Шльорби для дайвінгу"],
  HR: ["Купальник", "Легка куртка від дощу", "Зручне взуття для стежок"],
  UA: ["Тепла куртка", "Термобілизна", "Шапка і рукавиці"],
  EG: ["Купальник / плавки", "Сонцезахисний крем", "Окуляри від сонця"],
  LT: ["Зручне взуття для прогулянок", "Дощовик"],
  IL: ["Зручне взуття для прогулянок", "Легкий одяг і головний убір"],
  MD: ["Зручне взуття для прогулянок", "Легка куртка на вечір"],
};

const zamovchennyaCheklista = (podorozh: {
  id: string | number;
  country_code: string;
}): TochkaChek[] => {
  const mustVisit = chekListy[String(podorozh.id)];
  if (mustVisit) {
    return mustVisit.map((tekst, index) => ({
      id: index + 1,
      tekst,
      zrobleno: false,
    }));
  }
  return [
    ...bazaCheklista,
    ...(dobirZaKrayinoyu[podorozh.country_code] || []),
  ].map((tekst, index) => ({ id: index + 1, tekst, zrobleno: false }));
};

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

interface PodorozhTiloProps {
  id: string;
  korystuvach: Korystuvach;
}

function PodorozhTilo({ id, korystuvach }: PodorozhTiloProps) {
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

  // Поки триває завантаження, нічого не пишемо в сховище —
  // інакше «порожній» стер би збережені галочки/витрати користувача.
  const [vytraty, setVytraty, perechytatyVytraty] = useLokalnyyStan<Vytrata[]>({
    klyuch: klyuchVytrat,
    korystuvach,
    staryyKlyuch: staryyKlyuchVytrat,
    zamovchennya: [],
    chytatyZrazu: Boolean(mock),
    zberihaty: !zavantazhennya,
  });
  const [chek, setChek, perechytatyChek] = useLokalnyyStan<TochkaChek[] | null>(
    {
      klyuch: klyuchChek,
      korystuvach,
      staryyKlyuch: staryyKlyuchChek,
      zamovchennya: mock ? zamovchennyaCheklista(mock) : null,
      chytatyZrazu: Boolean(mock),
      zberihaty: !zavantazhennya,
      obrobyty: yakChek,
    }
  );

  const [sumaVytraty, setSumaVytraty] = useState<number | null>(null);
  const [kategoriya, setKategoriya] = useState(kategoriVytrat[0]);
  const [novyyPunkt, setNovyyPunkt] = useState("");
  const [grn, setGrn] = useState(1000);
  const [budzetZminenyy, setBudzetZminenyy] = useState(() =>
    otrymatyBudzet(id, mock?.budget, korystuvach)
  );
  const [zibranoNad, setZibranoNad] = useState(() =>
    otrymatyZibrano(id, korystuvach)
  );

  // 🖥 Запит до НАШОГО сервера (server/server.ts): запит → відповідь.
  // stan: який етап зараз; «shukayemo» показуємо, якщо код країни ще не встиг
  // отримати відповідь (див. stanServeraZaраз нижче).
  const [stanServera, setStanServera] = useState<{
    kod: string;
    stan: "hocho" | "nema" | "pomylka";
    dany?: PoradaServera;
  } | null>(null);

  useEffect(() => {
    const kod = podorozh?.country_code;
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
  }, [podorozh?.country_code]);

  // 🤖 AI-порада: запит летить на НАШ сервер (POST /api/ai/porada),
  // сервер перевіряє логін + ліміт, вже потім дзвонить у модель.
  // Ключ моделі у браузер не потрапляє — його взагалі тут немає.
  const [zapitAI, setZapitAI] = useState("");
  const [stanAI, setStanAI] = useState<
    { stan: "spokijno" } | { stan: "shukayemo" } | { stan: "vidpovid"; tekst: string; model: string; zalyshok?: number } | { stan: "pomylka"; tekst: string }
  >({ stan: "spokijno" });

  const shvytriZapyty = [
    "Що взяти з собою в цю подорож?",
    "Як заощадити в поїздці?",
    "Порадь що подивитись місцевим?",
  ];

  const zapytatyAI = async (tekst?: string) => {
    const zapyt = (tekst ?? zapitAI).trim();
    if (!zapyt || !podorozh) return;
    if (stanAI.stan === "shukayemo") return;
    setStanAI({ stan: "shukayemo" });
    try {
      const { data } = await supabase.auth.getSession();
      const tokyn = data.session?.access_token;
      const vidpovid = await fetch(apiAdres("/api/ai/porada"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tokyn ? { Authorization: `Bearer ${tokyn}` } : {}),
        },
        body: JSON.stringify({ zapyt, krajyna: podorozh.country_code }),
      });
      const dany = (await vidpovid.json()) as {
        odpovid?: string;
        model?: string;
        zalyshok?: number;
        pomylka?: string;
      };
      if (!vidpovid.ok) {
        setStanAI({
          stan: "pomylka",
          tekst: dany.pomylka ?? "Сервер відмовив (невідома помилка)",
        });
        return;
      }
      setStanAI({
        stan: "vidpovid",
        tekst: dany.odpovid ?? "",
        model: dany.model ?? "",
        zalyshok: dany.zalyshok,
      });
    } catch {
      setStanAI({
        stan: "pomylka",
        tekst: "Сервер AI не відповідає — запусти: npm run server",
      });
    }  };

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

  const budzet = budzetZminenyy;
  const zibranoBase = Number(podorozh?.zibrano) || 0;
  // Власноруч вказана сума зібраного персональна: власник бачить свою
  // (або базову з витрат), чужий — лише власноруч введену, інакше прочерк.
  const zibrano = vlasnyk
    ? zibranoNad ?? zibranoBase
    : zibranoNad ?? 0;
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
    setVytraty((star) => [
      ...star,
      { id: Date.now(), suma: Number(sumaVytraty), kategoriya },
    ]);
    setSumaVytraty(null);
  };

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

  const dodatyPunkt = () => {
    const tekst = novyyPunkt.trim();
    if (!tekst) return;
    setChek((star) => [...(star || []), { id: Date.now(), tekst, zrobleno: false }]);
    setNovyyPunkt("");
  };

  const peremknuty = (pid: number) =>
    setChek((star) =>
      (star || []).map((it) =>
        it.id === pid ? { ...it, zrobleno: !it.zrobleno } : it
      )
    );

  const vydalyty = (pid: number) =>
    setChek((star) => (star || []).filter((it) => it.id !== pid));

  const shapkaZaVantazhennya = (
    <div className="podorozh-zahruzka">
      <Spin size="large" />
      <p>Завантажуємо подорож...</p>
    </div>
  );

  if (zavantazhennya) {
    return (
      <div className="obolonka">
        <Shapka korystuvach={korystuvach} />
        <div className="podorozh-tulo">{shapkaZaVantazhennya}</div>
      </div>
    );
  }

  if (!podorozh) {
    return (
      <div className="obolonka">
        <Shapka korystuvach={korystuvach} />
        <div className="podorozh-tulo">
          <Button icon={<ArrowLeftOutlined />} className="nazad">
            <Link to="/">Назад до подорожей</Link>
          </Button>
          <Empty description="Подорож не знайдено. Можливо, її видалено." />
        </div>
      </div>
    );
  }

  const krajyna = krajiny[podorozh.country_code] || {
    prapor: "🌍",
    nazva: podorozh.country_code,
    valiuta: "",
  };
  const fakty = faktyKrayin[podorozh.country_code] || null;
  const kurs = fakty?.kurs || 1;
  const zroblenoCount = (chek || []).filter((it) => it.zrobleno).length;
  const vsiogoChek = (chek || []).length;
  const procentChek = procentCheklista(zroblenoCount, vsiogoChek);

  // Стан сервера «зараз»: якщо країна вже змінилася, а відповідь ще летить —
  // показуємо завантаження (не старі дані)
  const stanServeraZaраз =
    stanServera?.kod === podorozh.country_code ? stanServera.stan : "shukayemo";
  const poradaServera =
    stanServeraZaраз === "hocho" ? stanServera?.dany : undefined;

  const vkladky = [
    {
      key: "finansy",
      label: "💰 Фінанси",
      children: (
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
                onChange={zminytyBudzetLokalno}
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
                onChange={zminytyZibranoLokalno}
                addonAfter="грн"
                style={{ width: 210 }}
                placeholder="не вказано"
              />
            </div>
          </div>
        </>
      ),
    },
    {
      key: "fakty",
      label: "🌍 Цікаві факти",
      children: (
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
                🚫 Сервер відмовив: він не знає країну «{krajyna.nazva}» —
                такі правила сервера (лише 15 країн)
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
                    (обчислено на сервері з секретного ключа — сам ключ у браузер
                    не потрапив)
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
                <b>1 {krajyna.valiuta} ≈ {formatValuta(kurs)} грн</b>
              </div>
            </div>
          </div>

          <div className="server-kartka ai-kartka">
            <h3>🤖 Розумна порада від ШІ</h3>
            <p className="ai-pidkazka">
              Запит іде на наш сервер → сервер перевіряє, що ти увійшла і що
              ліміт не вичерпано → уже потім дзвонить у модель. Ключ моделі
              лишається на сервері.
            </p>
            <div className="ai-ryadok">
              <Input
                value={zapitAI}
                onChange={(e) => setZapitAI(e.target.value)}
                placeholder="Напиши запит, напр.: що взяти до Японії в листопаді?"
                maxLength={500}
                onPressEnter={() => void zapytatyAI()}
                disabled={stanAI.stan === "shukayemo"}
              />
              <Button
                type="primary"
                loading={stanAI.stan === "shukayemo"}
                onClick={() => void zapytatyAI()}
              >
                Запитати ШІ
              </Button>
            </div>
            <div className="ai-shvytri">
              {shvytriZapyty.map((shvytryy) => (
                <Button
                  key={shvytryy}
                  size="small"
                  disabled={stanAI.stan === "shukayemo"}
                  onClick={() => void zapytatyAI(shvytryy)}
                >
                  {shvytryy}
                </Button>
              ))}
            </div>
            {stanAI.stan === "shukayemo" && (
              <div className="ai-stan">
                <Spin size="small" /> ШІ думає над відповіддю...
              </div>
            )}
            {stanAI.stan === "pomylka" && (
              <>
                <p className="ai-stan ai-pomylka">{stanAI.tekst}</p>
                <div className="ai-shvytri">
                  <Button
                    size="small"
                    onClick={() => setStanAI({ stan: "spokijno" })}
                  >
                    🔁 Спробувати ще раз
                  </Button>
                </div>
              </>
            )}
            {stanAI.stan === "vidpovid" && (
              <div className="ai-vidpovid">
                <p>{stanAI.tekst}</p>
                <p className="ai-meta">
                  🤖 модель {stanAI.model} — на сервері
                  {stanAI.zalyshok !== undefined && (
                    <>
                      {" "}
                      · залишилось запитів до ліміту:{" "}
                      <b>{stanAI.zalyshok}</b>
                    </>
                  )}
                </p>
                <div className="ai-shvytri">
                  <Button
                    size="small"
                    onClick={() => {
                      setStanAI({ stan: "spokijno" });
                      setZapitAI("");
                    }}
                  >
                    🔁 Запитай ще
                  </Button>
                </div>
              </div>
            )}
          </div>

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
              Тестовий фіксований курс: 1 {krajyna.valiuta} ≈{" "}
              {formatValuta(kurs)} грн
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
      ),
    },
    {
      key: "checklist",
      label: "✅ Чек-ліст",
      children: (
        <>
          <div className="chek-verh">
            <div className="chek-pole">
              <Input
                value={novyyPunkt}
                onChange={(e) => setNovyyPunkt(e.target.value)}
                onPressEnter={dodatyPunkt}
                placeholder="Нова річ у дорогу..."
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={dodatyPunkt}
              >
                Додати
              </Button>
            </div>
            <span className="chek-rahunok">
              Виконано: {zroblenoCount} з {vsiogoChek}
            </span>
          </div>

          <div className="chek-smuga">
            <div style={{ width: `${procentChek}%` }} />
          </div>

          <div className="chek-spysok">
            {(chek || []).map((it) => (
              <div className="chek-elyement" key={it.id}>
                <Checkbox
                  checked={it.zrobleno}
                  onChange={() => peremknuty(it.id)}
                >
                  <span
                    className={it.zrobleno ? "chek-tekst zrobleno" : "chek-tekst"}
                  >
                    {it.tekst}
                  </span>
                </Checkbox>
                <button
                  className="chek-vydalyty"
                  onClick={() => vydalyty(it.id)}
                  aria-label="Видалити пункт"
                >
                  <CloseOutlined />
                </button>
              </div>
            ))}
            {vsiogoChek === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Список порожній — додайте першу річ"
              />
            )}
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="obolonka">
      <Shapka korystuvach={korystuvach} />
      <div className="podorozh-tulo">
        <Button icon={<ArrowLeftOutlined />} className="nazad">
          <Link to="/">Назад до подорожей</Link>
        </Button>

        <div
          className="baner"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(4,47,46,0.88), rgba(4,47,46,0.25)), url(${obkladynkaPodorozhi(podorozh)})`,
          }}
        >
          <span className="baner-prapor">{krajyna.prapor}</span>
          <h2 className="baner-nazva">{podorozh.title}</h2>
          <p className="baner-meta">
            {krajyna.nazva} · бюджет {formatHryven(budzet)} грн
          </p>
          <Tag color={kolirStatusu[podorozh.status] || "processing"}>
            {podorozh.status}
          </Tag>
        </div>

        <Tabs defaultActiveKey="finansy" items={vkladky} />
      </div>
    </div>
  );
}

function Podorozh({ korystuvach }: { korystuvach: Korystuvach }) {
  const { id = "" } = useParams();
  return <PodorozhTilo key={id} id={id} korystuvach={korystuvach} />;
}

export default Podorozh;
