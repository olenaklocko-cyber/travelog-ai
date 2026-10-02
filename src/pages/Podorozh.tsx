import { useState } from "react";
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
import Shapka from "../components/Shapka";
import FaktyPanel from "../components/FaktyPanel";
import FinansyPanel from "../components/FinansyPanel";
import { krajiny } from "../data/krajiny";
import { obkladynkaPodorozhi } from "../data/obkladynky";
import { usePodorozh } from "../lib/usePodorozh";
import type { Korystuvach } from "../types";
import { formatHryven, procentCheklista } from "../lib/rakhunky";
import "./Podorozh.css";

const kolirStatusu = {
  "Активні збори": "processing",
  "Плануються": "warning",
  "Вже відвідані": "success",
};

interface PodorozhTiloProps {
  id: string;
  korystuvach: Korystuvach;
}

function PodorozhTilo({ id, korystuvach }: PodorozhTiloProps) {
  const {
    podorozh,
    zavantazhennya,
    vlasnyk,
    budzetApi,
    vytraty,
    zminytyVytraty,
    chek,
    zminytyChek,
  } = usePodorozh(id, korystuvach);
  const [novyyPunkt, setNovyyPunkt] = useState("");

  const dodatyPunkt = () => {
    const tekst = novyyPunkt.trim();
    if (!tekst) return;
    zminytyChek((star) => [...(star || []), { id: Date.now(), tekst, zrobleno: false }]);
    setNovyyPunkt("");
  };

  const peremknuty = (pid: number) =>
    zminytyChek((star) =>
      (star || []).map((it) =>
        it.id === pid ? { ...it, zrobleno: !it.zrobleno } : it
      )
    );

  const vydalyty = (pid: number) =>
    zminytyChek((star) => (star || []).filter((it) => it.id !== pid));

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
            zminytyVytraty={zminytyVytraty}
            budzetApi={budzetApi}
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
            {krajyna.nazva} · бюджет {formatHryven(budzetApi.budzet)} грн
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
