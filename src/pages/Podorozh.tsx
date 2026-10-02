import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Button,
  Checkbox,
  Empty,
  Input,
  Spin,
  Tabs,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
  CloseOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import supabase from "../supabase";
import Shapka from "../components/Shapka";
import FaktyPanel from "../components/FaktyPanel";
import FinansyPanel from "../components/FinansyPanel";
import { krajiny } from "../data/krajiny";
import { obkladynkaPodorozhi } from "../data/obkladynky";
import { chekListy } from "../data/chekListy";
import { otrymatyBudzet, zminytyBudzet, otrymatyZibrano, zminytyZibrano } from "../data/budzety";
import {
  ciToVlasnyk,
  uidKorystuvacha,
} from "../data/dostup";
import { mockTrips } from "../data/mockTrips";
import { zavantazhPodorozhiAPI } from "../data/podorozhiAPI";
import { useLokalnyyStan } from "../lib/useLokalnyyStan";
import type { Korystuvach, TochkaChek, Vytrata } from "../types";
import { formatHryven, procentCheklista } from "../lib/rakhunky";
import "./Podorozh.css";

const kolirStatusu = {
  "Активні збори": "processing",
  "Плануються": "warning",
  "Вже відвідані": "success",
};

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

  const [novyyPunkt, setNovyyPunkt] = useState("");
  const [budzetZminenyy, setBudzetZminenyy] = useState(() =>
    otrymatyBudzet(id, mock?.budget, korystuvach)
  );
  const [zibranoNad, setZibranoNad] = useState(() =>
    otrymatyZibrano(id, korystuvach)
  );


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
  const zroblenoCount = (chek || []).filter((it) => it.zrobleno).length;
  const vsiogoChek = (chek || []).length;
  const procentChek = procentCheklista(zroblenoCount, vsiogoChek);

  const vkladky = [
    {
      key: "finansy",
      label: "💰 Фінанси",
      children: (
        <>
          <FinansyPanel
            vlasnyk={vlasnyk}
            vytraty={vytraty}
            zminytyVytraty={setVytraty}
            budzetApi={{
              budzet,
              zibranoBase,
              zibranoNad,
              zminytyBudzet: zminytyBudzetLokalno,
              zminytyZibrano: zminytyZibranoLokalno,
            }}
          />
        </>
      ),
    },
    {
      key: "fakty",
      label: "🌍 Цікаві факти",
      children: (
        <>
          <FaktyPanel podorozh={podorozh} />
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
